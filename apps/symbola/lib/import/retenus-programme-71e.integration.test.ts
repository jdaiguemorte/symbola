// Lot 71e (HUB-14, PRE-01, PRE-02, CHR-06, CHR-08, UX-17, SEC-21 ; spécification du lot 71, § 5.5, critères
// 1 à 8) — les PDF des prestataires retenus et du programme par l'assistant commun, contre un vrai
// PostgreSQL (RLS) et l'antivirus local : arrêt « autre couple », contrats, bilan, retrait d'ensemble,
// fins « à compléter », « Ponctuel », diffusion avec « heure de fin à venir », annuaire au carnet ; abus
// d'une autre organisation. Fichiers fictifs du corpus (packages/testing/import-corpus/).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { appDatabase } from "@symbola/db/client";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import {
  addEventVendorSlot,
  completeProgramItem,
  createProspect,
  getEventProgram,
  listEventVendorSlots,
  listVendorCandidates,
  missingEndItems,
  programAwaitsEnds,
  ProgramGapInvalidError,
  publishEventProgram,
  getEventProgramVersion,
} from "@/modules/events/service";
import { getImportLeftovers, saveImportAnswers, savePdfImportDecisions, startPdfImport } from "@/modules/hub/service";
import { createVendor, findVendors, getVendor } from "@/modules/vendors/service";
import { undoImport } from "./apply";
import { addDirectoryToCarnet, confirmProgramImport, confirmVendorsImport, getImportDirectory, getProgramImportView, getVendorsImportView } from "./pdf-imports";

const db = appDatabase();

// Le contrat dit de chaque prestataire retenu (« Contrat signé », « contrat non signé »), tel que la fiche le lit.
async function contracts(organizationId: string, eventId: string): Promise<Map<string, string | null>> {
  const slots = await listEventVendorSlots(organizationId, eventId);
  return new Map(slots.flatMap((slot) => slot.retainedVendors.map((vendor) => [vendor.vendorName, vendor.takeoverContract ?? null] as const)));
}
const userId = randomUUID();
const vendorsPdf = readImportCorpusFile("logiciel-tiers/prestataires-evenement.pdf");
const programPdf = readImportCorpusFile("logiciel-tiers/programme-jour-j.pdf");

