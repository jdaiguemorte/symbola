// Contrat privacy/v1 du hub (lot 6, ADR 0023). Données personnelles du hub
// qui peuvent concerner une personne suivie par la planner : compte d'accès
// d'un marié (e-mail), lignes d'un import en cours (le fichier d'origine), et
// valeurs gardées pour annuler un import confirmé. Les comptes de l'équipe de
// la planner ne relèvent pas de ce traitement.
import { and, eq, inArray, isNotNull } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { importItems, imports, privacyRequests } from "@symbola/db/schema/hub";
import { anonymizeContacts, findContactsByTerms, getContactsByIds, listContactGroups, listContactMembers, listContactNotes } from "./contacts";
import { eraseFormDrafts, findFormDraftsByTerms, listFormDraftIds } from "./form-drafts";
import { erasePendingEmails, findPendingEmailsByTerms, listPendingEmailIds } from "./jobs";
import { withOrganization } from "@symbola/db/with-organization";
import {
  ANONYMIZED,
  hasTerms,
  idsOfKind,
  prepareTerms,
  recordMatches,
  type ErasureInput,
  type ErasurePlanItem,
  type PrivacyContractV1,
  type PrivacyRecord,
} from "@symbola/privacy";

const MODULE = "hub";

function texts(value: unknown): string[] {
  if (value === null || value === undefined) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "number" || typeof value === "boolean") return [String(value)];
  if (Array.isArray(value)) return value.flatMap(texts);
  if (typeof value === "object") return Object.entries(value as Record<string, unknown>).flatMap(([key, item]) => [key, ...texts(item)]);
  return [];
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// RGPD-03 — oubli dans le hub (registre de données, décision de Julien du
// 02/11/2026) :
// - compte d'un marié : supprimé, sessions et visites vues comprises ;
// - ligne d'un import en cours (« import:ligne ») : tout l'import en cours
//   est abandonné, ses lignes effacées, nom de fichier et intitulés de
//   colonnes anonymisés ;
// - élément d'un import confirmé : valeurs gardées pour l'annulation
//   effacées (l'élément n'est plus annulable) ;
// - preuve d'une demande close (RGPD-09, ADR 0048), seulement par la purge
//   mensuelle validée : nom de la personne remplacé par « [anonymisé] » et
//   motif de prolongation effacé ; le type, les dates et le journal restent.
//   Une demande en cours n'est jamais touchée.
// Lot 36a (CRM-03, ADR 0069) : la fiche d'un contact (nom, coordonnées, notes) est anonymisée — nom
// remplacé, coordonnées et notes effacées ; la ligne reste, pour que les évènements restent justes.
async function contactErasure(input: ErasureInput, execute: boolean): Promise<ErasurePlanItem[]> {
  const ids = idsOfKind(input.records, "contact");
  if (ids.length === 0) return [];
  const known = [...(await getContactsByIds(input.organizationId, ids)).values()].filter((contact) => !contact.isDemo);
  if (execute) await anonymizeContacts(input.organizationId, known.filter((contact) => !contact.anonymized).map((contact) => contact.id));
  return known.map((contact) => ({ kind: "contact", recordId: contact.id, fate: "anonymized", legalBasis: null, keptUntil: null }));
}

async function hubErasure(input: ErasureInput, execute: boolean): Promise<ErasurePlanItem[]> {
  const contactItems = await contactErasure(input, execute);
  const rowRefs = input.records.filter((record) => record.kind === "import_row" && UUID.test(record.recordId.split(":")[0] ?? ""));
  const itemIds = idsOfKind(input.records, "import_item");
  const requestIds = idsOfKind(input.records, "privacy_request");
  const items: ErasurePlanItem[] = [];
  const db = appDatabase();
  await withOrganization(db, input.organizationId, async (tx) => {
    const importIds = [...new Set(rowRefs.map((record) => record.recordId.split(":")[0]!))];
    if (importIds.length > 0) {
      const drafts = await tx.select({ id: imports.id, headers: imports.headers }).from(imports).where(inArray(imports.id, importIds));
      const known = new Set(drafts.map((draft) => draft.id));
      for (const record of rowRefs) {
        if (known.has(record.recordId.split(":")[0]!)) items.push({ kind: "import_row", recordId: record.recordId, fate: "deleted", legalBasis: null, keptUntil: null });
      }
      if (execute) {
        for (const draft of drafts) {
          await tx
            .update(imports)
            .set({
              status: "cancelled",
              rows: null,
              sourceLineNumbers: null,
              fileName: ANONYMIZED,
              headers: draft.headers.map((_, index) => `#${index + 1}`),
              updatedAt: new Date(),
            })
            .where(and(eq(imports.id, draft.id), eq(imports.status, "draft")));
        }
      }
    }
    if (itemIds.length > 0) {
      const rows = await tx.select({ id: importItems.id }).from(importItems).where(inArray(importItems.id, itemIds));
      if (execute && rows.length > 0) await tx.update(importItems).set({ previous: null, written: null }).where(inArray(importItems.id, rows.map((row) => row.id)));
      for (const row of rows) items.push({ kind: "import_item", recordId: row.id, fate: "anonymized", legalBasis: null, keptUntil: null });
    }
    if (requestIds.length > 0) {
      const closed = await tx
        .select({ id: privacyRequests.id })
        .from(privacyRequests)
        .where(and(inArray(privacyRequests.id, requestIds), eq(privacyRequests.status, "closed")));
      const ids = closed.map((row) => row.id);
      if (execute && ids.length > 0) {
        await tx
          .update(privacyRequests)
          .set({ personLabel: ANONYMIZED, extensionReason: null })
          .where(and(inArray(privacyRequests.id, ids), eq(privacyRequests.status, "closed")));
      }
      for (const id of ids) items.push({ kind: "privacy_request", recordId: id, fate: "anonymized", legalBasis: null, keptUntil: null });
    }
  });
  // Lot 39b (UX-09, ADR 0074) : un brouillon qui mentionne la personne est supprimé.
  const draftIds = await listFormDraftIds(input.organizationId, idsOfKind(input.records, "form_draft").filter((id) => UUID.test(id)));
  if (execute) await eraseFormDrafts(input.organizationId, draftIds);
  for (const id of draftIds) items.push({ kind: "form_draft", recordId: id, fate: "deleted", legalBasis: null, keptUntil: null });
  // Lot 40b (ARC-10, ADR 0076) : un e-mail encore en attente qui vise la personne ne part pas.
  const pendingEmailIds = await listPendingEmailIds(input.organizationId, idsOfKind(input.records, "email_job").filter((id) => UUID.test(id)));
  if (execute) await erasePendingEmails(input.organizationId, pendingEmailIds);
  for (const id of pendingEmailIds) items.push({ kind: "email_job", recordId: id, fate: "deleted", legalBasis: null, keptUntil: null });
  return [...contactItems, ...items];
}

