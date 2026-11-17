// Lot 37a (DOC-01, DOC-04, POR-04, POR-10 ; décisions D3, D4, D6, D7 ; ADR 0070) — espace documents
// d'un évènement, contre un vrai PostgreSQL (RLS), le stockage privé (Garage) et l'antivirus :
// dossiers, versions, partage avec les clients et les prestataires, liens de partage à durée
// limitée (horloge simulée). Tests d'abus : autre organisation, lien d'un autre évènement, lien
// expiré ou révoqué. RGPD : dossier trouvé par son nom, oubli d'un document avec toutes ses
// versions et les ouvertures de ses liens.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { eventActivities, eventDocumentLinks, eventDocumentVersions } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { createStorageClient, PrivateObjectNotFoundError, readPrivateObject } from "@symbola/files";
import type { EventLinkRights } from "@symbola/contracts";
import {
  addEventDocumentVersion,
  addEventVendorSlot,
  addVendorCandidate,
  attachEventDocument,
  createEventDocumentFolder,
  createEventDocumentLink,
  createEventLink,
  createProspect,
  createProspectSource,
  EventDocumentNotFoundError,
  EventDocumentRejectedError,
  EventNotFoundError,
  getEventDocumentFile,
  getEventDocumentVersionFile,
  getLinkSharedDocumentFile,
  LinkAccessDeniedError,
  listDayDocumentChoices,
  listEventActivity,
  listEventDocumentFolders,
  listEventDocumentLinks,
  listEventDocuments,
  listEventDocumentVersions,
  listLinkSharedDocuments,
  purgeTrashedEventObjects,
  restoreEventDocument,
  moveEventDocument,
  openEventDocumentLink,
  removeEventDocument,
  removeEventDocumentFolder,
  renameEventDocumentFolder,
  revokeEventDocumentLink,
  revokeEventLink,
  setDayDocumentEmbedded,
  setEventDocumentSharing,
} from "./service";
import { eventsPrivacy } from "./privacy";

const plannerId = randomUUID();
const TINY_PDF = new Uint8Array(Buffer.from("%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1"));
const SECOND_PDF = new Uint8Array(Buffer.from("%PDF-1.4\n% version 2\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n", "latin1"));
const TINY_PNG = new Uint8Array(Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64"));
const NO_RIGHTS: EventLinkRights = { rubrics: [], budgetScope: "all", sharedSlotIds: [] };
const DAY = 86_400_000;
const rules = { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 };

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

function rows<T>(organizationId: string, fn: Parameters<typeof withOrganization<T>>[2]) {
  return withDb((db) => withOrganization(db, organizationId, fn));
}

async function wedding(organizationId?: string) {
  const org = organizationId ?? (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
  const source = await createProspectSource(org, "Salon");
  const event = await createProspect({ organizationId: org, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }], eventDate: "2027-06-12" });
  return { organizationId: org, eventId: event.id };
}

async function attach(organizationId: string, eventId: string, label: string, content: Uint8Array = TINY_PDF, folderId?: string | null) {
  return attachEventDocument({ organizationId, eventId, label, content, uploadedByUserId: plannerId, folderId });
}

async function clientLink(organizationId: string, eventId: string) {
  return (await createEventLink({ organizationId, eventId, createdByUserId: plannerId, audience: "client", locale: "fr", link: { personName: "Léa", email: `lea-${randomUUID()}@example.test`, rights: NO_RIGHTS } })).link;
}

async function vendorLink(organizationId: string, eventId: string) {
  const slot = await addEventVendorSlot(organizationId, eventId, "Traiteur");
  const vendor = await addVendorCandidate({ organizationId, eventId, vendorSlotId: slot.id, vendorName: "Traiteur Karim" });
  return (
    await createEventLink({ organizationId, eventId, createdByUserId: plannerId, audience: "vendor", vendorCandidateId: vendor.id, locale: "fr", link: { personName: "Karim", email: `karim-${randomUUID()}@example.test`, rights: NO_RIGHTS } })
  ).link;
}

async function storedKeys(organizationId: string, documentId: string): Promise<string[]> {
  return (await rows(organizationId, (tx) => tx.select({ key: eventDocumentVersions.fileKey }).from(eventDocumentVersions).where(eq(eventDocumentVersions.documentId, documentId)))).map((row) => row.key);
}

