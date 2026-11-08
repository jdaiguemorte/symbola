// Lot 14b (IMP-07) — import des prestataires depuis l'export Excel d'un
// logiciel de planification tiers, contre de vrais modules (PostgreSQL réel) :
// reconnaissance des colonnes, valeurs remises en état, types et étiquettes,
// rapprochements, confirmation, annulation ; isolation A/B. Fichier de test
// entièrement fictif (packages/testing/import-corpus/files/logiciel-tiers).
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { decideFreeColumns, getImportColumns, saveImportMapping, startImport } from "@/modules/hub/service";
import { createVendor, createVendorFamily, createVendorTag, createVendorType, findVendors, getVendor, listVendorFamilies, listVendorTags, listVendorTypes, seedStarterVendorCatalog, updateVendor } from "@/modules/vendors/service";
import { vendorCatalogInput } from "@/lib/vendors/catalog";
import { runImportJobsUntilIdle } from "@/lib/import-jobs";
import { confirmImport, getImportPreview, getUndoPreview, undoImport } from "./apply";
import { decideMatches, decideVendorTypes, getImportMatchesView, getImportTypesView } from "./matching";

const { sql, db } = createAppConnection();
// Placement sur la carte par le géocodeur simulé (ADR 0031), lu à chaque appel.
process.env.GEOCODER = "fake";

afterAll(async () => {
  await sql.end();
});

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, {
    organizationId: organization.id,
    email: `planner-${randomUUID()}@symbola.test`,
    password: "mot-de-passe",
    role: "owner",
  });
  return { organizationId: organization.id, userId: user.id };
}

type Planner = Awaited<ReturnType<typeof createPlanner>>;

async function startVendorsImport(planner: Planner) {
  const started = await startImport(db, {
    ...planner,
    entityType: "vendors",
    fileName: "prestataires.xlsx",
    bytes: readImportCorpusFile("logiciel-tiers/prestataires.xlsx"),
  });
  if (started.status !== "started") throw new Error(`import refusé : ${JSON.stringify(started)}`);
  return started.importId;
}

// Colonnes proposées acceptées ; colonnes sans équivalent (département, TVA,
// APE, statut juridique) gardées en champ libre, sauf le département.
async function preparedImport(planner: Planner) {
  const importId = await startVendorsImport(planner);
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
    decisions: view!.columns.filter((column) => !column.proposedFieldKey).map((column) => ({ columnIndex: column.columnIndex, keep: column.header !== "Département" })),
  });
  return importId;
}

async function acceptAllMatches(planner: Planner, importId: string) {
  const matches = await getImportMatchesView(planner.organizationId, importId);
  const proposed = matches!.rows.filter((row) => row.match?.status === "proposed").map((row) => ({ rowIndex: row.rowIndex, decision: "accept" as const }));
  if (proposed.length > 0) await decideMatches(planner.organizationId, importId, proposed);
}

async function vendorNamed(planner: Planner, name: string) {
  const found = (await findVendors({ organizationId: planner.organizationId, text: name })).find((vendor) => vendor.name === name);
  return found ? getVendor(planner.organizationId, found.id) : null;
}

