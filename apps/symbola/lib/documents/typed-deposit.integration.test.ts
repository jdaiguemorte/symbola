// Lot 63c (DOC-01, BUD-04 ; maquette M8) — déposer une pièce au bon endroit, contre un vrai
// PostgreSQL (RLS), le stockage privé (Garage) et l'antivirus : une pièce d'un prestataire se
// rattache à sa ligne du budget avec sa nature, sans prestataire elle va dans le dossier de son type ;
// « Déplacer vers… » change la nature ; tests d'abus entre organisations et entre évènements.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import {
  addDefaultVendorSlots,
  addVendorCandidate,
  createProspect,
  createProspectSource,
  createTypedDocumentFolders,
  EventNotFoundError,
  listEventDocumentFolders,
  listEventDocuments,
  listEventVendorSlots,
  listTypedDocumentFolders,
} from "@/modules/events/service";
import { BudgetLineNotFoundError, listBudgetLines, setBudgetLineAttachmentKind, updateBudgetLine } from "@/modules/budget/service";
import { depositTypedDocument } from "./typed-deposit";

const plannerId = randomUUID();
const TINY_PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1"));

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function wedding() {
  const organizationId = (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
  await addDefaultVendorSlots(organizationId, ["Traiteur", "Fleurs"]);
  const source = await createProspectSource(organizationId, "Salon");
  const { id: eventId } = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }], eventDate: "2027-06-12" });
  const slots = await listEventVendorSlots(organizationId, eventId);
  const caterer = slots.find((slot) => slot.label === "Traiteur")!;
  const florist = slots.find((slot) => slot.label === "Fleurs")!;
  await updateBudgetLine({ organizationId, eventId, eventVendorSlotId: caterer.id, field: "estimated", amountCents: 800000, changedByUserId: plannerId });
  const saveurs = await addVendorCandidate({ organizationId, eventId, vendorSlotId: caterer.id, vendorName: "Les Saveurs", vendorId: null });
  const floreal = await addVendorCandidate({ organizationId, eventId, vendorSlotId: florist.id, vendorName: "Atelier Floréal", vendorId: null });
  return { organizationId, eventId, saveurs, floreal };
}

const deposit = (context: { organizationId: string; eventId: string }, values: Partial<Parameters<typeof depositTypedDocument>[0]>) =>
  depositTypedDocument({ organizationId: context.organizationId, userId: plannerId, eventId: context.eventId, locale: "fr", kind: "other", candidateId: null, folderId: null, label: "devis-traiteur-v2", content: TINY_PDF, ...values });

describe("DOC-01, BUD-04 — Déposer un document au bon endroit (lot 63c, M8)", () => {
  it("le devis d'un prestataire se rattache à sa ligne du budget, avec sa nature", async () => {
    const context = await wedding();
    const result = await deposit(context, { kind: "vendor_quotes", candidateId: context.saveurs.id });
    expect(result).toMatchObject({ destination: "budget_line", lineLabel: "Traiteur" });
    const line = (await listBudgetLines(context.organizationId, context.eventId)).lines.find((entry) => entry.label === "Traiteur")!;
    expect(line.attachments.map((attachment) => attachment.kind)).toEqual(["quote"]);
    // Rien dans les documents de l'équipe : la pièce n'est stockée qu'une fois.
    expect(await listEventDocuments(context.organizationId, context.eventId)).toEqual([]);
  });

  it("un poste sans ligne de budget en reçoit une, au nom du poste et du prestataire", async () => {
    const context = await wedding();
    await deposit(context, { kind: "vendor_invoices", candidateId: context.floreal.id });
    const line = (await listBudgetLines(context.organizationId, context.eventId)).lines.find((entry) => entry.vendorCandidateId === context.floreal.id)!;
    expect(line).toMatchObject({ label: "Fleurs", vendorName: "Atelier Floréal" });
    expect(line.attachments.map((attachment) => attachment.kind)).toEqual(["invoice"]);
  });

  it("sans prestataire, la pièce va dans le dossier de son type, créé s'il manque ; « autre » va dans « Divers »", async () => {
    const context = await wedding();
    await deposit(context, { kind: "contracts", label: "Contrat de location" });
    await deposit(context, { kind: "contracts", label: "Avenant" });
    await deposit(context, { kind: "other", label: "Plan d'accès" });
    const folders = await listEventDocumentFolders(context.organizationId, context.eventId);
    expect(folders.map((folder) => folder.name)).toEqual(["Contrats"]);
    const documents = await listEventDocuments(context.organizationId, context.eventId);
    expect(Object.fromEntries(documents.map((document) => [document.label, document.folderId]))).toEqual({ "Contrat de location": folders[0]!.id, Avenant: folders[0]!.id, "Plan d'accès": null });
  });

  it("les dossiers proposés se créent une fois, tirés du fichier de données", async () => {
    const context = await wedding();
    await createTypedDocumentFolders(context.organizationId, context.eventId, "fr");
    await createTypedDocumentFolders(context.organizationId, context.eventId, "fr");
    expect((await listEventDocumentFolders(context.organizationId, context.eventId)).map((folder) => folder.name).sort()).toEqual(["Contrats", "Devis des prestataires", "Factures des prestataires"]);
    expect((await listTypedDocumentFolders(context.organizationId, context.eventId, "fr")).every((folder) => folder.folderId !== null)).toBe(true);
  });

  it("« Déplacer vers… » une pièce de ligne change sa nature, et elle reste sur sa ligne", async () => {
    const context = await wedding();
    await deposit(context, { kind: "vendor_quotes", candidateId: context.saveurs.id });
    const [attachment] = (await listBudgetLines(context.organizationId, context.eventId)).lines.flatMap((line) => line.attachments);
    await setBudgetLineAttachmentKind(context.organizationId, context.eventId, attachment!.id, "invoice");
    expect((await listBudgetLines(context.organizationId, context.eventId)).lines.flatMap((line) => line.attachments.map((entry) => entry.kind))).toEqual(["invoice"]);
  });

  it("abus : un prestataire, une pièce ou un évènement d'une autre organisation est refusé, sans rien écrire", async () => {
    const mine = await wedding();
    const other = await wedding();
    // Le prestataire d'une autre organisation, sur mon évènement.
    await expect(deposit(mine, { kind: "vendor_quotes", candidateId: other.saveurs.id })).rejects.toBeInstanceOf(EventNotFoundError);
    // Mon prestataire, déposé par l'autre organisation sur mon évènement.
    await expect(deposit({ organizationId: other.organizationId, eventId: mine.eventId }, { kind: "vendor_quotes", candidateId: mine.saveurs.id })).rejects.toBeInstanceOf(EventNotFoundError);
    expect((await listBudgetLines(mine.organizationId, mine.eventId)).lines.flatMap((line) => line.attachments)).toEqual([]);

    await deposit(mine, { kind: "vendor_quotes", candidateId: mine.saveurs.id });
    const [attachment] = (await listBudgetLines(mine.organizationId, mine.eventId)).lines.flatMap((line) => line.attachments);
    await expect(setBudgetLineAttachmentKind(other.organizationId, mine.eventId, attachment!.id, "contract")).rejects.toBeInstanceOf(BudgetLineNotFoundError);
    // La bonne organisation, mais un autre de ses évènements.
    await expect(setBudgetLineAttachmentKind(mine.organizationId, randomUUID(), attachment!.id, "contract")).rejects.toBeInstanceOf(BudgetLineNotFoundError);
    expect((await listBudgetLines(mine.organizationId, mine.eventId)).lines.flatMap((line) => line.attachments.map((entry) => entry.kind))).toEqual(["quote"]);
  });
});
