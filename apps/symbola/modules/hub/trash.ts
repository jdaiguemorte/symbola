// Lot 39a (DAT-03, HUB-17, UX-07 ; ADR 0073) — corbeille du hub : contacts et modèles de messages à
// la corbeille, notes de contact annulables ; restaurer, lister, purger. Exposé seulement par
// service.ts (ADR 0011). Toute lecture ici voit la corbeille (inTrash).
import { and, eq, inArray, isNotNull, isNull, lt, ne, or } from "drizzle-orm";
import { includingDeleted } from "@symbola/db/actor";
import { contactMembers, contactNotes, contacts, messageTemplates } from "@symbola/db/schema/hub";
import { inTrash, markDeleted, UNMARKED } from "@symbola/db/soft-delete";
import { displayNameOf } from "./contacts";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type HubTrashKind = "contact" | "messageTemplate";

export type TrashedHubRow = { kind: HubTrashKind; id: string; label: string; eventId: null; deletedAt: Date; deletedBy: string | null };

// Un contact à la corbeille dont l'adresse a été reprise par un autre contact entre-temps.
export class ContactRestoreConflictError extends Error {
  constructor() {
    super("un contact de même adresse e-mail existe déjà");
    this.name = "ContactRestoreConflictError";
  }
}

// L'appelant (lib/trash.ts) a vérifié qu'aucun évènement ni devis ne s'appuie sur ce contact.
export async function trashContactRow(organizationId: string, contactId: string): Promise<boolean> {
  if (!UUID.test(contactId)) return false;
  const rows = await inTrash(organizationId, (tx) => tx.update(contacts).set(markDeleted()).where(and(eq(contacts.id, contactId), isNull(contacts.deletedAt))).returning({ id: contacts.id }));
  return rows.length > 0;
}

export async function restoreContactRow(organizationId: string, contactId: string): Promise<boolean> {
  if (!UUID.test(contactId)) return false;
  return inTrash(organizationId, async (tx) => {
    const [row] = await tx.select().from(contacts).where(and(eq(contacts.id, contactId), isNotNull(contacts.deletedAt)));
    if (!row) return false;
    if (row.email) {
      const taken = await tx
        .select({ id: contacts.id })
        .from(contacts)
        .where(and(eq(contacts.email, row.email), ne(contacts.id, contactId), isNull(contacts.deletedAt)))
        .limit(1);
      if (taken.length > 0) throw new ContactRestoreConflictError();
    }
    await tx.update(contacts).set(UNMARKED).where(eq(contacts.id, contactId));
    return true;
  });
}

export async function restoreMessageTemplateRow(organizationId: string, templateId: string): Promise<boolean> {
  if (!UUID.test(templateId)) return false;
  const rows = await inTrash(organizationId, (tx) =>
    tx.update(messageTemplates).set(UNMARKED).where(and(eq(messageTemplates.id, templateId), isNotNull(messageTemplates.deletedAt))).returning({ id: messageTemplates.id }),
  );
  return rows.length > 0;
}

export async function listTrashedHubRows(organizationId: string): Promise<TrashedHubRow[]> {
  return inTrash(organizationId, async (tx) => {
    const trashedContacts = await tx.select().from(contacts).where(isNotNull(contacts.deletedAt));
    const templates = await tx
      .select({ id: messageTemplates.id, name: messageTemplates.name, deletedAt: messageTemplates.deletedAt, deletedBy: messageTemplates.deletedBy })
      .from(messageTemplates)
      .where(isNotNull(messageTemplates.deletedAt));
    return [
      ...trashedContacts.map((row) => ({ kind: "contact" as const, id: row.id, label: displayNameOf(row), eventId: null, deletedAt: row.deletedAt!, deletedBy: row.deletedBy })),
      ...templates.map((row) => ({ kind: "messageTemplate" as const, id: row.id, label: row.name, eventId: null, deletedAt: row.deletedAt!, deletedBy: row.deletedBy })),
    ];
  });
}

export async function isHubObjectTrashed(organizationId: string, kind: HubTrashKind, id: string): Promise<boolean> {
  if (!UUID.test(id)) return false;
  const table = kind === "contact" ? contacts : messageTemplates;
  return inTrash(organizationId, async (tx) => (await tx.select({ id: table.id }).from(table).where(and(eq(table.id, id), isNotNull(table.deletedAt)))).length > 0);
}

// Notes de contact retirées avant la date donnée (« Annuler » passé).
export async function purgeHubElements(organizationId: string, before: Date): Promise<number> {
  const rows = await inTrash(organizationId, (tx) =>
    tx.delete(contactNotes).where(and(isNotNull(contactNotes.deletedAt), lt(contactNotes.deletedAt, before))).returning({ id: contactNotes.id }),
  );
  return rows.length;
}

type ObjectFilter = { before: Date } | { kind: HubTrashKind; id: string };

// Contacts (avec leurs notes et leurs liens de foyer ou d'entreprise) et modèles de messages (avec
// leurs versions) de la corbeille : ceux marqués avant la date donnée, ou un seul.
export async function purgeTrashedHubObjects(organizationId: string, filter: ObjectFilter): Promise<number> {
  const condition = (table: typeof contacts | typeof messageTemplates, kind: HubTrashKind) => {
    if ("before" in filter) return and(isNotNull(table.deletedAt), lt(table.deletedAt, filter.before));
    if (filter.kind !== kind || !UUID.test(filter.id)) return undefined;
    return and(isNotNull(table.deletedAt), eq(table.id, filter.id));
  };
  return includingDeleted(() =>
    inTrash(organizationId, async (tx) => {
      let removed = 0;
      const contactCondition = condition(contacts, "contact");
      if (contactCondition) {
        const ids = (await tx.select({ id: contacts.id }).from(contacts).where(contactCondition)).map((row) => row.id);
        if (ids.length > 0) {
          await tx.delete(contactNotes).where(inArray(contactNotes.contactId, ids));
          await tx.delete(contactMembers).where(or(inArray(contactMembers.groupContactId, ids), inArray(contactMembers.memberContactId, ids)));
          removed += (await tx.delete(contacts).where(inArray(contacts.id, ids)).returning({ id: contacts.id })).length;
        }
      }
      const templateCondition = condition(messageTemplates, "messageTemplate");
      if (templateCondition) removed += (await tx.delete(messageTemplates).where(templateCondition).returning({ id: messageTemplates.id })).length;
      return removed;
    }),
  );
}