describe("IMP-07 — Importer ses prestataires depuis l'export Excel", () => {
  it("étant donné l'export des prestataires, le format est reconnu et chaque colonne reçoit sa correspondance avec une confiance d'au moins 90", async () => {
    const planner = await createPlanner();
    const importId = await startVendorsImport(planner);
    const view = await getImportColumns(db, planner.organizationId, importId);
    const mapped = view!.columns.filter((column) => column.proposedFieldKey !== null);
    expect(mapped.map((column) => column.proposedFieldKey).sort()).toEqual(
      ["addressLine", "city", "contactFirstName", "contactLastName", "criteria", "email", "facebook", "instagram", "linkedin", "name", "phones", "pinterest", "postalCode", "services", "siret", "type", "website", "x"].sort(),
    );
    for (const column of mapped) expect(column.confidence).toBeGreaterThanOrEqual(90);
    // Aucune case « je valide » à cocher : tout est au-dessus du seuil.
    const saved = await saveImportMapping(db, {
      organizationId: planner.organizationId,
      importId,
      choices: view!.columns.map((column) => ({ columnIndex: column.columnIndex, target: column.proposedFieldKey ?? "none", confirmed: false })),
    });
    expect(saved).toEqual({ status: "saved" });
  });

  it("quand « Site Internet » contient des critères et « Critères avancés » des adresses web, la correspondance suit le contenu, et la planner le voit", async () => {
    const planner = await createPlanner();
    const importId = await startVendorsImport(planner);
    const view = await getImportColumns(db, planner.organizationId, importId);
    const siteColumn = view!.columns.find((column) => column.header === "Site Internet")!;
    const criteriaColumn = view!.columns.find((column) => column.header === "Critères avancés")!;
    expect(siteColumn).toMatchObject({ proposedFieldKey: "criteria", byContent: true });
    expect(criteriaColumn).toMatchObject({ proposedFieldKey: "website", byContent: true });
    expect(view!.columns.find((column) => column.header === "Ville")!.byContent).toBe(false);
  });

  it("les entités HTML sont décodées, un code postal numérique est complété à 5 chiffres", async () => {
    const planner = await createPlanner();
    const importId = await preparedImport(planner);
    const matches = await getImportMatchesView(planner.organizationId, importId);
    const names = matches!.rows.map((row) => row.values.name);
    expect(names).toContain("Château de la Roche Fictive");
    expect(names).toContain("Clic & Déclic");
    expect(matches!.rows.find((row) => row.values.name === "Sono Événements")!.values.postalCode).toBe("05000");
  });

  it("à la confirmation, les fiches sont créées par le module vendors : premier téléphone, autres numéros et prestations dans la note, critères en étiquettes, site, réseaux, SIRET, champs importés", async () => {
    const planner = await createPlanner();
    const importId = await preparedImport(planner);
    const result = await confirmImport({ ...planner, importId });
    expect(result).toEqual({ status: "applied", result: { created: 25, updated: 0, unchanged: 0, rejected: 0 } });
    // Lot 15 : placement sur la carte en tâche de fond.
    await runImportJobsUntilIdle([planner.organizationId]);

    const dj = (await vendorNamed(planner, "DJ Nova"))!;
    expect(dj.phone).toBe("06 39 98 00 07");
    expect(dj.internalNote).toContain("06 39 98 00 08 (Julie)");
    expect(dj.internalNote).toContain("Sono + lumières");
    const tags = new Map((await listVendorTags(planner.organizationId)).map((tag) => [tag.id, tag.label]));
    expect(dj.tagIds.map((id) => tags.get(id))).toEqual(["Pop", "Rock", "Années 80", "Électro"]);

    const domaine = (await vendorNamed(planner, "Domaine des Tilleuls"))!;
    expect(domaine).toMatchObject({ website: "https://www.domaine-tilleuls.example.org", siret: "12345678900011", postalCode: "86000" });
    expect(domaine.importedFields).toMatchObject({ "Tva Intracommunautaire": "FR00123456789", "Code APE": "5510Z", "Statut Juridique": "SAS" });
    expect(Object.keys(domaine.importedFields ?? {})).not.toContain("Département");
    // Adresse géocodée comme une saisie à la main ; sans adresse, pas de point.
    expect(domaine.location).toMatchObject({ source: "geocoded" });
    expect((await vendorNamed(planner, "Le Grand Brunch"))!.location).toBeNull();

    const studio = (await vendorNamed(planner, "Studio Lumière"))!;
    expect(studio.contactName).toBe("Léa Marchand");
    expect(studio.socialLinks.map((link) => link.network)).toEqual(["instagram", "facebook"]);
  });

  it("décision N : un type du fichier est rapproché d'un type du carnet (même nom ou synonyme), créé sinon, ou regroupé sur un type existant au choix de la planner", async () => {
    const planner = await createPlanner();
    const photographe = await createVendorType(planner.organizationId, "photographe", "#2f5d7c");
    const coiffure = await createVendorType(planner.organizationId, "Coiffure", "#9c4f6b");
    const fleurs = await createVendorType(planner.organizationId, "Fleurs et décoration", "#4f6b5a");
    const importId = await preparedImport(planner);

    const matches = await getImportMatchesView(planner.organizationId, importId);
    const choice = (label: string) => matches!.vendorTypes!.find((entry) => entry.label === label)!;
    expect(choice("Photographe")).toMatchObject({ typeId: photographe.id, score: 100 });
    expect(choice("Coiffeur(se)")).toMatchObject({ typeId: coiffure.id, typeLabel: "Coiffure" });
    expect(choice("Fleuriste").typeId).toBeNull();
    expect(choice("Lieu").rowCount).toBe(2);

    // La planner regroupe « Fleuriste » sur un type existant.
    expect(await decideVendorTypes(planner.organizationId, importId, [{ label: "Fleuriste", target: { kind: "existing", typeId: fleurs.id } }])).toBe(true);
    await confirmImport({ ...planner, importId });

    const types = await listVendorTypes(planner.organizationId);
    expect(types.filter((type) => type.label.toLowerCase() === "photographe")).toHaveLength(1);
    expect(types.map((type) => type.label)).not.toContain("Fleuriste");
    // Lot 16 (IMP-12) : « Lieu » rejoint le type de départ « Lieu de réception ».
    expect(types.map((type) => type.label)).toContain("Lieu de réception");
    expect(types.map((type) => type.label)).not.toContain("Lieu");
    expect((await vendorNamed(planner, "Atelier Pétales"))!.typeId).toBe(fleurs.id);
    expect((await vendorNamed(planner, "Coiff' Mariée"))!.typeId).toBe(coiffure.id);
  });

  it("un type du carnet d'une autre organisation ne peut pas être choisi", async () => {
    const planner = await createPlanner();
    const other = await createPlanner();
    const foreign = await createVendorType(other.organizationId, "Fleuriste", "#4f6b5a");
    const importId = await preparedImport(planner);
    expect(await decideVendorTypes(planner.organizationId, importId, [{ label: "Fleuriste", target: { kind: "existing", typeId: foreign.id } }])).toBe(false);
  });

  it("rapprochements : un prestataire déjà au carnet (même nom à la casse et aux accents près, même ville) est proposé en mise à jour ; une cellule vide n'efface rien", async () => {
    const planner = await createPlanner();
    const existing = await createVendor(planner.organizationId, {
      name: "domaine des tilleuls",
      typeId: null,
      city: "Poitiers",
      phone: "05 00 00 00 00",
      internalNote: "Contact pris au salon",
    });
    const homonym = await createVendor(planner.organizationId, { name: "Sono Evenements", typeId: null, city: "Lille" });
    const importId = await preparedImport(planner);

    const matches = await getImportMatchesView(planner.organizationId, importId);
    expect(matches!.rows.find((row) => row.values.name === "Domaine des Tilleuls")!.match).toMatchObject({ candidateId: existing.vendor.id, status: "proposed" });
    // Même nom mais autre ville : pas de rapprochement.
    expect(matches!.rows.find((row) => row.values.name === "Sono Événements")!.match).toBeNull();

    await acceptAllMatches(planner, importId);
    const preview = await getImportPreview(planner.organizationId, importId);
    expect(preview).toMatchObject({ counts: { creations: 24, updates: 1 }, blockers: [] });
    await confirmImport({ ...planner, importId });

    const updated = (await getVendor(planner.organizationId, existing.vendor.id))!;
    expect(updated).toMatchObject({ name: "Domaine des Tilleuls", email: "contact@domaine-tilleuls.example.org" });
    expect(updated.internalNote).toMatch(/^Contact pris au salon\n\nSalle de réception/);
    expect((await getVendor(planner.organizationId, homonym.vendor.id))!.name).toBe("Sono Evenements");
  });

  it("l'import est annulable : prestataires créés supprimés, mis à jour remis à leurs valeurs, étiquettes et types créés retirés s'ils ne servent plus", async () => {
    const planner = await createPlanner();
    const existing = await createVendor(planner.organizationId, { name: "Domaine des Tilleuls", typeId: null, city: "Poitiers", phone: "05 00 00 00 00" });
    const importId = await preparedImport(planner);
    await acceptAllMatches(planner, importId);
    await confirmImport({ ...planner, importId });

    // Après l'import, la planner range une fiche à elle sous l'étiquette « Pop ».
    const pop = (await listVendorTags(planner.organizationId)).find((tag) => tag.label === "Pop")!;
    const mine = await createVendor(planner.organizationId, { name: "Mon DJ", typeId: null, tagIds: [pop.id] });

    const undo = await undoImport({ ...planner, importId });
    expect(undo.status).toBe("done");
    const left = await findVendors({ organizationId: planner.organizationId });
    expect(left.map((vendor) => vendor.name).sort()).toEqual(["Domaine des Tilleuls", "Mon DJ"]);
    expect((await getVendor(planner.organizationId, existing.vendor.id))!).toMatchObject({ phone: "05 00 00 00 00", email: null, website: null, tagIds: [] });
    expect((await listVendorTags(planner.organizationId)).map((tag) => tag.label)).toEqual(["Pop"]);
    expect(await listVendorTypes(planner.organizationId)).toEqual([]);
    expect((await getVendor(planner.organizationId, mine.vendor.id))!.tagIds).toEqual([pop.id]);
  });

  it("une fiche créée par l'import puis modifiée à la main est signalée et gardée sans confirmation", async () => {
    const planner = await createPlanner();
    const importId = await preparedImport(planner);
    await confirmImport({ ...planner, importId });
    const brunch = (await vendorNamed(planner, "Le Grand Brunch"))!;
    await updateVendor(planner.organizationId, brunch.id, { name: "Le Grand Brunch", typeId: brunch.typeId, phone: "06 39 98 99 99" });

    const preview = await getUndoPreview(planner.organizationId, importId);
    expect(preview!.pendingItems.find((item) => item.elementId === brunch.id)!.modified).toBe(true);
    const undo = await undoImport({ ...planner, importId });
    expect(undo).toMatchObject({ status: "done", outcomes: { kept_modified: 1 } });
    expect(await getVendor(planner.organizationId, brunch.id)).not.toBeNull();
  });

  it("isolation : un import de l'organisation A ne crée ni ne rapproche jamais un prestataire de B, ni ne réutilise ses étiquettes", async () => {
    const a = await createPlanner();
    const b = await createPlanner();
    const theirs = await createVendor(b.organizationId, { name: "Domaine des Tilleuls", typeId: null, city: "Poitiers" });
    await createVendorTag(b.organizationId, "Pop");
    const importId = await preparedImport(a);

    const matches = await getImportMatchesView(a.organizationId, importId);
    expect(matches!.rows.every((row) => row.match === null)).toBe(true);
    expect(matches!.rows.every((row) => row.options.every((option) => option.id !== theirs.vendor.id))).toBe(true);
    await confirmImport({ ...a, importId });

    expect((await findVendors({ organizationId: b.organizationId })).map((vendor) => vendor.name)).toEqual(["Domaine des Tilleuls"]);
    expect((await listVendorTags(b.organizationId)).map((tag) => tag.label)).toEqual(["Pop"]);
    expect(await getImportMatchesView(b.organizationId, importId)).toBeNull();
    expect(await undoImport({ ...b, importId })).toEqual({ status: "not_found" });
  });
});

