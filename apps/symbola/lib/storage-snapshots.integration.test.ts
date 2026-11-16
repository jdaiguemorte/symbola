// Lot 37b (DOC-12 ; D12, D13 ; ADR 0071) — relevé mensuel du stockage, contre un vrai PostgreSQL
// (RLS) et un vrai Garage. Horloge simulée pour le mois du relevé. Les fichiers sont décrits en base
// (tailles connues) ; seuls ceux d'avant le lot 37b, sans taille, sont lus au stockage, une fois.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { budgetLineAttachments, budgetLines } from "@symbola/db/schema/budget";
import { eventDocuments, eventDocumentVersions, events, eventTaskAttachments, eventTasks, eventVendorCandidates, eventVendorSlots } from "@symbola/db/schema/events";
import { organizationProfiles } from "@symbola/db/schema/hub";
import { originalDocuments, quotes, quoteVersions, signatureRequests } from "@symbola/db/schema/quotes";
import { vendorFiles, vendors } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, deletePrivateObject, uploadPrivateObject } from "@symbola/files";
import { getLatestStorageTotals, listStorageSnapshots } from "@/modules/hub/service";
import { measureOrganizationStorage, takeStorageSnapshots } from "./storage-snapshots";

const userId = randomUUID();

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

const organization = async () => (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
const inOrganization = <T>(organizationId: string, work: Parameters<typeof withOrganization<T>>[2]) => withDb((db) => withOrganization(db, organizationId, work));

// Un évènement réel avec chaque sorte de fichier, un évènement d'essai, un logo et le carnet.
async function seed(organizationId: string) {
  await inOrganization(organizationId, async (tx) => {
    const [event] = await tx.insert(events).values({ organizationId }).returning();
    const [demo] = await tx.insert(events).values({ organizationId, isDemo: true }).returning();
    const eventId = event!.id;
    const document = (label: string, mime: string, sizes: number[], onEvent = eventId) =>
      tx
        .insert(eventDocuments)
        .values({ organizationId, eventId: onEvent, label, fileKey: `${organizationId}/${randomUUID()}`, mime, sizeBytes: sizes.at(-1)!, uploadedByUserId: userId })
        .returning()
        .then(([row]) => tx.insert(eventDocumentVersions).values(sizes.map((size, index) => ({ organizationId, documentId: row!.id, version: index + 1, fileKey: `${organizationId}/${randomUUID()}`, mime, sizeBytes: size, uploadedByUserId: userId }))));
    await document("Plan de table", "application/pdf", [1000, 1500]);
    await document("Photo du lieu", "image/jpeg", [3000]);
    await document("Document d'essai", "application/pdf", [99_999], demo!.id);
    const [task] = await tx.insert(eventTasks).values({ organizationId, eventId, label: "Envoyer le plan", dueDate: "2027-05-01" }).returning();
    await tx.insert(eventTaskAttachments).values({ organizationId, eventId, taskId: task!.id, label: "Plan", fileKey: `${organizationId}/${randomUUID()}`, mime: "application/pdf", sizeBytes: 800, uploadedByUserId: userId });
    const [slot] = await tx.insert(eventVendorSlots).values({ organizationId, eventId, label: "Traiteur" }).returning();
    await tx.insert(eventVendorCandidates).values({ organizationId, eventId, vendorSlotId: slot!.id, vendorName: "Traiteur Karim", quoteFileKey: `${organizationId}/${randomUUID()}`, quoteMime: "application/pdf", quoteSizeBytes: 1200 });
    const [line] = await tx.insert(budgetLines).values({ organizationId, eventId, eventVendorSlotId: slot!.id, label: "Traiteur" }).returning();
    await tx.insert(budgetLineAttachments).values({ organizationId, lineId: line!.id, fileKey: `${organizationId}/${randomUUID()}`, mime: "application/pdf", sizeBytes: 600, uploadedByUserId: userId });
    const [vendor] = await tx.insert(vendors).values({ organizationId, name: "Fleurs de Lyon" }).returning();
    await tx.insert(vendorFiles).values({ organizationId, vendorId: vendor!.id, kind: "brochure", fileName: "plaquette.pdf", fileKey: `${organizationId}/${randomUUID()}`, mime: "application/pdf", sizeBytes: 900, uploadedByUserId: userId });
    const [quote] = await tx.insert(quotes).values({ organizationId, eventId, number: `D-${randomUUID().slice(0, 8)}`, createdByUserId: userId }).returning();
    const [version] = await tx.insert(quoteVersions).values({ organizationId, quoteId: quote!.id, version: 1 }).returning();
    await tx.insert(signatureRequests).values({ organizationId, versionId: version!.id, provider: "fictif", externalId: randomUUID(), status: "completed", signedDocumentKey: `${organizationId}/${randomUUID()}`, auditCertificateKey: `${organizationId}/${randomUUID()}`, signedDocumentSizeBytes: 2000, auditCertificateSizeBytes: 500 });
    await tx.insert(originalDocuments).values({ organizationId, documentKind: "invoice", documentId: randomUUID(), storageKey: `${organizationId}/${randomUUID()}`, sha256: "a".repeat(64), byteSize: 4000 });
  });
  await withDb((db) => db.insert(organizationProfiles).values({ organizationId, logoKey: `${organizationId}/logo.png`, logoSizeBytes: 700 }));
}

const EXPECTED = {
  legal_originals: { files: 1, bytes: 4000 },
  signed_documents: { files: 2, bytes: 2500 },
  // Deux versions du plan, la pièce jointe, le devis du candidat, la pièce du budget, la plaquette.
  uploads: { files: 6, bytes: 1000 + 1500 + 800 + 1200 + 600 + 900 },
  // La photo du lieu et le logo ; jamais le document de l'évènement d'essai.
  images: { files: 2, bytes: 3000 + 700 },
};

describe("DOC-12 — Compteur de stockage par organisation et par nature", () => {
  it("le relevé du premier du mois compte chaque nature, sans les évènements d'essai ni les exports", async () => {
    const organizationId = await organization();
    await seed(organizationId);
    const run = await takeStorageSnapshots({ now: new Date("2026-12-01T00:05:00+01:00"), organizationIds: [organizationId] });
    expect(run).toEqual({ month: "2026-12-01", taken: [organizationId], failed: [] });
    const [december] = await listStorageSnapshots(organizationId);
    expect(december).toMatchObject({ month: "2026-12-01", takenAt: "2026-11-30T23:05:00.000Z", natures: EXPECTED, files: 11, bytes: 4000 + 2500 + 6000 + 3700 });
  });

  it("un relevé par mois, gardé d'un mois sur l'autre ; deux passages dans le mois n'en font qu'un", async () => {
    const organizationId = await organization();
    await seed(organizationId);
    const options = { organizationIds: [organizationId] };
    expect((await takeStorageSnapshots({ ...options, now: new Date("2026-11-16T08:00:00Z") })).taken).toEqual([organizationId]);
    await inOrganization(organizationId, async (tx) => {
      const [event] = await tx.select().from(events).where(eq(events.isDemo, false));
      const [task] = await tx.select().from(eventTasks).where(eq(eventTasks.eventId, event!.id));
      await tx.insert(eventTaskAttachments).values({ organizationId, eventId: event!.id, taskId: task!.id, label: "Menu", fileKey: `${organizationId}/${randomUUID()}`, mime: "application/pdf", sizeBytes: 5000, uploadedByUserId: userId });
    });
    // La veille au soir du 1er décembre (heure de Paris) : encore novembre, déjà relevé.
    expect((await takeStorageSnapshots({ ...options, now: new Date("2026-11-30T22:59:00Z") })).taken).toEqual([]);
    expect((await takeStorageSnapshots({ ...options, now: new Date("2026-11-30T23:01:00Z") })).taken).toEqual([organizationId]);
    expect((await takeStorageSnapshots({ ...options, now: new Date("2026-12-15T10:00:00Z") })).taken).toEqual([]);

    const [december, november] = await listStorageSnapshots(organizationId);
    expect(november).toMatchObject({ month: "2026-11-01", natures: { uploads: EXPECTED.uploads } });
    expect(december).toMatchObject({ month: "2026-12-01", natures: { uploads: { files: 7, bytes: EXPECTED.uploads.bytes + 5000 } } });
  });

  it("D13 — une taille manquante est lue une fois au stockage, puis gardée", async () => {
    const organizationId = await organization();
    const storage = createStorageClient();
    const keys = { logo: `test/${randomUUID()}.png`, signed: `test/${randomUUID()}.pdf`, certificate: `test/${randomUUID()}.pdf` };
    await uploadPrivateObject(storage, { key: keys.logo, body: Buffer.alloc(321, 1), contentType: "image/png" });
    await uploadPrivateObject(storage, { key: keys.signed, body: Buffer.alloc(2048, 1), contentType: "application/pdf" });
    await uploadPrivateObject(storage, { key: keys.certificate, body: Buffer.alloc(512, 1), contentType: "application/pdf" });
    await withDb((db) => db.insert(organizationProfiles).values({ organizationId, logoKey: keys.logo }));
    const requestId = await inOrganization(organizationId, async (tx) => {
      const [quote] = await tx.insert(quotes).values({ organizationId, eventId: randomUUID(), number: "D-2026-0001", createdByUserId: userId }).returning();
      const [version] = await tx.insert(quoteVersions).values({ organizationId, quoteId: quote!.id, version: 1 }).returning();
      const [request] = await tx.insert(signatureRequests).values({ organizationId, versionId: version!.id, provider: "fictif", externalId: randomUUID(), status: "completed", signedDocumentKey: keys.signed, auditCertificateKey: keys.certificate }).returning();
      return request!.id;
    });

    const first = await measureOrganizationStorage(organizationId);
    expect(first.images).toEqual({ files: 1, bytes: 321 });
    expect(first.signed_documents).toEqual({ files: 2, bytes: 2560 });
    const [profile] = await withDb((db) => db.select().from(organizationProfiles).where(eq(organizationProfiles.organizationId, organizationId)));
    expect(profile!.logoSizeBytes).toBe(321);
    const [request] = await inOrganization(organizationId, (tx) => tx.select().from(signatureRequests).where(eq(signatureRequests.id, requestId)));
    expect([request!.signedDocumentSizeBytes, request!.auditCertificateSizeBytes]).toEqual([2048, 512]);

    // Gardée : le stockage n'est plus lu (les objets retirés, le relevé ne change pas).
    for (const key of Object.values(keys)) await deletePrivateObject(storage, key);
    expect(await measureOrganizationStorage(organizationId)).toEqual(first);
  });

  it("l'Admin lit les totaux par organisation, des nombres sans aucun nom de fichier (SEC-09)", async () => {
    const organizationId = await organization();
    const empty = await organization();
    await seed(organizationId);
    await takeStorageSnapshots({ now: new Date("2026-11-16T08:00:00Z"), organizationIds: [organizationId] });
    const totals = await getLatestStorageTotals([organizationId, empty]);
    expect(totals).toEqual({ [organizationId]: { month: "2026-11-01", takenAt: "2026-11-16T08:00:00.000Z", files: 11, bytes: 16_200 }, [empty]: null });
    expect(JSON.stringify(totals)).not.toMatch(/pdf|png|Plan|plaquette|Karim|logo/i);
  });

  it("isolation : le relevé d'une organisation ne compte jamais les fichiers d'une autre, ni ne se lit d'ailleurs", async () => {
    const organizationId = await organization();
    const other = await organization();
    await seed(organizationId);
    await seed(other);
    await takeStorageSnapshots({ now: new Date("2026-11-16T08:00:00Z"), organizationIds: [organizationId, other] });
    expect((await listStorageSnapshots(organizationId))[0]!.natures).toEqual(EXPECTED);
    expect((await listStorageSnapshots(other))[0]!.natures).toEqual(EXPECTED);
    expect((await listStorageSnapshots(await organization())).length).toBe(0);
  });
});
