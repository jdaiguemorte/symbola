// Lot 29b (JRJ-04, décision D8) — documents de l'événement et documents embarqués,
// contre un vrai PostgreSQL (RLS), le stockage privé (Garage) et l'antivirus : envoi
// contrôlé, renommage, suppression (fichier compris), choix pour le jour J ; tests
// d'abus (autre organisation, source inconnue) ; RGPD (trouvé par l'intitulé, rendu
// avec l'événement, supprimé à l'oubli, fichier compris).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { EICAR_TEST_STRING } from "@symbola/files";
import {
  attachEventDocument,
  createProspect,
  createProspectSource,
  DayDocumentSourceError,
  EventDocumentNotFoundError,
  EventDocumentRejectedError,
  EventNotFoundError,
  getEventDocumentFile,
  listDayDocumentChoices,
  listEventDocuments,
  removeEventDocument,
  renameEventDocument,
  setDayDocumentEmbedded,
} from "./service";
import { eventsPrivacy } from "./privacy";

const plannerId = randomUUID();
const TINY_PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1"));
const rules = { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 };

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
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-06-12" });
  return { organizationId, eventId: event.id };
}

describe("JRJ-04 — Documents de l'événement (décision D8)", () => {
  it("un PDF s'envoie, se lit, se renomme ; il se supprime avec son fichier et son choix pour le jour J", async () => {
    const { organizationId, eventId } = await wedding();
    const document = await attachEventDocument({ organizationId, eventId, label: "  Plan de table  ", content: TINY_PDF, uploadedByUserId: plannerId });
    expect(document).toMatchObject({ eventId, label: "Plan de table", mime: "application/pdf", sizeBytes: TINY_PDF.byteLength });
    expect(await listEventDocuments(organizationId, eventId)).toEqual([document]);
    const file = await getEventDocumentFile(organizationId, document.id);
    expect([file.contentType, file.fileName, Buffer.from(file.data).equals(Buffer.from(TINY_PDF))]).toEqual(["application/pdf", "Plan-de-table.pdf", true]);

    await renameEventDocument(organizationId, document.id, "Plan de table v2");
    expect((await listEventDocuments(organizationId, eventId))[0]!.label).toBe("Plan de table v2");

    await setDayDocumentEmbedded({ organizationId, eventId, source: "event_document", sourceId: document.id, embedded: true });
    await setDayDocumentEmbedded({ organizationId, eventId, source: "event_document", sourceId: document.id, embedded: true });
    expect(await listDayDocumentChoices(organizationId, eventId)).toEqual([{ source: "event_document", sourceId: document.id }]);

    await removeEventDocument(organizationId, document.id);
    expect(await listEventDocuments(organizationId, eventId)).toEqual([]);
    expect(await listDayDocumentChoices(organizationId, eventId)).toEqual([]);
    await expect(getEventDocumentFile(organizationId, document.id)).rejects.toBeInstanceOf(EventDocumentNotFoundError);
  });

  it("refus clairs, sans rien enregistrer : intitulé vide ou trop long, type non reconnu, fichier de test antivirus", async () => {
    const { organizationId, eventId } = await wedding();
    const attach = (label: string, content: Uint8Array) => attachEventDocument({ organizationId, eventId, label, content, uploadedByUserId: plannerId });
    await expect(attach("   ", TINY_PDF)).rejects.toMatchObject({ reason: "label" });
    await expect(attach("x".repeat(201), TINY_PDF)).rejects.toMatchObject({ reason: "label" });
    await expect(attach("Notes", new TextEncoder().encode("bonjour"))).rejects.toMatchObject({ reason: "unsupported_type" });
    // Le fichier de test antivirus, tel quel : refusé avant tout stockage (ClamAV le
    // détecte seul, packages/files/src/upload-service.integration.test.ts).
    await expect(attach("Virus", new TextEncoder().encode(EICAR_TEST_STRING))).rejects.toBeInstanceOf(EventDocumentRejectedError);
    expect(await listEventDocuments(organizationId, eventId)).toEqual([]);
  });

  it("abus : une autre organisation ne lit, ne renomme, ne supprime ni n'embarque rien ; une source inconnue est refusée", async () => {
    const mine = await wedding();
    const other = await wedding();
    const document = await attachEventDocument({ organizationId: mine.organizationId, eventId: mine.eventId, label: "Plan B", content: TINY_PDF, uploadedByUserId: plannerId });

    expect(await listEventDocuments(other.organizationId, mine.eventId)).toEqual([]);
    await expect(getEventDocumentFile(other.organizationId, document.id)).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    await expect(renameEventDocument(other.organizationId, document.id, "Intrus")).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    await expect(removeEventDocument(other.organizationId, document.id)).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    await expect(attachEventDocument({ organizationId: other.organizationId, eventId: mine.eventId, label: "Intrus", content: TINY_PDF, uploadedByUserId: plannerId })).rejects.toBeInstanceOf(
      EventNotFoundError,
    );
    await expect(setDayDocumentEmbedded({ organizationId: other.organizationId, eventId: mine.eventId, source: "event_document", sourceId: document.id, embedded: true })).rejects.toBeInstanceOf(
      DayDocumentSourceError,
    );
    await expect(
      setDayDocumentEmbedded({ organizationId: mine.organizationId, eventId: mine.eventId, source: "vendor_file" as never, sourceId: document.id, embedded: true }),
    ).rejects.toBeInstanceOf(DayDocumentSourceError);
    expect(await listDayDocumentChoices(mine.organizationId, mine.eventId)).toEqual([]);
    expect((await listEventDocuments(mine.organizationId, mine.eventId))[0]!.label).toBe("Plan B");
  });
});

describe("RGPD-01, RGPD-03 — Documents de l'événement (lot 29b)", () => {
  it("trouvé par son intitulé, rendu avec l'événement ; supprimé à l'oubli, fichier et choix du jour J compris", async () => {
    const { organizationId, eventId } = await wedding();
    const document = await attachEventDocument({ organizationId, eventId, label: "Plan de table Martin", content: TINY_PDF, uploadedByUserId: plannerId });
    await setDayDocumentEmbedded({ organizationId, eventId, source: "event_document", sourceId: document.id, embedded: true });

    const found = await eventsPrivacy.find({ organizationId, terms: { name: "Martin" } });
    expect(found.filter((record) => record.kind === "event_document").map((record) => record.recordId)).toEqual([document.id]);
    const related = await eventsPrivacy.related!({ organizationId, eventIds: [eventId] });
    expect(related.find((record) => record.kind === "event_document")).toMatchObject({ recordId: document.id, label: "Plan de table Martin", fields: { mime: "application/pdf" } });

    const records = [{ kind: "event_document", recordId: document.id }];
    expect(await eventsPrivacy.planErasure({ organizationId, records, rules, today: "2026-11-12" })).toEqual([
      { kind: "event_document", recordId: document.id, fate: "deleted", legalBasis: null, keptUntil: null },
    ]);
    await eventsPrivacy.erase({ organizationId, records, rules, today: "2026-11-12" });
    expect(await listEventDocuments(organizationId, eventId)).toEqual([]);
    expect(await listDayDocumentChoices(organizationId, eventId)).toEqual([]);
    await expect(getEventDocumentFile(organizationId, document.id)).rejects.toBeInstanceOf(EventDocumentNotFoundError);
  });
});