describe("IMP-12 — Types à l'import par familles", () => {
  it("avec les types de départ d'une wedding planner, les 22 libellés du corpus créent au plus 12 types ; « Coiffeur(se) » et « Maquillage » sont réunis", async () => {
    const planner = await createPlanner();
    await seedStarterVendorCatalog(planner.organizationId, vendorCatalogInput("fr"), { withTypes: true });
    const before = (await listVendorTypes(planner.organizationId)).length;
    const importId = await preparedImport(planner);
    const view = await getImportTypesView(planner.organizationId, importId);
    expect(view!.choices).toHaveLength(22);
    await acceptAllMatches(planner, importId);
    await confirmImport({ ...planner, importId });

    const types = await listVendorTypes(planner.organizationId);
    expect(types.length - before).toBeLessThanOrEqual(12);
    const hair = types.find((type) => type.label === "Coiffure et maquillage")!;
    expect((await vendorNamed(planner, "Coiff' Mariée"))!.typeId).toBe(hair.id);
    const makeup = view!.choices.find((choice) => choice.label === "Maquillage")!;
    expect(makeup.target).toEqual({ kind: "existing", typeId: hair.id });
  });

  it("sans les types de départ, chaque famille de synonymes crée un seul type de départ, rangé dans sa famille ; jamais un type par libellé", async () => {
    const planner = await createPlanner();
    await createVendorType(planner.organizationId, "Photographe", "#123456");
    const importId = await preparedImport(planner);
    const view = (await getImportTypesView(planner.organizationId, importId))!;
    const target = (label: string) => view.choices.find((choice) => choice.label === label)!.target;
    expect(target("Coiffeur(se)")).toEqual({ kind: "starter", starterKey: "hair_makeup" });
    expect(target("Maquillage")).toEqual({ kind: "starter", starterKey: "hair_makeup" });
    expect(target("Vins & Boissons")).toEqual({ kind: "starter", starterKey: "drinks" });
    expect(target("Photographe")).toMatchObject({ kind: "existing" });
    expect(view.choices.every((choice) => choice.target.kind !== "new")).toBe(true);
    // Rangés par famille dès l'étape « Types ».
    const beauty = view.families.find((family) => family.label === "Beauté et tenues")!;
    expect(view.choices.find((choice) => choice.label === "Coiffeur(se)")!.familyId).toBe(beauty.id);

    await acceptAllMatches(planner, importId);
    await confirmImport({ ...planner, importId });
    const types = await listVendorTypes(planner.organizationId);
    const created = types.filter((type) => type.label !== "Photographe");
    expect(created.every((type) => type.starterKey !== null && type.familyId !== null)).toBe(true);
    expect(types.filter((type) => type.label === "Coiffure et maquillage")).toHaveLength(1);
    expect(types.map((type) => type.label)).not.toContain("Coiffeur(se)");
  });

  it("elle choisit un autre type, en crée un dans une famille, ou laisse « à classer » : la fiche garde alors le libellé du fichier", async () => {
    const planner = await createPlanner();
    await seedStarterVendorCatalog(planner.organizationId, vendorCatalogInput("fr"), { withTypes: true });
    const attire = await createVendorFamily(planner.organizationId, { label: "Tenues", color: "#7a2e5c", icon: "attire" });
    const importId = await preparedImport(planner);
    expect(
      await decideVendorTypes(planner.organizationId, importId, [
        { label: "Photobooth", target: { kind: "new", familyId: attire.id } },
        { label: "Baby-Sitter", target: { kind: "none" } },
      ]),
    ).toBe(true);
    const sitterName = (await getImportMatchesView(planner.organizationId, importId))!.rows.find((row) => row.values.type === "Baby-Sitter")!.values.name as string;
    await acceptAllMatches(planner, importId);
    await confirmImport({ ...planner, importId });

    const types = await listVendorTypes(planner.organizationId);
    expect(types.find((type) => type.label === "Photobooth" && type.familyId === attire.id)).toBeDefined();
    const sitter = (await getVendor(planner.organizationId, (await vendorNamed(planner, sitterName))!.id))!;
    expect(sitter.typeId).toBeNull();
    expect(Object.values(sitter.importedFields ?? {})).toContain("Baby-Sitter");
    expect((await listVendorFamilies(planner.organizationId)).some((family) => family.id === attire.id)).toBe(true);
  });

  it("une famille d'une autre organisation ne peut pas être choisie", async () => {
    const planner = await createPlanner();
    const other = await createPlanner();
    const foreign = await createVendorFamily(other.organizationId, { label: "Étrangère", color: "#123456", icon: "other" });
    const importId = await preparedImport(planner);
    expect(await decideVendorTypes(planner.organizationId, importId, [{ label: "Photobooth", target: { kind: "new", familyId: foreign.id } }])).toBe(false);
  });
});