async function expectGoneFromStorage(keys: string[]) {
  const storage = createStorageClient();
  for (const key of keys) await expect(readPrivateObject(storage, key)).rejects.toBeInstanceOf(PrivateObjectNotFoundError);
}

describe("DOC-01 — Espace documents par évènement : dossiers et versions (D3, D4)", () => {
  it("un document déposé sans dossier va dans « Divers » ; il se range dans un dossier de son évènement, jamais d'un autre", async () => {
    const { organizationId, eventId } = await wedding();
    const other = await wedding(organizationId);
    const plans = await createEventDocumentFolder(organizationId, eventId, "  Plans  ");
    const elsewhere = await createEventDocumentFolder(organizationId, other.eventId, "Ailleurs");
    expect(plans).toMatchObject({ eventId, name: "Plans" });

    const loose = await attach(organizationId, eventId, "Plan B");
    expect(loose).toMatchObject({ folderId: null, version: 1, sharedWithClients: false, sharedWithVendors: false });
    const filed = await attach(organizationId, eventId, "Plan du domaine", TINY_PDF, plans.id);
    expect(filed.folderId).toBe(plans.id);

    await moveEventDocument(organizationId, loose.id, plans.id);
    await moveEventDocument(organizationId, filed.id, null);
    const byId = new Map((await listEventDocuments(organizationId, eventId)).map((document) => [document.id, document.folderId]));
    expect([byId.get(loose.id), byId.get(filed.id)]).toEqual([plans.id, null]);

    // Le dossier d'un autre évènement est refusé, au dépôt comme au rangement.
    await expect(moveEventDocument(organizationId, loose.id, elsewhere.id)).rejects.toMatchObject({ reason: "folder" });
    await expect(attach(organizationId, eventId, "Intrus", TINY_PDF, elsewhere.id)).rejects.toMatchObject({ reason: "folder" });
    expect((await listEventDocuments(organizationId, eventId)).map((document) => document.label).sort()).toEqual(["Plan B", "Plan du domaine"]);
  });

  it("un dossier se nomme (1 à 80 caractères), se renomme ; retiré, ses documents vont dans « Divers », aucun n'est supprimé", async () => {
    const { organizationId, eventId } = await wedding();
    await expect(createEventDocumentFolder(organizationId, eventId, "   ")).rejects.toBeInstanceOf(EventDocumentRejectedError);
    await expect(createEventDocumentFolder(organizationId, eventId, "x".repeat(81))).rejects.toMatchObject({ reason: "folder" });
    const traiteur = await createEventDocumentFolder(organizationId, eventId, "traiteur");
    await createEventDocumentFolder(organizationId, eventId, "Plans");
    await renameEventDocumentFolder(organizationId, traiteur.id, "Traiteur");
    expect((await listEventDocumentFolders(organizationId, eventId)).map((folder) => folder.name)).toEqual(["Plans", "Traiteur"]);

    const menu = await attach(organizationId, eventId, "Menu", TINY_PDF, traiteur.id);
    await removeEventDocumentFolder(organizationId, traiteur.id);
    expect((await listEventDocumentFolders(organizationId, eventId)).map((folder) => folder.name)).toEqual(["Plans"]);
    expect((await listEventDocuments(organizationId, eventId)).find((document) => document.id === menu.id)?.folderId).toBeNull();
  });

  it("une nouvelle version garde les précédentes, numérotées et consultables ; la dernière est celle qu'on lit et qu'on embarque", async () => {
    const { organizationId, eventId } = await wedding();
    const document = await attach(organizationId, eventId, "Plan de table");
    await setDayDocumentEmbedded({ organizationId, eventId, source: "event_document", sourceId: document.id, embedded: true });

    const second = await addEventDocumentVersion({ organizationId, documentId: document.id, content: SECOND_PDF, uploadedByUserId: plannerId });
    expect(second).toMatchObject({ id: document.id, version: 2, sizeBytes: SECOND_PDF.byteLength });
    const third = await addEventDocumentVersion({ organizationId, documentId: document.id, content: TINY_PNG, uploadedByUserId: plannerId });
    expect(third).toMatchObject({ version: 3, mime: "image/png" });

    expect((await listEventDocumentVersions(organizationId, document.id)).map((version) => [version.version, version.mime])).toEqual([
      [3, "image/png"],
      [2, "application/pdf"],
      [1, "application/pdf"],
    ]);
    expect((await listEventDocuments(organizationId, eventId))[0]).toMatchObject({ version: 3, mime: "image/png" });
    // La dernière version est le fichier du document : aperçu, partage et jour J la suivent.
    expect(Buffer.from((await getEventDocumentFile(organizationId, document.id)).data).equals(Buffer.from(TINY_PNG))).toBe(true);
    const first = await getEventDocumentVersionFile(organizationId, document.id, 1);
    expect([Buffer.from(first.data).equals(Buffer.from(TINY_PDF)), first.fileName]).toEqual([true, "Plan-de-table-v1.pdf"]);
    expect(Buffer.from((await getEventDocumentVersionFile(organizationId, document.id, 2)).data).equals(Buffer.from(SECOND_PDF))).toBe(true);
    await expect(getEventDocumentVersionFile(organizationId, document.id, 4)).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    expect(await listDayDocumentChoices(organizationId, eventId)).toEqual([{ source: "event_document", sourceId: document.id }]);
  });

  it("une version refusée par le contrôle (type non reconnu) n'enregistre rien", async () => {
    const { organizationId, eventId } = await wedding();
    const document = await attach(organizationId, eventId, "Plan");
    await expect(addEventDocumentVersion({ organizationId, documentId: document.id, content: new TextEncoder().encode("bonjour"), uploadedByUserId: plannerId })).rejects.toMatchObject({
      reason: "unsupported_type",
    });
    expect((await listEventDocumentVersions(organizationId, document.id)).map((version) => version.version)).toEqual([1]);
  });

  // Lot 39a (HUB-17, DAT-03 ; ADR 0073) : supprimer met le document à la corbeille avec ses versions ;
  // la purge (30 jours, ou suppression définitive) efface les fichiers de toutes ses versions.
  it("supprimer un document le met à la corbeille avec ses versions ; la purge efface les fichiers de toutes ses versions", async () => {
    const { organizationId, eventId } = await wedding();
    const document = await attach(organizationId, eventId, "Plan");
    await addEventDocumentVersion({ organizationId, documentId: document.id, content: SECOND_PDF, uploadedByUserId: plannerId });
    const keys = await storedKeys(organizationId, document.id);
    expect(keys).toHaveLength(2);
    await removeEventDocument(organizationId, document.id);
    expect(await listEventDocumentVersions(organizationId, document.id)).toEqual([]);
    await restoreEventDocument(organizationId, document.id);
    expect(await listEventDocumentVersions(organizationId, document.id)).toHaveLength(2);
    await removeEventDocument(organizationId, document.id);
    expect(await purgeTrashedEventObjects(organizationId, { kind: "document", id: document.id })).toBe(1);
    await expectGoneFromStorage(keys);
  });

  it("abus : une autre organisation ne voit, ne range, ne versionne, ne partage aucun document ni dossier", async () => {
    const mine = await wedding();
    const other = await wedding();
    const folder = await createEventDocumentFolder(mine.organizationId, mine.eventId, "Plans");
    const document = await attach(mine.organizationId, mine.eventId, "Plan B");
    const intruder = other.organizationId;

    expect(await listEventDocumentFolders(intruder, mine.eventId)).toEqual([]);
    expect(await listEventDocumentVersions(intruder, document.id)).toEqual([]);
    await expect(createEventDocumentFolder(intruder, mine.eventId, "Intrus")).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(renameEventDocumentFolder(intruder, folder.id, "Intrus")).rejects.toBeInstanceOf(EventDocumentRejectedError);
    await expect(removeEventDocumentFolder(intruder, folder.id)).rejects.toBeInstanceOf(EventDocumentRejectedError);
    await expect(moveEventDocument(intruder, document.id, null)).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    await expect(addEventDocumentVersion({ organizationId: intruder, documentId: document.id, content: SECOND_PDF, uploadedByUserId: plannerId })).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    await expect(getEventDocumentVersionFile(intruder, document.id, 1)).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    await expect(setEventDocumentSharing(intruder, document.id, { clients: true, vendors: true })).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    // Le document de l'organisation ne change pas.
    expect((await listEventDocuments(mine.organizationId, mine.eventId))[0]).toMatchObject({ version: 1, sharedWithClients: false, sharedWithVendors: false, folderId: null });
    expect((await listEventDocumentFolders(mine.organizationId, mine.eventId)).map((entry) => entry.name)).toEqual(["Plans"]);
  });
});

