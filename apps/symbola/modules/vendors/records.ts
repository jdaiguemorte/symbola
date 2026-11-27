// Lot 48a (PRE-05, PRE-06, PRE-10, SEC-27, DAT-08 ; D3 à D5 ; ADR 0093) — pièces à échéance, IBAN
// chiffré et contrôle de ses changements, note confidentielle, contraintes d'un lieu. Exposé par
// service.ts (seule porte du module, ADR 0011).
// - Une valeur sensible (IBAN, BIC, note confidentielle) est chiffrée au niveau du champ (field-box,
//   ADR 0079) avant d'entrer dans la base, et ne se déchiffre qu'ici, au moment de l'afficher ; elle
//   n'est jamais écrite dans un journal ni dans une erreur (SEC-20).
// - Tout changement d'IBAN est journalisé (masqué), et reste « à vérifier par un autre canal » tant
//   que la planner n'a pas dit « J'ai vérifié par téléphone » (horodaté et nominatif).
import { openField, sealField } from "@symbola/auth";
import type {
  FileDownload,
  VendorBankChange,
  VendorBankCheck,
  VendorBankSummary,
  VendorDocument,
  VendorDocumentKind,
  VendorDocumentNotice,
  VendorDocumentState,
  VendorRetainedEvent,
  VenueCapacityFinding,
  VenueConstraintSet,
  VenueProgramFinding,
} from "@symbola/contracts";
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
import { starterVendorDocumentAlertDays, starterVendorDocumentKinds, starterVenueRuleFields, starterVenueRules, type StarterLocale } from "@symbola/starter-templates";
import { cleanBankDetails, maskIban, vendorBankPlace, vendorNotePlace } from "./bank-details";
import { documentAlert, documentState, documentsLapsingBefore, type StateDocument } from "./documents";
import {
  archiveDocumentKindRow,
  deleteDocumentRow,
  findBankChangeRows,
  findDocumentAlertDays,
  findDocumentKindRows,
  findDocumentRows,
  findVendorBankRow,
  findVendorNoteRow,
  findVenueRows,
  insertDocumentKindRow,
  insertDocumentRow,
  saveDocumentAlertDays,
  seedDocumentKindRows,
  seedVenueRuleFieldRows,
  updateDocumentKindRow,
  updateDocumentRow,
  verifyBankChangeRows,
  writeVendorBankRow,
  writeVendorNoteRow,
  type DocumentWithKind,
  type VendorBankChangeRow,
} from "./records-repository";
import { checkCapacity, checkProgramAgainstVenue, type VenueSequence } from "./venue-rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
export const VENDOR_DOCUMENT_MAX_SIZE_BYTES = 20 * 1024 * 1024;

export class VendorDocumentNotFoundError extends Error {
  constructor() {
    super("pièce introuvable");
    this.name = "VendorDocumentNotFoundError";
  }
}

export class VendorDocumentRejectedError extends Error {
  constructor(readonly reason: string) {
    super("fichier refusé");
    this.name = "VendorDocumentRejectedError";
  }
}

// Une note confidentielle ne se lit, ne se change ni ne se décoche que par la titulaire ou son auteur.
export class ConfidentialNoteForbiddenError extends Error {
  constructor() {
    super("note confidentielle réservée à la titulaire et à son auteur");
    this.name = "ConfidentialNoteForbiddenError";
  }
}

// Lot 52 (HUB-04) : le Comptable n'est ni Propriétaire ni auteur ; il ne lit aucune note confidentielle.
export type NoteViewer = { userId: string; role: "owner" | "member" | "admin" | "accountant" };

export function canReadConfidentialNote(viewer: NoteViewer, authorUserId: string | null): boolean {
  return viewer.role === "owner" || (authorUserId !== null && viewer.userId === authorUserId);
}