// « Léa & Hugo » (un autre couple que celui du fichier), ou « Clémence & Bastien » (celui du fichier).
async function wedding(couple: "lea" | "clemence" = "clemence", organizationId = randomUUID()) {
  const clients = couple === "lea" ? [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Hugo", lastName: "Bernard" }] : [{ firstName: "Clémence", lastName: "Martin" }, { firstName: "Bastien", lastName: "Leroy" }];
  const event = await createProspect({ organizationId, createdByUserId: userId, prospectSourceId: null, clients, eventDate: "2027-06-12" });
  const slots = Object.fromEntries(
    await Promise.all(["Lieu de réception", "Photographe", "Fleuriste", "DJ", "Traiteur"].map(async (label) => [label, (await addEventVendorSlot(organizationId, event.id, label)).id] as const)),
  );
  return { organizationId, eventId: event.id, slots };
}

async function startVendors(organizationId: string, eventId: string) {
  const started = await startPdfImport(db, { organizationId, userId, entityType: "event_vendors", fileName: "prestataires-retenus.pdf", bytes: vendorsPdf, targetEventId: eventId });
  if (started.status !== "started") throw new Error(started.reason);
  return started.importId;
}

async function startProgram(organizationId: string, eventId: string) {
  const started = await startPdfImport(db, { organizationId, userId, entityType: "program", fileName: "programme-jour-j.pdf", bytes: programPdf, targetEventId: eventId });
  if (started.status !== "started") throw new Error(started.reason);
  return started.importId;
}

describe("HUB-14 — Le fichier d'un autre couple arrête l'import (lot 71e, critère 1)", () => {
  it("prestataires-evenement.pdf déposé sur « Léa & Hugo » s'arrête à l'étape Fichier ; rien ne s'écrit avant la réponse", async () => {
    const { organizationId, eventId } = await wedding("lea");
    const importId = await startVendors(organizationId, eventId);
    const view = await getVendorsImportView(organizationId, importId);
    expect(view).toMatchObject({ couple: "different", coupleStop: true, fileCouple: ["Clémence MARTIN", "Bastien LEROY"] });
    await saveImportAnswers(db, { organizationId, importId, answers: { contracts: { answer: "all" } } });
    expect(await confirmVendorsImport({ organizationId, userId, importId })).toEqual({ status: "blocked", reason: "couple" });
    expect(await listVendorCandidates(organizationId, eventId)).toEqual([]);
    // « C'est bien ce mariage, continuer » : la réponse est gardée, et redite au bilan.
    await savePdfImportDecisions(db, { organizationId, importId, decisions: { coupleConfirmed: true } });
    expect((await getVendorsImportView(organizationId, importId))?.coupleStop).toBe(false);
    const applied = await confirmVendorsImport({ organizationId, userId, importId });
    expect(applied).toMatchObject({ status: "applied", result: { coupleConfirmed: true } });
  });

  it("le fichier de ce couple ne demande rien ; le programme d'un autre couple s'arrête aussi", async () => {
    const same = await wedding("clemence");
    expect((await getVendorsImportView(same.organizationId, await startVendors(same.organizationId, same.eventId)))?.coupleStop).toBe(false);
    const other = await wedding("lea");
    expect(await getProgramImportView(other.organizationId, await startProgram(other.organizationId, other.eventId))).toMatchObject({ couple: "different", coupleStop: true });
  });
});

describe("PRE-02 — Les prestataires retenus : contrats, bilan et retrait (lot 71e, critères 2 à 4)", () => {
  it("sans réponse aux contrats, rien n'est écrit ; « Tous » les dit signés et aucun « à faire signer » n'en naît", async () => {
    const { organizationId, eventId } = await wedding();
    const importId = await startVendors(organizationId, eventId);
    expect(await confirmVendorsImport({ organizationId, userId, importId })).toEqual({ status: "blocked", reason: "contracts" });
    await saveImportAnswers(db, { organizationId, importId, answers: { contracts: { answer: "all" } } });
    const applied = await confirmVendorsImport({ organizationId, userId, importId });
    if (applied.status !== "applied") throw new Error(applied.status);
    const candidates = await listVendorCandidates(organizationId, eventId);
    expect(candidates).toHaveLength(12);
    expect(candidates.every((candidate) => candidate.status === "contract_signed")).toBe(true);
    expect([...(await contracts(organizationId, eventId)).values()].every((contract) => contract === "signed")).toBe(true);
    // La ligne de l'agence n'est jamais reprise.
    expect(candidates.some((candidate) => candidate.vendorName === "Belle Journée")).toBe(false);
  });

  it("« Aucun » et « Ligne par ligne » donnent les contrats annoncés (dits, jamais une relance)", async () => {
    const none = await wedding();
    const noneId = await startVendors(none.organizationId, none.eventId);
    await saveImportAnswers(db, { organizationId: none.organizationId, importId: noneId, answers: { contracts: { answer: "none" } } });
    await confirmVendorsImport({ organizationId: none.organizationId, userId, importId: noneId });
    expect((await listVendorCandidates(none.organizationId, none.eventId)).every((candidate) => candidate.status === "retained")).toBe(true);
    expect([...(await contracts(none.organizationId, none.eventId)).values()].every((contract) => contract === "unsigned")).toBe(true);

    const perLine = await wedding();
    const perLineId = await startVendors(perLine.organizationId, perLine.eventId);
    await saveImportAnswers(db, { organizationId: perLine.organizationId, importId: perLineId, answers: { contracts: { answer: "per_line", signedRows: [8, 10] } } });
    const view = await getVendorsImportView(perLine.organizationId, perLineId);
    expect(view?.figures).toMatchObject({ signed: 2, unsigned: 10 });
    await confirmVendorsImport({ organizationId: perLine.organizationId, userId, importId: perLineId });
    const signed = [...(await contracts(perLine.organizationId, perLine.eventId)).entries()].filter(([, contract]) => contract === "signed").map(([name]) => name).sort();
    expect(signed).toEqual(["Domaine des Tilleuls", "Studio Lumière"]);
  });

  it("le bilan redit les nombres de « Vérifier » ; « Retirer cet import… » retire les retenus, les postes et les fiches créés, et garde le carnet", async () => {
    const { organizationId, eventId, slots } = await wedding();
    const { vendor: studio } = await createVendor(organizationId, { name: "Studio Lumière" });
    const importId = await startVendors(organizationId, eventId);
    await saveImportAnswers(db, { organizationId, importId, answers: { contracts: { answer: "all" } } });
    const before = await getVendorsImportView(organizationId, importId);
    const applied = await confirmVendorsImport({ organizationId, userId, importId });
    if (applied.status !== "applied") throw new Error(applied.status);
    expect(applied.result.figures).toEqual(before!.figures);
    const figures = applied.result.figures as { vendors: number; foundInCarnet: number; createdFiches: number; signed: number; unsigned: number };
    expect(figures.foundInCarnet + figures.createdFiches).toBe(figures.vendors);
    expect(figures.signed + figures.unsigned).toBe(figures.vendors);
    expect(figures).toMatchObject({ vendors: 12, foundInCarnet: 1, createdFiches: 11 });
    const created = (await findVendors({ organizationId, limit: 60 })).filter((vendor) => vendor.id !== studio.id);
    expect(created).toHaveLength(11);
    // Une fiche créée garde ce que le fichier disait d'elle.
    expect(created.find((vendor) => vendor.name === "Douceurs d'Ambre")).toMatchObject({ contactName: "Ambre SOULIER", email: "douceurs@exemple.invalid" });
    expect((await listVendorCandidates(organizationId, eventId)).find((candidate) => candidate.vendorName === "Studio Lumière")).toMatchObject({ vendorId: studio.id, vendorSlotId: slots["Photographe"] });

    const undone = await undoImport({ organizationId, userId, importId });
    expect(undone.status).toBe("done");
    expect(await listVendorCandidates(organizationId, eventId)).toEqual([]);
    expect((await listEventVendorSlots(organizationId, eventId)).map((slot) => slot.label).sort()).toEqual(["DJ", "Fleuriste", "Lieu de réception", "Photographe", "Traiteur"]);
    expect((await findVendors({ organizationId, limit: 60 })).map((vendor) => vendor.id)).toEqual([studio.id]);
  });
});

describe("CHR-08 — Le programme repris : fins « à compléter », « Ponctuel », diffusion (lot 71e, critères 5 à 7)", () => {
  it("le programme s'écrit sans fin déduite ; l'onglet compte les fins manquantes ; « Ponctuel » et une heure saisie font baisser le compte", async () => {
    const { organizationId, eventId } = await wedding();
    const importId = await startProgram(organizationId, eventId);
    const view = await getProgramImportView(organizationId, importId);
    const applied = await confirmProgramImport({ organizationId, userId, importId });
    if (applied.status !== "applied") throw new Error(applied.status);
    expect(applied.result.figures).toEqual(view!.figures);
    expect(await programAwaitsEnds(organizationId, eventId)).toBe(true);
    const program = await getEventProgram(organizationId, eventId);
    const missing = missingEndItems(program.items);
    expect(missing.length).toBe(view!.figures.endsMissing);
    expect(program.items.find((item) => item.label === "Soirée de la veille")).toMatchObject({ startTime: "19:00", endTime: "02:00" });
    await completeProgramItem(organizationId, eventId, missing[0]!.id, { timing: "point" });
    await completeProgramItem(organizationId, eventId, missing[1]!.id, { endTime: "12:15" });
    expect(missingEndItems((await getEventProgram(organizationId, eventId)).items)).toHaveLength(missing.length - 2);
    // Abus : un moment d'un autre mariage n'est pas touché.
    const other = await wedding();
    await expect(completeProgramItem(other.organizationId, other.eventId, missing[2]!.id, { timing: "point" })).rejects.toBeInstanceOf(ProgramGapInvalidError);
    await expect(completeProgramItem(organizationId, eventId, missing[2]!.id, { endTime: "25:00" })).rejects.toBeInstanceOf(ProgramGapInvalidError);
  });

  it("diffusé incomplet, le programme dit « heure de fin à venir » aux destinataires ; un programme créé dans Symbola garde ses règles", async () => {
    const { organizationId, eventId } = await wedding();
    const importId = await startProgram(organizationId, eventId);
    await confirmProgramImport({ organizationId, userId, importId });
    const version = await publishEventProgram({ organizationId, eventId, userId });
    const published = await getEventProgramVersion(organizationId, eventId, version.number);
    const pending = published!.items.filter((item) => item.endPending === true);
    expect(pending.length).toBe(missingEndItems((await getEventProgram(organizationId, eventId)).items).length);
    expect(published!.items.find((item) => item.label === "Coucher du soleil")?.endPending).toBeUndefined();
    expect(await programAwaitsEnds(organizationId, (await wedding()).eventId)).toBe(false);
  });

  it("« Retirer cet import… » retire les moments et les journées créés, et l'annuaire gardé", async () => {
    const { organizationId, eventId } = await wedding();
    const importId = await startProgram(organizationId, eventId);
    await confirmProgramImport({ organizationId, userId, importId });
    expect((await getImportLeftovers(db, organizationId, importId))?.directory).toHaveLength(8);
    expect((await undoImport({ organizationId, userId, importId })).status).toBe("done");
    expect((await getEventProgram(organizationId, eventId)).items).toEqual([]);
    expect(await getImportLeftovers(db, organizationId, importId)).toBeNull();
  });
});

describe("PRE-01 — L'annuaire du programme ajouté au carnet (lot 71e, critère 8)", () => {
  it("« Ajouter les téléphones » complète les fiches du carnet sans double ; les mariés et l'agence ne sont jamais ajoutés ; l'annuaire est ensuite effacé", async () => {
    const { organizationId, eventId } = await wedding();
    const { vendor: dj } = await createVendor(organizationId, { name: "Ondes Sonores" });
    const { vendor: iris } = await createVendor(organizationId, { name: "Iris Beauté", phone: "06 00 00 00 00" });
    const importId = await startProgram(organizationId, eventId);
    await confirmProgramImport({ organizationId, userId, importId });
    const directory = await getImportDirectory(organizationId, importId);
    const fate = (company: string) => directory?.find((entry) => entry.company === company)?.fate;
    expect(fate("Ondes Sonores")).toBe("add_phone");
    expect(fate("Iris Beauté")).toBe("up_to_date");
    expect(directory?.filter((entry) => entry.fate === "agency").map((entry) => entry.company)).toEqual(["Atelier Exemple"]);
    expect(directory?.some((entry) => entry.fate === "couple")).toBe(true);
    const before = (await findVendors({ organizationId, limit: 60 })).length;
    const added = await addDirectoryToCarnet(organizationId, importId);
    expect(added?.phones).toBe(1);
    expect((await getVendor(organizationId, dj.id))?.phone).toBe("06 39 98 02 03");
    expect((await getVendor(organizationId, iris.id))?.phone).toBe("06 00 00 00 00");
    const after = await findVendors({ organizationId, limit: 60 });
    expect(after.length).toBe(before + (added?.created ?? 0));
    expect(after.filter((vendor) => vendor.name === "Ondes Sonores")).toHaveLength(1);
    expect(after.some((vendor) => /Atelier Exemple|Mariée|Clémence/.test(vendor.name))).toBe(false);
    expect(await getImportLeftovers(db, organizationId, importId)).toBeNull();
    expect(await addDirectoryToCarnet(organizationId, importId)).toBeNull();
  });
});

describe("SEC-13, SEC-21 — Abus et contrôle des fichiers (lot 71e)", () => {
  it("une autre organisation ne lit, ne confirme ni ne complète l'import ; son annuaire lui est caché", async () => {
    const mine = await wedding();
    const other = await wedding();
    const importId = await startProgram(mine.organizationId, mine.eventId);
    expect(await getProgramImportView(other.organizationId, importId)).toBeNull();
    expect(await confirmProgramImport({ organizationId: other.organizationId, userId, importId })).toEqual({ status: "not_found" });
    expect(await savePdfImportDecisions(db, { organizationId: other.organizationId, importId, decisions: { coupleConfirmed: true } })).toBe(false);
    await confirmProgramImport({ organizationId: mine.organizationId, userId, importId });
    expect(await getImportDirectory(other.organizationId, importId)).toBeNull();
    expect(await addDirectoryToCarnet(other.organizationId, importId)).toBeNull();
    expect((await undoImport({ organizationId: other.organizationId, userId, importId })).status).toBe("not_found");
  });

  it("le fichier de test de l'antivirus, un fichier qui n'est pas un PDF, et un PDF d'une autre sorte sont refusés sans rien garder", async () => {
    const { organizationId, eventId } = await wedding();
    const eicar = new TextEncoder().encode("X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*");
    expect(await startPdfImport(db, { organizationId, userId, entityType: "program", fileName: "x.pdf", bytes: eicar, targetEventId: eventId })).toEqual({ status: "rejected", reason: "infected" });
    expect(await startPdfImport(db, { organizationId, userId, entityType: "program", fileName: "x.pdf", bytes: new TextEncoder().encode("Heure;Titre\n10:00;Arrivée"), targetEventId: eventId })).toEqual({ status: "rejected", reason: "not_pdf" });
    expect(await startPdfImport(db, { organizationId, userId, entityType: "program", fileName: "x.pdf", bytes: vendorsPdf, targetEventId: eventId })).toEqual({ status: "rejected", reason: "not_program_pdf" });
    expect(await startPdfImport(db, { organizationId, userId, entityType: "event_vendors", fileName: "x.pdf", bytes: programPdf, targetEventId: eventId })).toEqual({ status: "rejected", reason: "not_event_vendors_pdf" });
  });
});