describe("POR-10, POR-04 — Partage avec les clients et les prestataires de l'évènement (D6)", () => {
  it("rien n'est partagé par défaut : un document déposé n'apparaît ni au portail ni à l'espace du prestataire", async () => {
    const { organizationId, eventId } = await wedding();
    const document = await attach(organizationId, eventId, "Plan de table");
    const client = await clientLink(organizationId, eventId);
    const vendor = await vendorLink(organizationId, eventId);
    expect(await listLinkSharedDocuments(organizationId, client.id)).toEqual([]);
    expect(await listLinkSharedDocuments(organizationId, vendor.id)).toEqual([]);
    await expect(getLinkSharedDocumentFile(organizationId, client.id, document.id)).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    await expect(getLinkSharedDocumentFile(organizationId, vendor.id, document.id)).rejects.toBeInstanceOf(EventDocumentNotFoundError);
  });

  it("partagé avec les clients, il n'apparaît pas au prestataire ; partagé avec les prestataires, le prestataire le lit, dans sa dernière version", async () => {
    const { organizationId, eventId } = await wedding();
    const forClients = await attach(organizationId, eventId, "Plan de table");
    const forVendors = await attach(organizationId, eventId, "Plan d'accès");
    await setEventDocumentSharing(organizationId, forClients.id, { clients: true, vendors: false });
    await setEventDocumentSharing(organizationId, forVendors.id, { clients: false, vendors: true });
    await addEventDocumentVersion({ organizationId, documentId: forVendors.id, content: SECOND_PDF, uploadedByUserId: plannerId });
    const client = await clientLink(organizationId, eventId);
    const vendor = await vendorLink(organizationId, eventId);

    expect((await listLinkSharedDocuments(organizationId, client.id)).map((document) => document.label)).toEqual(["Plan de table"]);
    expect((await listLinkSharedDocuments(organizationId, vendor.id)).map((document) => [document.label, document.version])).toEqual([["Plan d'accès", 2]]);
    expect(Buffer.from((await getLinkSharedDocumentFile(organizationId, vendor.id, forVendors.id)).data).equals(Buffer.from(SECOND_PDF))).toBe(true);
    await expect(getLinkSharedDocumentFile(organizationId, vendor.id, forClients.id)).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    await expect(getLinkSharedDocumentFile(organizationId, client.id, forVendors.id)).rejects.toBeInstanceOf(EventDocumentNotFoundError);

    // Ne plus partager le retire aussitôt.
    await setEventDocumentSharing(organizationId, forClients.id, { clients: false, vendors: false });
    expect(await listLinkSharedDocuments(organizationId, client.id)).toEqual([]);
  });

  it("abus : le lien d'un autre évènement ne voit rien ; un lien révoqué est refusé", async () => {
    const { organizationId, eventId } = await wedding();
    const other = await wedding(organizationId);
    const document = await attach(organizationId, eventId, "Plan de table");
    await setEventDocumentSharing(organizationId, document.id, { clients: true, vendors: true });
    const otherClient = await clientLink(organizationId, other.eventId);
    const otherVendor = await vendorLink(organizationId, other.eventId);
    expect(await listLinkSharedDocuments(organizationId, otherClient.id)).toEqual([]);
    expect(await listLinkSharedDocuments(organizationId, otherVendor.id)).toEqual([]);
    await expect(getLinkSharedDocumentFile(organizationId, otherClient.id, document.id)).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    await expect(getLinkSharedDocumentFile(organizationId, otherVendor.id, document.id)).rejects.toBeInstanceOf(EventDocumentNotFoundError);

    const client = await clientLink(organizationId, eventId);
    await revokeEventLink(organizationId, client.id);
    await expect(listLinkSharedDocuments(organizationId, client.id)).rejects.toBeInstanceOf(LinkAccessDeniedError);
    // Une autre organisation, avec l'identifiant du lien : rien.
    const stranger = await wedding();
    await expect(listLinkSharedDocuments(stranger.organizationId, otherClient.id)).rejects.toBeInstanceOf(LinkAccessDeniedError);
  });
});