export const hubPrivacy: PrivacyContractV1 = {
  module: MODULE,

  planErasure: (input) => hubErasure(input, false),
  erase: (input) => hubErasure(input, true),

  async find({ organizationId, terms: rawTerms }) {
    const terms = prepareTerms(rawTerms);
    if (!hasTerms(terms)) return [];
    const db = appDatabase();
    const records: PrivacyRecord[] = [];
    // Lot 36a (CRM-03) : la fiche du contact, ses coordonnées et ses notes. Lot 36b : ses
    // identifiants d'entreprise, et les foyers ou entreprises qu'elle relie (avec les rôles).
    for (const contact of await findContactsByTerms(organizationId, rawTerms)) {
      // Lot 48a (DAT-08) : droit d'accès de la personne, notes confidentielles comprises.
      const notes = await listContactNotes(organizationId, contact.id, "reveal");
      const links = contact.kind === "person" ? await listContactGroups(organizationId, contact.id) : await listContactMembers(organizationId, contact.id);
      const fields: Record<string, string> = {};
      for (const [key, value] of Object.entries({
        firstName: contact.firstName,
        lastName: contact.lastName,
        name: contact.name,
        email: contact.email,
        phone: contact.phone,
        addressLine: contact.addressLine,
        postalCode: contact.postalCode,
        city: contact.city,
        country: contact.country,
        billingAddress: contact.billingAddress,
        companyIdNumber: contact.companyIdNumber,
        vatNumber: contact.vatNumber,
      })) {
        if (value) fields[key] = value;
      }
      notes.forEach((note, index) => {
        fields[`note${index + 1}`] = note.body;
      });
      links.forEach((link, index) => {
        fields[`link${index + 1}`] = link.role ? `${link.contact.displayName} (${link.role})` : link.contact.displayName;
      });
      records.push({ module: MODULE, kind: "contact", recordId: contact.id, label: contact.displayName, fields, eventId: null });
    }
    // Lot 26a (ADR 0053) : les tiers n'ont plus de compte ; leur lien personnel
    // (nom, e-mail) relève du module events.
    await withOrganization(db, organizationId, async (tx) => {
      for (const draft of await tx.select().from(imports).where(and(eq(imports.status, "draft"), isNotNull(imports.rows)))) {
        (draft.rows ?? []).forEach((row, rowIndex) => {
          if (!recordMatches(row, terms)) return;
          records.push({
            module: MODULE,
            kind: "import_row",
            recordId: `${draft.id}:${rowIndex}`,
            label: `${draft.fileName} — ${(draft.sourceLineNumbers ?? [])[rowIndex] ?? rowIndex + 1}`,
            fields: Object.fromEntries(row.map((cell, column) => [draft.headers[column] || `#${column + 1}`, cell]).filter(([, cell]) => cell !== "")),
            eventId: null,
          });
        });
      }
      for (const item of await tx.select().from(importItems).where(isNotNull(importItems.written))) {
        const values = [...texts(item.previous), ...texts(item.written)];
        if (!recordMatches(values, terms)) continue;
        records.push({
          module: MODULE,
          kind: "import_item",
          recordId: item.id,
          label: item.kind,
          fields: Object.fromEntries(texts(item.written).map((value, index) => [`value${index + 1}`, value])),
          eventId: item.kind === "event" ? item.elementId : null,
        });
      }
    });
    // Lot 39b (UX-09, ADR 0074) : un brouillon de formulaire qui mentionne la personne.
    for (const draft of await findFormDraftsByTerms(organizationId, rawTerms)) {
      records.push({ module: MODULE, kind: "form_draft", recordId: draft.id, label: draft.formKey, fields: Object.fromEntries(Object.entries(draft.content).filter(([, value]) => value.trim() !== "")), eventId: null });
    }
    // Lot 40b (ARC-10, ADR 0076) : un e-mail encore en attente d'envoi qui vise la personne.
    for (const email of await findPendingEmailsByTerms(organizationId, rawTerms)) {
      records.push({ module: MODULE, kind: "email_job", recordId: email.id, label: email.subject, fields: email.fields, eventId: null });
    }
    return records;
  },

  async related() {
    return [];
  },
};
