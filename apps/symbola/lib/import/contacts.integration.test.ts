// Lot 36b (HUB-14, DAT-12, SC-10 ; D11) — import de contacts, contre de vrais modules (PostgreSQL
// réel), avec le fichier de 600 contacts de la recette (docs/recette, entièrement fictif) :
// colonnes reconnues (nom et prénom dans une seule colonne), lignes écartées selon la catégorie,
// doublons d'adresse dans le fichier et dans l'organisation, confirmation, annulation en bloc ;
// isolation A/B. Les cas qui confirment l'import de 400 lignes ont 60 s (la suite entière tourne en
// même temps).
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { createProspect, createProspectSource } from "@/modules/events/service";
import {
  createContact,
  decideFreeColumns,
  findContactByEmail,
  getContact,
  getImportColumns,
  listContactNotes,
  listContacts,
  saveImportMapping,
  splitPersonName,
  startImport,
  updateContact,
} from "@/modules/hub/service";
import { confirmImport, getImportPreview, getUndoPreview, undoImport } from "./apply";
import { decideMatches, getImportMatchesView, getImportRowFilterView, setContactRowFilter, setContactRowsIgnored } from "./matching";
import { getImportWizard } from "./wizard";

const { sql, db } = createAppConnection();
const CSV = readFileSync(new URL("../../../../docs/recette/contacts-import-test-600.csv", import.meta.url));

afterAll(async () => {
  await sql.end();
});

// Le fichier, lu à part pour connaître ce que l'import doit en faire.
const lines = CSV.toString("utf8")
  .replace(/^﻿/, "")
  .split(/\r?\n/)
  .filter((line) => line.trim() !== "")
  .slice(1)
  .map((line) => line.split(";"));