describe("DOC-04 — Partage par lien à durée limitée (D7)", () => {
  it("le lien ouvre son document seulement ; chaque ouverture est comptée et va au fil de l'évènement", async () => {
    const { organizationId, eventId } = await wedding();
    const document = await attach(organizationId, eventId, "Plan d'accès");
    await attach(organizationId, eventId, "Plan de table");
    const now = new Date("2027-05-01T08:00:00Z");
    const { link, token } = await createEventDocumentLink({ organizationId, documentId: document.id, days: 7, createdByUserId: plannerId, now });
    expect(link).toMatchObject({ documentId: document.id, expiresAt: "2027-05-08T08:00:00.000Z", revokedAt: null, openCount: 0, lastOpenedAt: null });

    const opened = await openEventDocumentLink(token, new Date("2027-05-02T10:00:00Z"));
    expect(opened).toMatchObject({ label: "Plan d'accès", mime: "application/pdf", sizeBytes: TINY_PDF.byteLength });
    expect(Buffer.from((await opened!.file()).data).equals(Buffer.from(TINY_PDF))).toBe(true);
    await openEventDocumentLink(token, new Date("2027-05-03T10:00:00Z"));

    expect((await listEventDocumentLinks(organizationId, document.id))[0]).toMatchObject({ openCount: 2, lastOpenedAt: "2027-05-03T10:00:00.000Z" });
    const activity = (await listEventActivity(organizationId, eventId)).filter((entry) => entry.kind === "document_link_opened");
    expect(activity.map((entry) => [entry.taskLabel, entry.createdAt])).toEqual(
      expect.arrayContaining([
        ["Plan d'accès", "2027-05-02T10:00:00.000Z"],
        ["Plan d'accès", "2027-05-03T10:00:00.000Z"],
      ]),
    );
    expect(activity).toHaveLength(2);
  });

  it("expiré (selon l'heure du jour d'échéance) ou révoqué, il répond comme un lien inconnu, sans le nom du fichier", async () => {
    const { organizationId, eventId } = await wedding();
    const document = await attach(organizationId, eventId, "Plan de table Martin");
    const now = new Date("2027-03-30T21:30:00Z");
    const { token } = await createEventDocumentLink({ organizationId, documentId: document.id, days: 1, createdByUserId: plannerId, now });
    // La veille de l'échéance, et le jour même une minute avant l'heure : valable.
    expect(await openEventDocumentLink(token, new Date(now.getTime() + DAY - 60_000))).not.toBeNull();
    // À l'heure de l'échéance et après : rien, comme un lien inconnu.
    expect(await openEventDocumentLink(token, new Date(now.getTime() + DAY))).toBeNull();
    expect(await openEventDocumentLink(token, new Date(now.getTime() + 2 * DAY))).toBeNull();

    const revoked = await createEventDocumentLink({ organizationId, documentId: document.id, days: 30, createdByUserId: plannerId, now });
    await revokeEventDocumentLink(organizationId, revoked.link.id, new Date(now.getTime() + 1000));
    expect(await openEventDocumentLink(revoked.token, new Date(now.getTime() + 2000))).toBeNull();
    // Un lien révoqué ne se révoque pas deux fois.
    await expect(revokeEventDocumentLink(organizationId, revoked.link.id)).rejects.toBeInstanceOf(EventDocumentNotFoundError);

    // Jeton inconnu, mal formé, ou d'une autre organisation : la même réponse.
    const secret = token.split(".")[1]!;
    expect(await openEventDocumentLink(`${organizationId}.${"A".repeat(43)}`, now)).toBeNull();
    expect(await openEventDocumentLink("n-importe-quoi", now)).toBeNull();
    expect(await openEventDocumentLink(`${(await wedding()).organizationId}.${secret}`, now)).toBeNull();
    // Ni ouverture comptée, ni ligne au fil pour un refus.
    const activity = (await listEventActivity(organizationId, eventId)).filter((entry) => entry.kind === "document_link_opened");
    expect(activity).toHaveLength(1);
  });

  it("le lien vit de 1 à 30 jours ; seule l'empreinte de son jeton est gardée", async () => {
    const { organizationId, eventId } = await wedding();
    const document = await attach(organizationId, eventId, "Plan");
    for (const days of [0, 31, 1.5, -1]) {
      await expect(createEventDocumentLink({ organizationId, documentId: document.id, days, createdByUserId: plannerId })).rejects.toMatchObject({ reason: "duration" });
    }
    const { link, token } = await createEventDocumentLink({ organizationId, documentId: document.id, days: 30, createdByUserId: plannerId });
    const [stored] = await rows(organizationId, (tx) => tx.select().from(eventDocumentLinks).where(eq(eventDocumentLinks.id, link.id)));
    const secret = token.split(".")[1]!;
    expect(stored!.tokenHash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(stored)).not.toContain(secret);
  });

  it("abus : une autre organisation ne crée, ne liste ni ne révoque les liens d'un document ; supprimer le document éteint ses liens", async () => {
    const mine = await wedding();
    const other = await wedding();
    const document = await attach(mine.organizationId, mine.eventId, "Plan");
    const { link, token } = await createEventDocumentLink({ organizationId: mine.organizationId, documentId: document.id, days: 7, createdByUserId: plannerId });
    await expect(createEventDocumentLink({ organizationId: other.organizationId, documentId: document.id, days: 7, createdByUserId: plannerId })).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    expect(await listEventDocumentLinks(other.organizationId, document.id)).toEqual([]);
    await expect(revokeEventDocumentLink(other.organizationId, link.id)).rejects.toBeInstanceOf(EventDocumentNotFoundError);
    expect(await openEventDocumentLink(token)).not.toBeNull();

    await removeEventDocument(mine.organizationId, document.id);
    expect(await openEventDocumentLink(token)).toBeNull();
  });
});