function today(now: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

// PRE-05 — natures de pièces.

function toKind(row: { id: string; label: string; shortLabel: string | null; requestedByDefault: boolean; expires: boolean; starterKey: string | null; position: number }): VendorDocumentKind {
  return { id: row.id, label: row.label, shortLabel: row.shortLabel, requestedByDefault: row.requestedByDefault, expires: row.expires, starterKey: row.starterKey, position: row.position };
}

export async function listVendorDocumentKinds(organizationId: string, locale: StarterLocale = "fr"): Promise<VendorDocumentKind[]> {
  await seedDocumentKindRows(organizationId, starterVendorDocumentKinds(locale));
  return (await findDocumentKindRows(organizationId)).map(toKind);
}

export async function addVendorDocumentKind(organizationId: string, input: { label: string; expires: boolean }): Promise<VendorDocumentKind> {
  const label = input.label.trim();
  if (label.length < 1 || label.length > 120) throw new RangeError("libellé de nature de pièce invalide");
  return toKind(await insertDocumentKindRow(organizationId, { label, expires: input.expires }));
}

// Lot 73a (P3, P4) : le nom court (1 à 40 caractères, sans caractère de contrôle ; vide = le libellé
// complet) et « demandée d'habitude ». Aucun genre grammatical (P3).
export async function setVendorDocumentKindUsage(organizationId: string, kindId: string, input: { shortLabel?: string | null; requestedByDefault?: boolean }): Promise<VendorDocumentKind> {
  if (!UUID.test(kindId)) throw new VendorDocumentNotFoundError();
  const values: { shortLabel?: string | null; requestedByDefault?: boolean } = {};
  if (input.shortLabel !== undefined) {
    const shortLabel = input.shortLabel?.trim() ?? "";
    if (shortLabel.length > 40 || /[\u0000-\u001f\u007f]/.test(shortLabel)) throw new RangeError("nom court invalide (40 caractères au plus)");
    values.shortLabel = shortLabel || null;
  }
  if (input.requestedByDefault !== undefined) values.requestedByDefault = input.requestedByDefault;
  const row = await updateDocumentKindRow(organizationId, kindId, values);
  if (!row) throw new VendorDocumentNotFoundError();
  return toKind(row);
}

export async function archiveVendorDocumentKind(organizationId: string, kindId: string): Promise<boolean> {
  return UUID.test(kindId) ? archiveDocumentKindRow(organizationId, kindId) : false;
}

export async function getVendorDocumentAlertDays(organizationId: string): Promise<number> {
  return (await findDocumentAlertDays(organizationId)) ?? starterVendorDocumentAlertDays();
}

export async function setVendorDocumentAlertDays(organizationId: string, days: number): Promise<void> {
  if (!Number.isInteger(days) || days < 1 || days > 180) throw new RangeError("délai d'alerte invalide (1 à 180 jours)");
  await saveDocumentAlertDays(organizationId, days);
}

// PRE-05 — pièces.

function toDocument(row: DocumentWithKind, day: string, alertDays: number): VendorDocument {
  const document = row.document;
  return {
    id: document.id,
    vendorId: document.vendorId,
    kindId: document.kindId,
    kindLabel: row.kindLabel,
    status: document.status,
    fileName: document.fileName,
    mime: document.mime,
    sizeBytes: document.sizeBytes,
    validUntil: document.validUntil,
    uploadedBy: document.uploadedByLinkId ? "vendor" : document.uploadedByUserId ? "planner" : null,
    uploadedAt: document.uploadedAt?.toISOString() ?? null,
    requestedAt: document.requestedAt?.toISOString() ?? null,
    verifiedAt: document.verifiedAt?.toISOString() ?? null,
    alert: document.status === "requested" ? "no_expiry" : documentAlert(document, day, alertDays),
  };
}

export async function listVendorDocuments(organizationId: string, vendorId: string, now: Date = new Date()): Promise<VendorDocument[]> {
  if (!UUID.test(vendorId)) return [];
  const [rows, alertDays] = await Promise.all([findDocumentRows(organizationId, { vendorIds: [vendorId] }), getVendorDocumentAlertDays(organizationId)]);
  return rows.map((row) => toDocument(row, today(now), alertDays));
}

function cleanValidUntil(value: string | null | undefined): string | null {
  if (!value) return null;
  if (!DAY.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`))) throw new RangeError("date de fin de validité invalide");
  return value;
}

async function storeFile(organizationId: string, fileName: string, content: Uint8Array): Promise<{ fileName: string; fileKey: string; mime: string; sizeBytes: number }> {
  const upload = await uploadFile({ organizationId, buffer: Buffer.from(content), maxSizeBytes: VENDOR_DOCUMENT_MAX_SIZE_BYTES });
  if (upload.status === "rejected") throw new VendorDocumentRejectedError(upload.reason);
  const name = fileName.replace(/[^\p{L}\p{N} ._-]/gu, "").trim().slice(0, 120) || `piece.${upload.key.split(".").pop() ?? "bin"}`;
  return { fileName: name, fileKey: upload.key, mime: upload.mime, sizeBytes: upload.size };
}

// La planner dépose une pièce : elle est vérifiée d'office.
export async function addVendorDocument(input: {
  organizationId: string;
  vendorId: string;
  kindId: string;
  fileName: string;
  content: Uint8Array;
  validUntil?: string | null;
  userId: string;
  now?: Date;
}): Promise<VendorDocument> {
  if (!UUID.test(input.vendorId) || !UUID.test(input.kindId)) throw new VendorDocumentNotFoundError();
  const validUntil = cleanValidUntil(input.validUntil);
  const file = await storeFile(input.organizationId, input.fileName, input.content);
  const now = input.now ?? new Date();
  try {
    const row = await insertDocumentRow(input.organizationId, {
      vendorId: input.vendorId,
      kindId: input.kindId,
      status: "verified",
      ...file,
      validUntil,
      uploadedByUserId: input.userId,
      uploadedAt: now,
      verifiedAt: now,
      verifiedByUserId: input.userId,
    });
    return (await listVendorDocuments(input.organizationId, input.vendorId, now)).find((document) => document.id === row.id)!;
  } catch (error) {
    await deletePrivateObject(createStorageClient(), file.fileKey).catch(() => undefined);
    if (error instanceof Error && /introuvable/.test(error.message)) throw new VendorDocumentNotFoundError();
    throw error;
  }
}

// D3 : la planner demande une pièce ; le prestataire la déposera par son lien.
export async function requestVendorDocument(input: { organizationId: string; vendorId: string; kindId: string; now?: Date }): Promise<VendorDocument> {
  if (!UUID.test(input.vendorId) || !UUID.test(input.kindId)) throw new VendorDocumentNotFoundError();
  const now = input.now ?? new Date();
  try {
    const row = await insertDocumentRow(input.organizationId, { vendorId: input.vendorId, kindId: input.kindId, status: "requested", requestedAt: now }, { action: "vendors.document.requested" });
    return (await listVendorDocuments(input.organizationId, input.vendorId, now)).find((document) => document.id === row.id)!;
  } catch (error) {
    if (error instanceof Error && /introuvable/.test(error.message)) throw new VendorDocumentNotFoundError();
    throw error;
  }
}

// Lot 73a (P4) : « Demander l'assurance et le Kbis » — les natures demandées d'habitude qui ne sont ni
// déjà demandées, ni déposées et encore valables. Rend les pièces demandées par ce geste.
export async function requestUsualVendorDocuments(input: { organizationId: string; vendorId: string; now?: Date }): Promise<VendorDocument[]> {
  if (!UUID.test(input.vendorId)) throw new VendorDocumentNotFoundError();
  const now = input.now ?? new Date();
  const [kinds, documents, alertDays] = await Promise.all([listVendorDocumentKinds(input.organizationId), listVendorDocuments(input.organizationId, input.vendorId, now), getVendorDocumentAlertDays(input.organizationId)]);
  const day = today(now);
  const covered = new Set(documents.filter((document) => document.status === "requested" || documentAlert(document, day, alertDays) !== "expired").map((document) => document.kindId));
  const requested: VendorDocument[] = [];
  for (const kind of kinds.filter((entry) => entry.requestedByDefault && !covered.has(entry.id))) {
    requested.push(await requestVendorDocument({ organizationId: input.organizationId, vendorId: input.vendorId, kindId: kind.id, now }));
  }
  return requested;
}

// Lot 73a (PRE-05 ; spécification du lot 73, § 4.2) — l'état résumé des pièces de chaque fiche, en une
// lecture pour toute la liste (NFR-02, ADR 0115). Les mariages à venir où chaque fiche est retenue viennent
// de l'appelant (module Évènements) ; le nom d'un mariage seulement s'il le donne (la personne le voit).
export async function summarizeVendorDocuments(
  organizationId: string,
  vendorIds: string[],
  // Les mariages peuvent arriver en promesse : leur lecture part avec celle des pièces (NFR-02).
  input: { now?: Date; retainedEventsByVendor?: Map<string, VendorRetainedEvent[]> | Promise<Map<string, VendorRetainedEvent[]>>; eventNames?: Record<string, string> } = {},
): Promise<Map<string, VendorDocumentState & { sortDate: string }>> {
  const ids = vendorIds.filter((id) => UUID.test(id));
  const states = new Map<string, VendorDocumentState & { sortDate: string }>();
  if (ids.length === 0) return states;
  const [rows, alertDays, retainedEventsByVendor] = await Promise.all([findDocumentRows(organizationId, { vendorIds: ids }), getVendorDocumentAlertDays(organizationId), input.retainedEventsByVendor]);
  const day = today(input.now ?? new Date());
  const byVendor = new Map<string, StateDocument[]>();
  for (const row of rows) {
    const list = byVendor.get(row.document.vendorId) ?? [];
    list.push({
      documentId: row.document.id,
      kindId: row.document.kindId,
      label: row.kindLabel,
      shortLabel: row.kindShortLabel,
      status: row.document.status,
      validUntil: row.document.validUntil,
      requestedAt: row.document.requestedAt?.toISOString() ?? null,
      uploadedAt: row.document.uploadedAt?.toISOString() ?? null,
    });
    byVendor.set(row.document.vendorId, list);
  }
  for (const id of ids) {
    const retainedEvents = (retainedEventsByVendor?.get(id) ?? []).map((event) => ({ ...event, couple: input.eventNames?.[event.eventId] ?? null }));
    states.set(id, documentState({ documents: byVendor.get(id) ?? [], today: day, alertDays, retainedEvents }));
  }
  return states;
}

// D3 : pièces demandées à ce prestataire (pour son lien).
export async function listRequestedVendorDocuments(organizationId: string, vendorId: string, now: Date = new Date()): Promise<VendorDocument[]> {
  return (await listVendorDocuments(organizationId, vendorId, now)).filter((document) => document.status === "requested" || (document.status === "to_verify" && document.uploadedBy === "vendor"));
}

// D3 : le prestataire dépose, par son lien, une pièce que la planner lui a demandée. Elle arrive
// « à vérifier ». vendorId vient du lien, jamais de la requête : une pièce d'un autre prestataire
// répond « introuvable ».
export async function receiveVendorDocumentByLink(input: {
  organizationId: string;
  vendorId: string;
  documentId: string;
  linkId: string;
  fileName: string;
  content: Uint8Array;
  validUntil?: string | null;
  now?: Date;
}): Promise<VendorDocument> {
  if (!UUID.test(input.documentId)) throw new VendorDocumentNotFoundError();
  const [current] = await findDocumentRows(input.organizationId, { documentId: input.documentId });
  if (!current || current.document.vendorId !== input.vendorId || current.document.status !== "requested") throw new VendorDocumentNotFoundError();
  const validUntil = cleanValidUntil(input.validUntil);
  const file = await storeFile(input.organizationId, input.fileName, input.content);
  const now = input.now ?? new Date();
  const row = await updateDocumentRow(
    input.organizationId,
    input.documentId,
    { status: "to_verify", ...file, validUntil, uploadedByLinkId: input.linkId, uploadedAt: now },
    { onlyIfStatus: "requested", vendorId: input.vendorId, audit: "vendors.document.received" },
  );
  if (!row) {
    await deletePrivateObject(createStorageClient(), file.fileKey).catch(() => undefined);
    throw new VendorDocumentNotFoundError();
  }
  return (await listVendorDocuments(input.organizationId, input.vendorId, now)).find((document) => document.id === row.id)!;
}

export async function verifyVendorDocument(organizationId: string, documentId: string, userId: string, now: Date = new Date()): Promise<void> {
  if (!UUID.test(documentId)) throw new VendorDocumentNotFoundError();
  const row = await updateDocumentRow(organizationId, documentId, { status: "verified", verifiedAt: now, verifiedByUserId: userId }, { onlyIfStatus: "to_verify", audit: "vendors.document.verified" });
  if (!row) throw new VendorDocumentNotFoundError();
}

export async function setVendorDocumentValidity(organizationId: string, documentId: string, validUntil: string | null): Promise<void> {
  if (!UUID.test(documentId)) throw new VendorDocumentNotFoundError();
  const row = await updateDocumentRow(organizationId, documentId, { validUntil: cleanValidUntil(validUntil) });
  if (!row) throw new VendorDocumentNotFoundError();
}

export async function removeVendorDocument(organizationId: string, documentId: string): Promise<void> {
  const row = UUID.test(documentId) ? await deleteDocumentRow(organizationId, documentId) : null;
  if (row?.fileKey) await deletePrivateObject(createStorageClient(), row.fileKey).catch(() => undefined);
}

// Le fichier d'une pièce (ADR 0027 : servi par l'app, après contrôle de l'accès par l'appelant).
export async function getVendorDocumentFile(organizationId: string, documentId: string, options: { vendorId?: string } = {}): Promise<FileDownload> {
  const [row] = UUID.test(documentId) ? await findDocumentRows(organizationId, { documentId }) : [];
  if (!row?.document.fileKey || !row.document.mime || !row.document.fileName) throw new VendorDocumentNotFoundError();
  if (options.vendorId && row.document.vendorId !== options.vendorId) throw new VendorDocumentNotFoundError();
  try {
    const { data } = await readPrivateObject(createStorageClient(), row.document.fileKey);
    return { data, contentType: row.document.mime, fileName: row.document.fileName };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new VendorDocumentNotFoundError();
    throw error;
  }
}

// PRE-05 — ce qu'il faut signaler : pièces expirées ou proches de leur fin, déposées « à vérifier »,
// et (critère) celles qui expirent avant la date d'un évènement où le prestataire est retenu.
export async function listVendorDocumentNotices(
  organizationId: string,
  input: { vendorIds?: string[]; eventDate?: string | null; now?: Date } = {},
): Promise<VendorDocumentNotice[]> {
  const vendorIds = input.vendorIds?.filter((id) => UUID.test(id));
  const [rows, alertDays] = await Promise.all([findDocumentRows(organizationId, vendorIds ? { vendorIds } : {}), getVendorDocumentAlertDays(organizationId)]);
  const day = today(input.now ?? new Date());
  const lapsing = new Set(input.eventDate && input.eventDate >= day ? documentsLapsingBefore(rows.map((row) => ({ ...row.document })), input.eventDate).map((document) => document.id) : []);
  return rows.flatMap((row): VendorDocumentNotice[] => {
    const base = { documentId: row.document.id, vendorId: row.document.vendorId, vendorName: row.vendorName, kindLabel: row.kindLabel, validUntil: row.document.validUntil };
    if (row.document.status === "requested") return [];
    if (row.document.status === "to_verify") return [{ ...base, reason: "to_verify" }];
    const alert = documentAlert(row.document, day, alertDays);
    if (alert === "expired") return [{ ...base, reason: "expired" }];
    if (lapsing.has(row.document.id)) return [{ ...base, reason: "lapses_before_event" }];
    if (alert === "expiring") return [{ ...base, reason: "expiring" }];
    return [];
  });
}

// PRE-10, SEC-27, DAT-08 — IBAN d'un prestataire.

function toCheck(row: VendorBankChangeRow): VendorBankCheck {
  return { changeId: row.id, changedAt: row.changedAt.toISOString(), changedBy: row.changedByLinkId ? "vendor" : "planner" };
}

export async function getVendorBankSummary(organizationId: string, vendorId: string): Promise<VendorBankSummary> {
  const row = UUID.test(vendorId) ? await findVendorBankRow(organizationId, vendorId) : null;
  if (!row) return { ibanMasked: null, hasBic: false, pendingCheck: null };
  const [pending] = await findBankChangeRows(organizationId, { vendorIds: [vendorId], pendingOnly: true });
  return { ibanMasked: row.ibanMasked, hasBic: row.bicSealed !== null, pendingCheck: pending ? toCheck(pending) : null };
}

// Changements « à vérifier » des fiches données (toutes, sans filtre) : le plus récent par fiche.
export async function listPendingBankChecks(organizationId: string, vendorIds?: string[]): Promise<Map<string, VendorBankCheck & { vendorId: string }>> {
  const ids = vendorIds?.filter((id) => UUID.test(id));
  const rows = await findBankChangeRows(organizationId, { ...(ids ? { vendorIds: ids } : {}), pendingOnly: true });
  const result = new Map<string, VendorBankCheck & { vendorId: string }>();
  for (const row of rows) if (!result.has(row.vendorId)) result.set(row.vendorId, { ...toCheck(row), vendorId: row.vendorId });
  return result;
}

export async function listVendorBankChanges(organizationId: string, vendorId: string): Promise<VendorBankChange[]> {
  if (!UUID.test(vendorId)) return [];
  return (await findBankChangeRows(organizationId, { vendorIds: [vendorId] })).map((row) => ({
    id: row.id,
    previousMasked: row.previousMasked,
    nextMasked: row.nextMasked,
    changedBy: row.changedByUserId ? { kind: "user", userId: row.changedByUserId } : { kind: "vendor" },
    changedAt: row.changedAt.toISOString(),
    verifiedAt: row.verifiedAt?.toISOString() ?? null,
    verifiedByUserId: row.verifiedByUserId,
  }));
}

// L'IBAN en clair, pour le formulaire de la planner et ses documents ; jamais pour un tiers.
export async function readVendorBankDetails(organizationId: string, vendorId: string): Promise<{ iban: string | null; bic: string | null }> {
  const row = UUID.test(vendorId) ? await findVendorBankRow(organizationId, vendorId) : null;
  if (!row) return { iban: null, bic: null };
  return {
    iban: row.ibanSealed ? openField(row.ibanSealed, vendorBankPlace(organizationId, vendorId, "iban_sealed")) : null,
    bic: row.bicSealed ? openField(row.bicSealed, vendorBankPlace(organizationId, vendorId, "bic_sealed")) : null,
  };
}

export type BankActor = { kind: "user"; userId: string } | { kind: "link"; linkId: string };

// Écrit l'IBAN (chiffré). Un IBAN qui change (ajouté, modifié ou retiré) est journalisé, masqué, et
// marqué « à vérifier par un autre canal » ; un BIC seul qui change l'est aussi (la cible du virement
// change). Renvoie vrai si un changement a été tracé.
export async function setVendorBankDetails(organizationId: string, vendorId: string, input: { iban: string | null; bic: string | null }, actor: BankActor): Promise<{ changed: boolean }> {
  if (!UUID.test(vendorId)) throw new Error("fiche introuvable");
  const next = cleanBankDetails(input);
  const current = await readVendorBankDetails(organizationId, vendorId);
  const row = await findVendorBankRow(organizationId, vendorId);
  if (!row) throw new Error("fiche introuvable");
  if (current.iban === next.iban && current.bic === next.bic) return { changed: false };
  const nextMasked = next.iban ? maskIban(next.iban) : null;
  await writeVendorBankRow(
    organizationId,
    vendorId,
    {
      ibanSealed: next.iban ? sealField(next.iban, vendorBankPlace(organizationId, vendorId, "iban_sealed")) : null,
      bicSealed: next.bic ? sealField(next.bic, vendorBankPlace(organizationId, vendorId, "bic_sealed")) : null,
      ibanMasked: nextMasked,
    },
    {
      previousMasked: row.ibanMasked,
      nextMasked,
      byUserId: actor.kind === "user" ? actor.userId : null,
      byLinkId: actor.kind === "link" ? actor.linkId : null,
    },
  );
  return { changed: true };
}

// « J'ai vérifié par téléphone » : seule la planner lève le bandeau.
export async function verifyVendorBankDetails(organizationId: string, vendorId: string, userId: string, now: Date = new Date()): Promise<number> {
  if (!UUID.test(vendorId)) return 0;
  return verifyBankChangeRows(organizationId, vendorId, userId, now);
}

// DAT-08 — note confidentielle d'une fiche.

export async function readVendorConfidentialNote(organizationId: string, vendorId: string, viewer: NoteViewer): Promise<string | null> {
  const row = UUID.test(vendorId) ? await findVendorNoteRow(organizationId, vendorId) : null;
  if (!row?.internalNoteSealed) return null;
  if (!canReadConfidentialNote(viewer, row.internalNoteConfidentialBy)) throw new ConfidentialNoteForbiddenError();
  return openField(row.internalNoteSealed, vendorNotePlace(organizationId, vendorId));
}

// Coche ou décoche « confidentielle », et enregistre le texte. Une note déjà confidentielle ne se
// change que par la titulaire ou son auteur.
export async function saveVendorNote(organizationId: string, vendorId: string, input: { note: string | null; confidential: boolean }, viewer: NoteViewer): Promise<void> {
  const row = UUID.test(vendorId) ? await findVendorNoteRow(organizationId, vendorId) : null;
  if (!row) throw new Error("fiche introuvable");
  if (row.internalNoteSealed && !canReadConfidentialNote(viewer, row.internalNoteConfidentialBy)) throw new ConfidentialNoteForbiddenError();
  const note = input.note?.trim() ? input.note.trim().slice(0, 10_000) : null;
  if (input.confidential && note) {
    await writeVendorNoteRow(organizationId, vendorId, {
      internalNote: null,
      internalNoteSealed: sealField(note, vendorNotePlace(organizationId, vendorId)),
      internalNoteConfidentialBy: row.internalNoteSealed ? (row.internalNoteConfidentialBy ?? viewer.userId) : viewer.userId,
    });
  } else {
    await writeVendorNoteRow(organizationId, vendorId, { internalNote: note, internalNoteSealed: null, internalNoteConfidentialBy: null });
  }
}

// PRE-06 — contraintes des lieux et contrôles du chrono.

export async function ensureVenueRuleFields(organizationId: string, locale: StarterLocale = "fr"): Promise<number> {
  return seedVenueRuleFieldRows(organizationId, starterVenueRuleFields(locale));
}

export async function getVenueConstraints(organizationId: string, vendorIds: string[]): Promise<VenueConstraintSet[]> {
  const rows = await findVenueRows(organizationId, [...new Set(vendorIds.filter((id) => UUID.test(id)))]);
  return rows.map((row) => ({
    vendorId: row.id,
    name: row.name,
    values: Object.fromEntries(row.ruleFields.flatMap((field) => (row.fieldValues[field.id] !== undefined && row.fieldValues[field.id] !== "" ? [[field.ruleKey, row.fieldValues[field.id]!]] : []))),
  }));
}

// Clés des types de départ des métiers de chaque fiche (« music », « venue »…), pour qualifier les
// séquences (lot 63e : une fiche peut en avoir plusieurs).
export async function getVendorTypeKeys(organizationId: string, vendorIds: string[]): Promise<Map<string, string[]>> {
  const rows = await findVenueRows(organizationId, [...new Set(vendorIds.filter((id) => UUID.test(id)))]);
  return new Map(rows.map((row) => [row.id, row.typeStarterKeys]));
}

export type ProgramSequenceInput = { id: string; startTime: string; endTime: string | null; vendorIds: string[]; hasVendorSlot: boolean };

// Contrôle d'un programme par un lieu : séquences qualifiées par les types des prestataires retenus
// (« musique » selon venue-rules.json). Signalement seul, jamais bloquant (D4).
export async function checkProgramWithVenue(organizationId: string, venue: VenueConstraintSet, sequences: ProgramSequenceInput[]): Promise<VenueProgramFinding[]> {
  const rules = starterVenueRules();
  const typeKeys = await getVendorTypeKeys(organizationId, sequences.flatMap((sequence) => sequence.vendorIds));
  const music = new Set(rules.musicTypeKeys);
  const qualified: VenueSequence[] = sequences.map((sequence) => ({
    id: sequence.id,
    startTime: sequence.startTime,
    endTime: sequence.endTime,
    music: sequence.vendorIds.some((id) => (typeKeys.get(id) ?? []).some((key) => music.has(key))),
    withVendors: sequence.hasVendorSlot,
  }));
  return checkProgramAgainstVenue(venue, qualified, rules);
}

export function checkVenueCapacity(venue: VenueConstraintSet, guests: number | null): VenueCapacityFinding | null {
  return checkCapacity(venue, guests, starterVenueRules());
}