const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const category = (line: string[]) => fold(line[4] ?? "");
const emailOf = (line: string[]) => (line[2] ?? "").trim().toLowerCase();
const kept = lines.filter((line) => !["prestataire", "lieu"].includes(category(line)));

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `sophie-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  return { organizationId: organization.id, userId: user.id };
}
type Planner = Awaited<ReturnType<typeof createPlanner>>;

async function startContactsImport(planner: Planner) {
  const started = await startImport(db, { ...planner, entityType: "contacts", fileName: "contacts.csv", bytes: CSV });
  if (started.status !== "started") throw new Error(`import refusé : ${JSON.stringify(started)}`);
  return started.importId;
}

// Colonnes proposées acceptées sans case à cocher ; « Catégorie » gardée (elle ira dans la note).
async function preparedImport(planner: Planner) {
  const importId = await startContactsImport(planner);
  const view = await getImportColumns(db, planner.organizationId, importId);
  const saved = await saveImportMapping(db, {
    organizationId: planner.organizationId,
    importId,
    choices: view!.columns.map((column) => ({ columnIndex: column.columnIndex, target: column.proposedFieldKey ?? "none", confirmed: false })),
  });
  if (saved.status !== "saved") throw new Error(`colonnes refusées : ${JSON.stringify(saved)}`);
  await decideFreeColumns(db, {
    organizationId: planner.organizationId,
    importId,
    decisions: view!.columns.filter((column) => !column.proposedFieldKey).map((column) => ({ columnIndex: column.columnIndex, keep: true })),
  });
  return { importId, categoryColumn: view!.columns.find((column) => column.header.trim() === "Catégorie")!.columnIndex };
}

async function excludeVendors(planner: Planner, importId: string, columnIndex: number) {
  expect(await setContactRowFilter(planner.organizationId, importId, { columnIndex, excluded: ["prestataire", "lieu"] })).toBe(true);
}

describe("HUB-14 — Importer ses contacts : correspondance des colonnes", () => {
  it("étant donné le fichier de 600 contacts, « NOM Prénom », « tel portable », « Mail », « Ville » et « notes » sont reconnus sans rien valider à la main ; « Catégorie » est sans équivalent", async () => {
    const planner = await createPlanner();
    const importId = await startContactsImport(planner);
    const view = await getImportColumns(db, planner.organizationId, importId);
    const byHeader = Object.fromEntries(view!.columns.map((column) => [column.header.trim(), column]));
    expect(byHeader["NOM Prénom"]!.proposedFieldKey).toBe("lastFirstName");
    expect(byHeader["tel portable"]!.proposedFieldKey).toBe("phone");
    expect(byHeader["Mail"]!.proposedFieldKey).toBe("email");
    expect(byHeader["Ville"]!.proposedFieldKey).toBe("city");
    expect(byHeader["notes"]!.proposedFieldKey).toBe("notes");
    expect(byHeader["Catégorie"]!.proposedFieldKey).toBeNull();
    for (const column of view!.columns.filter((candidate) => candidate.proposedFieldKey)) expect(column.confidence).toBeGreaterThanOrEqual(view!.lowConfidenceThreshold);
  });

  it("sans aucune colonne de nom, les colonnes sont refusées dès cette étape (« Nom ou prénom » manque)", async () => {
    const planner = await createPlanner();
    const importId = await startContactsImport(planner);
    const view = await getImportColumns(db, planner.organizationId, importId);
    const saved = await saveImportMapping(db, {
      organizationId: planner.organizationId,
      importId,
      choices: view!.columns.map((column) => ({ columnIndex: column.columnIndex, target: column.proposedFieldKey === "lastFirstName" || !column.proposedFieldKey ? "ignore" : column.proposedFieldKey, confirmed: false })),
    });
    expect(saved).toEqual({ status: "invalid", errors: [{ code: "missing_required", fieldKey: "contactName" }] });
  });

  it("le nom et le prénom d'une seule colonne : les mots en majuscules sont le nom ; sinon, l'ordre de la colonne", () => {
    expect(splitPersonName("HENRY Mathieu", "lastFirst")).toEqual({ firstName: "Mathieu", lastName: "HENRY" });
    expect(splitPersonName("François Agathe", "lastFirst")).toEqual({ firstName: "Agathe", lastName: "François" });
    expect(splitPersonName("Marie-Claire LE GOFF", "lastFirst")).toEqual({ firstName: "Marie-Claire", lastName: "LE GOFF" });
    expect(splitPersonName("D'ALMEIDA Inès", "firstLast")).toEqual({ firstName: "Inès", lastName: "D'ALMEIDA" });
    expect(splitPersonName("Léa Martin", "firstLast")).toEqual({ firstName: "Léa", lastName: "Martin" });
    expect(splitPersonName("Léa", "lastFirst")).toEqual({ firstName: "Léa", lastName: null });
  });
});

describe("SC-10 / D11 — Un fichier qui mêle clients et prestataires", () => {
  it("la colonne « Catégorie » est proposée avec ses valeurs regroupées (casse et espaces mis à part) ; écarter « prestataire » et « lieu » rejette ces lignes, avec leur motif, et l'étape « Lignes » est faite", async () => {
    const planner = await createPlanner();
    const { importId, categoryColumn } = await preparedImport(planner);
    let wizard = await getImportWizard(planner.organizationId, importId);
    expect(wizard!.next).toBe("rows");
    const view = await getImportRowFilterView(planner.organizationId, importId);
    const column = view!.columns.find((candidate) => candidate.columnIndex === categoryColumn)!;
    const count = (value: string) => column.values.find((candidate) => candidate.value === value)?.count;
    expect(count("prestataire")).toBe(lines.filter((line) => category(line) === "prestataire").length);
    expect(count("prospect")).toBe(lines.filter((line) => category(line) === "prospect").length);
    expect(count("")).toBe(lines.filter((line) => category(line) === "").length);
    // Les colonnes reconnues (nom, e-mail…) ne sont pas proposées.
    expect(view!.columns.map((candidate) => candidate.header.trim())).toEqual(["Catégorie"]);

    await excludeVendors(planner, importId, categoryColumn);
    const matches = await getImportMatchesView(planner.organizationId, importId);
    const excluded = matches!.rows.filter((row) => row.errors.some((error) => error.code === "excluded_by_filter"));
    expect(excluded).toHaveLength(lines.length - kept.length);
    expect(excluded[0]!.errors).toEqual([expect.objectContaining({ code: "excluded_by_filter", fieldKey: "Catégorie" })]);
    wizard = await getImportWizard(planner.organizationId, importId);
    expect(wizard!.steps.find((step) => step.key === "rows")).toMatchObject({ done: true, summary: { key: "rows", values: { excluded: excluded.length } } });
    // Une valeur absente du fichier est refusée.
    expect(await setContactRowFilter(planner.organizationId, importId, { columnIndex: categoryColumn, excluded: ["fournisseur"] })).toBe(false);
  }, 60_000);
});

describe("DAT-12 / HUB-14 — Doublons, confirmation et annulation en bloc", () => {
  it("une adresse déjà vue plus haut complète la première ligne ; une adresse déjà connue propose de compléter son contact, sans rien écraser ; jamais deux contacts pour une adresse", async () => {
    const planner = await createPlanner();
    // Un contact déjà là, avec un téléphone, sans ville : l'adresse d'une ligne gardée du fichier.
    const known = kept.find((line) => emailOf(line) !== "" && line[5]?.trim())!;
    const existing = await createContact(planner.organizationId, { firstName: "Déjà", lastName: "Connue", email: emailOf(known), phone: "01 00 00 00 00" });
    const { importId, categoryColumn } = await preparedImport(planner);
    await excludeVendors(planner, importId, categoryColumn);

    const matches = await getImportMatchesView(planner.organizationId, importId);
    const valid = matches!.rows.filter((row) => row.errors.length === 0);
    const emailMatch = valid.find((row) => row.match?.candidateId === existing.id)!;
    expect(emailMatch.match).toMatchObject({ status: "proposed", score: 100, reason: "email" });
    // Les doublons d'adresse du fichier, parmi les lignes gardées.
    const seen = new Set<string>();
    const repeated = kept.filter((line) => {
      const email = emailOf(line);
      if (!email) return false;
      if (seen.has(email)) return true;
      seen.add(email);
      return false;
    });
    expect(valid.filter((row) => row.sameAsLine !== undefined)).toHaveLength(repeated.length);

    // Une ligne doublon ignorée, puis la proposition acceptée.
    const duplicateRow = valid.find((row) => row.sameAsLine !== undefined && row.match === null)!;
    expect(await setContactRowsIgnored(planner.organizationId, importId, [duplicateRow.rowIndex], true)).toBe(true);
    await decideMatches(planner.organizationId, importId, [{ rowIndex: emailMatch.rowIndex, decision: "accept" }]);
    const preview = await getImportPreview(planner.organizationId, importId);
    expect(preview!.blockers).toEqual([]);

    const confirmed = await confirmImport({ organizationId: planner.organizationId, userId: planner.userId, importId });
    expect(confirmed.status).toBe("applied");
    const distinctEmails = new Set(kept.map(emailOf).filter(Boolean));
    const withoutEmail = kept.filter((line) => !emailOf(line)).length;
    const { total } = await listContacts(planner.organizationId);
    // Le contact déjà là, plus un contact par adresse nouvelle et par ligne sans adresse.
    expect(total).toBe(1 + (distinctEmails.size - 1) + withoutEmail);
    const henry = kept.find((line) => /^HENRY Mathieu/.test(line[0]!));
    if (henry && emailOf(henry)) {
      expect(await findContactByEmail(planner.organizationId, emailOf(henry))).toMatchObject({ firstName: "Mathieu", lastName: "HENRY", city: henry[3]!.trim(), phone: henry[1]!.trim() });
    }

    // Le contact connu est complété (ville), sans perdre son nom ni son téléphone ; la note du fichier s'ajoute.
    const completed = await getContact(planner.organizationId, existing.id);
    expect(completed).toMatchObject({ firstName: "Déjà", lastName: "Connue", phone: "01 00 00 00 00", city: known[3]!.trim() });
    const notes = await listContactNotes(planner.organizationId, existing.id);
    expect(notes).toHaveLength(1);
    expect(notes[0]!.body).toContain(known[5]!.trim());
    expect(notes[0]!.body).toContain("Catégorie :");
  }, 60_000);

  it("refuser de compléter le contact qui porte l'adresse ignore la ligne : il n'y a pas de second contact", async () => {
    const planner = await createPlanner();
    const known = kept.find((line) => emailOf(line) !== "")!;
    const existing = await createContact(planner.organizationId, { firstName: "Déjà", email: emailOf(known) });
    const { importId, categoryColumn } = await preparedImport(planner);
    await excludeVendors(planner, importId, categoryColumn);
    const matches = await getImportMatchesView(planner.organizationId, importId);
    const rows = matches!.rows.filter((row) => row.match?.candidateId === existing.id);
    await decideMatches(planner.organizationId, importId, rows.map((row) => ({ rowIndex: row.rowIndex, decision: "refuse" as const })));
    const after = await getImportMatchesView(planner.organizationId, importId);
    expect(after!.rows.filter((row) => row.match?.candidateId === existing.id).every((row) => row.ignored)).toBe(true);
    expect((await confirmImport({ organizationId: planner.organizationId, userId: planner.userId, importId })).status).toBe("applied");
    expect(await getContact(planner.organizationId, existing.id)).toMatchObject({ firstName: "Déjà", city: null });
    expect((await findContactByEmail(planner.organizationId, emailOf(known)))!.id).toBe(existing.id);
  }, 60_000);

  it("l'annulation supprime les contacts créés et rend au contact complété ses champs vides ; un contact devenu client d'un évènement est gardé ; un contact retouché ne s'annule qu'avec confirmation", async () => {
    const planner = await createPlanner();
    const known = kept.find((line) => emailOf(line) !== "")!;
    const existing = await createContact(planner.organizationId, { firstName: "Déjà", email: emailOf(known) });
    const { importId, categoryColumn } = await preparedImport(planner);
    await excludeVendors(planner, importId, categoryColumn);
    const matches = await getImportMatchesView(planner.organizationId, importId);
    await decideMatches(
      planner.organizationId,
      importId,
      matches!.rows.filter((row) => row.match?.status === "proposed").map((row) => ({ rowIndex: row.rowIndex, decision: "accept" as const })),
    );
    expect((await confirmImport({ organizationId: planner.organizationId, userId: planner.userId, importId })).status).toBe("applied");

    // Un contact importé devient client d'un évènement ; un autre est retouché à la main.
    const [first, second] = [...new Set(kept.map(emailOf).filter((email) => email && email !== emailOf(known)))];
    const client = (await findContactByEmail(planner.organizationId, first!))!;
    const source = await createProspectSource(planner.organizationId, "Salon");
    await createProspect({ organizationId: planner.organizationId, createdByUserId: planner.userId, prospectSourceId: source.id, clients: [{ contactId: client.id, firstName: client.firstName ?? "" }] });
    const touched = (await findContactByEmail(planner.organizationId, second!))!;
    await updateContact(planner.organizationId, touched.id, { phone: "07 77 77 77 77" });

    const undoPreview = await getUndoPreview(planner.organizationId, importId);
    expect(undoPreview!.pendingItems.find((item) => item.elementId === client.id && item.kind === "contact" && item.action === "created")).toMatchObject({ usedElsewhere: true });
    expect(undoPreview!.pendingItems.find((item) => item.elementId === touched.id && item.kind === "contact" && item.action === "created")).toMatchObject({ modified: true });
    const undone = await undoImport({ organizationId: planner.organizationId, userId: planner.userId, importId });
    expect(undone.status).toBe("done");
    if (undone.status !== "done") return;
    expect(undone.outcomes.kept_in_use).toBe(1);
    expect(undone.outcomes.kept_modified).toBe(1);

    const remaining = (await listContacts(planner.organizationId)).contacts.map((contact) => contact.id).sort();
    expect(remaining).toEqual([existing.id, client.id, touched.id].sort());
    expect(await getContact(planner.organizationId, existing.id)).toMatchObject({ firstName: "Déjà", city: null, phone: null });
    expect(await listContactNotes(planner.organizationId, existing.id)).toEqual([]);
  }, 60_000);
});

describe("SEC-10 — Un import de contacts reste dans son organisation", () => {
  it("le contact d'une autre organisation à la même adresse n'est ni proposé ni complété", async () => {
    const plannerA = await createPlanner();
    const plannerB = await createPlanner();
    const known = kept.find((line) => emailOf(line) !== "")!;
    const ofB = await createContact(plannerB.organizationId, { firstName: "Secret", email: emailOf(known) });
    const { importId, categoryColumn } = await preparedImport(plannerA);
    await excludeVendors(plannerA, importId, categoryColumn);
    const matches = await getImportMatchesView(plannerA.organizationId, importId);
    expect(matches!.rows.some((row) => row.match?.candidateId === ofB.id || row.options.some((option) => option.id === ofB.id))).toBe(false);
    expect((await confirmImport({ organizationId: plannerA.organizationId, userId: plannerA.userId, importId })).status).toBe("applied");
    expect(await getContact(plannerB.organizationId, ofB.id)).toMatchObject({ firstName: "Secret", city: null });
    expect((await findContactByEmail(plannerA.organizationId, emailOf(known)))!.id).not.toBe(ofB.id);
  }, 60_000);
});