describe("RGPD-01, RGPD-03 — Dossiers, versions et liens de partage (lot 37a)", () => {
  it("un dossier est trouvé par son nom ; à l'oubli, il est supprimé et ses documents vont dans « Divers »", async () => {
    const { organizationId, eventId } = await wedding();
    const folder = await createEventDocumentFolder(organizationId, eventId, "Famille Martin");
    const document = await attach(organizationId, eventId, "Plan de table", TINY_PDF, folder.id);
    const found = await eventsPrivacy.find({ organizationId, terms: { name: "Martin" } });
    expect(found.filter((record) => record.kind === "event_document_folder").map((record) => record.recordId)).toEqual([folder.id]);
    const related = await eventsPrivacy.related!({ organizationId, eventIds: [eventId] });
    expect(related.find((record) => record.kind === "event_document_folder")).toMatchObject({ recordId: folder.id, label: "Famille Martin" });

    const records = [{ kind: "event_document_folder", recordId: folder.id }];
    expect(await eventsPrivacy.planErasure({ organizationId, records, rules, today: "2026-11-16" })).toEqual([
      { kind: "event_document_folder", recordId: folder.id, fate: "deleted", legalBasis: null, keptUntil: null },
    ]);
    await eventsPrivacy.erase({ organizationId, records, rules, today: "2026-11-16" });
    expect(await listEventDocumentFolders(organizationId, eventId)).toEqual([]);
    expect((await listEventDocuments(organizationId, eventId)).find((entry) => entry.id === document.id)?.folderId).toBeNull();
  });

  it("l'oubli d'un document supprime toutes ses versions (fichiers compris), ses liens et leurs ouvertures au fil", async () => {
    const { organizationId, eventId } = await wedding();
    const document = await attach(organizationId, eventId, "Plan de table Martin");
    await addEventDocumentVersion({ organizationId, documentId: document.id, content: SECOND_PDF, uploadedByUserId: plannerId });
    const { token } = await createEventDocumentLink({ organizationId, documentId: document.id, days: 7, createdByUserId: plannerId });
    await openEventDocumentLink(token);
    const keys = await storedKeys(organizationId, document.id);

    await eventsPrivacy.erase({ organizationId, records: [{ kind: "event_document", recordId: document.id }], rules, today: "2026-11-16" });
    expect(await listEventDocuments(organizationId, eventId)).toEqual([]);
    expect(await openEventDocumentLink(token)).toBeNull();
    const opened = await rows(organizationId, (tx) => tx.select().from(eventActivities).where(eq(eventActivities.eventId, eventId)));
    expect(opened.filter((entry) => entry.kind === "document_link_opened")).toEqual([]);
    await expectGoneFromStorage(keys);
  });
});
