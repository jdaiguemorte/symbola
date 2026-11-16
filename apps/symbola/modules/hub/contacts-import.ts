// Lot 36b (HUB-14, DAT-12 ; D11 ; ADR 0069, ADR 0022) — import de contacts dans le hub. Une ligne
// crée un contact, ou complète celui qu'elle rapproche : le contact choisi à l'étape « Doublons »,
// ou celui qui porte déjà son adresse e-mail (une ligne plus haut dans le fichier, ou un contact de
// l'organisation). Compléter ne remplit que les champs vides : rien de ce que la planner a saisi
// n'est écrasé, et une adresse e-mail n'appartient jamais qu'à un contact. La colonne « notes » et
// les colonnes gardées « en champ libre » deviennent une note de la fiche. Toutes les lignes
// s'écrivent en une transaction ; chaque élément écrit garde de quoi l'annuler (IMP-05).
import { and, eq, ne, or } from "drizzle-orm";
import type { ImportApplyResult, ImportApplyRow, ImportCellValue, ImportedItem, ImportUndoItem, ImportUndoOutcome } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { contactMembers, contactNotes, contacts } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { ANONYMIZED } from "@symbola/privacy";
import { CONTACT_NOTE_MAX, ContactInvalidError, normalizeContactEmail } from "./contacts";

const TEXT_MAX = 300;

// Champs d'un contact qu'un import écrit, et que son annulation remet.
export const IMPORTED_CONTACT_FIELDS = ["firstName", "lastName", "email", "phone", "addressLine", "postalCode", "city", "country"] as const;
type ImportedContactField = (typeof IMPORTED_CONTACT_FIELDS)[number];
export type ImportedContactValues = Record<ImportedContactField, string | null> & { note: string | null };

type ContactRow = typeof contacts.$inferSelect;

function text(value: ImportCellValue | undefined): string | null {
  if (value === null || value === undefined) return null;
  const cleaned = String(value).replace(/\s+/g, " ").trim();
  return cleaned === "" ? null : cleaned.slice(0, TEXT_MAX);
}

// Un mot écrit tout en majuscules (« HENRY », « D'ALMEIDA », « LE-GOFF ») : un nom de famille, à la
// française. Une initiale (« J. ») n'en est pas un.
function isUpperWord(word: string): boolean {
  const letters = word.replace(/[^\p{L}]/gu, "");
  return letters.length >= 2 && letters === letters.toLocaleUpperCase("fr") && letters !== letters.toLocaleLowerCase("fr");
}

// Nom et prénom d'une seule colonne. Des mots en majuscules en tête ou en fin sont le nom ; sinon,
// l'ordre de la colonne décide (« NOM Prénom » : le premier mot est le nom). Un seul mot : le prénom
// (une personne a au moins un prénom).
export function splitPersonName(value: string, order: "lastFirst" | "firstLast"): { firstName: string | null; lastName: string | null } {
  const words = value.replace(/\s+/g, " ").trim().split(" ").filter((word) => word !== "");
  if (words.length === 0) return { firstName: null, lastName: null };
  if (words.length === 1) return { firstName: words[0]!, lastName: null };
  const upper = words.map(isUpperWord);
  if (upper.some(Boolean) && !upper.every(Boolean)) {
    let leading = 0;
    while (upper[leading]) leading += 1;
    if (leading > 0) return { firstName: words.slice(leading).join(" "), lastName: words.slice(0, leading).join(" ") };
    let trailing = 0;
    while (upper[words.length - 1 - trailing]) trailing += 1;
    if (trailing > 0) return { firstName: words.slice(0, words.length - trailing).join(" "), lastName: words.slice(words.length - trailing).join(" ") };
  }
  return order === "lastFirst"
    ? { firstName: words.slice(1).join(" "), lastName: words[0]! }
    : { firstName: words[0]!, lastName: words.slice(1).join(" ") };
}

// Valeurs d'une ligne : prénom et nom de leurs colonnes, sinon d'une colonne « nom complet » ; la
// note réunit la colonne « notes » et les colonnes gardées en champ libre (« Catégorie : client »).
// Null : la ligne n'a aucun nom (rejetée à la lecture).
export function importedContactValues(values: Record<string, ImportCellValue>, importedFields: Record<string, string> = {}): ImportedContactValues | null {
  const combined = text(values.lastFirstName) ?? text(values.firstLastName);
  const split = combined ? splitPersonName(combined, text(values.lastFirstName) ? "lastFirst" : "firstLast") : { firstName: null, lastName: null };
  let firstName = text(values.firstName) ?? split.firstName;
  let lastName = text(values.lastName) ?? split.lastName;
  if (!firstName && lastName) {
    firstName = lastName;
    lastName = null;
  }
  if (!firstName) return null;
  let email: string | null = null;
  try {
    email = normalizeContactEmail(text(values.email));
  } catch (error) {
    if (!(error instanceof ContactInvalidError)) throw error;
  }
  const noteParts = [
    text(values.notes),
    ...Object.entries(importedFields)
      .map(([header, value]) => [header.trim(), value.trim()] as const)
      .filter(([header, value]) => header !== "" && value !== "")
      .map(([header, value]) => `${header} : ${value}`),
  ].filter((part): part is string => part !== null);
  return {
    firstName,
    lastName,
    email,
    phone: text(values.phone),
    addressLine: text(values.addressLine),
    postalCode: text(values.postalCode),
    city: text(values.city),
    country: text(values.country),
    note: noteParts.length > 0 ? noteParts.join("\n").slice(0, CONTACT_NOTE_MAX) : null,
  };
}

function isAnonymized(row: ContactRow): boolean {
  return row.firstName === ANONYMIZED || row.name === ANONYMIZED;
}

function fieldsOf(row: ContactRow): Record<ImportedContactField, string | null> {
  return Object.fromEntries(IMPORTED_CONTACT_FIELDS.map((field) => [field, row[field]])) as Record<ImportedContactField, string | null>;
}

// Une valeur écrite par l'import a-t-elle changé depuis (à la main, ou par un autre écran) ?
function isModified(row: ContactRow, written: Record<string, unknown>): boolean {
  const current = fieldsOf(row) as Record<string, string | null>;
  return Object.entries(written).some(([field, value]) => field in current && (current[field] ?? null) !== (value ?? null));
}

export async function importContactRows(input: { organizationId: string; userId: string; rows: ImportApplyRow[] }): Promise<ImportApplyResult> {
  const { organizationId } = input;
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const items: ImportedItem[] = [];
    let unchanged = 0;
    const byId = async (id: string) => (await tx.select().from(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.id, id))))[0];
    const byEmail = async (email: string) => (await tx.select().from(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.email, email))))[0];

    for (const row of input.rows) {
      const values = importedContactValues(row.values, row.importedFields);
      if (!values) continue;
      const before = items.length;
      let target = row.matchId ? await byId(row.matchId) : undefined;
      if (target && (target.isDemo || isAnonymized(target) || target.kind !== "person")) target = undefined;
      let emailTaken = false;
      if (!target && values.email) {
        const owner = await byEmail(values.email);
        if (owner && !owner.isDemo && !isAnonymized(owner) && owner.kind === "person") target = owner;
        else if (owner) emailTaken = true;
      }

      let contactId: string;
      if (!target) {
        const written = Object.fromEntries(IMPORTED_CONTACT_FIELDS.map((field) => [field, field === "email" && emailTaken ? null : values[field]])) as Record<ImportedContactField, string | null>;
        const [created] = await tx
          .insert(contacts)
          .values({ organizationId, kind: "person", ...written, firstName: values.firstName! })
          .returning({ id: contacts.id });
        if (!created) throw new Error("contact importé non créé");
        contactId = created.id;
        items.push({ rowIndex: row.rowIndex, module: "hub", kind: "contact", elementId: contactId, action: "created", previous: null, written });
      } else {
        contactId = target.id;
        // Compléter : seulement les champs vides ; l'adresse e-mail, si aucun autre contact ne l'a.
        const patch: Partial<Record<ImportedContactField, string>> = {};
        for (const field of IMPORTED_CONTACT_FIELDS) {
          const value = values[field];
          if (value !== null && (target[field] ?? null) === null) patch[field] = value;
        }
        if (patch.email) {
          const [other] = await tx
            .select({ id: contacts.id })
            .from(contacts)
            .where(and(eq(contacts.organizationId, organizationId), eq(contacts.email, patch.email), ne(contacts.id, target.id)));
          if (other) delete patch.email;
        }
        if (Object.keys(patch).length > 0) {
          await tx.update(contacts).set(patch).where(and(eq(contacts.organizationId, organizationId), eq(contacts.id, target.id)));
          const previous = Object.fromEntries(Object.keys(patch).map((field) => [field, null]));
          items.push({ rowIndex: row.rowIndex, module: "hub", kind: "contact", elementId: target.id, action: "updated", previous, written: patch });
        }
      }

      // La note du fichier, si la fiche ne la porte pas déjà.
      if (values.note) {
        const [same] = await tx
          .select({ id: contactNotes.id })
          .from(contactNotes)
          .where(and(eq(contactNotes.organizationId, organizationId), eq(contactNotes.contactId, contactId), eq(contactNotes.body, values.note)))
          .limit(1);
        if (!same) {
          const [note] = await tx
            .insert(contactNotes)
            .values({ organizationId, contactId, authorUserId: input.userId, body: values.note })
            .returning({ id: contactNotes.id });
          if (!note) throw new Error("note importée non créée");
          items.push({ rowIndex: row.rowIndex, module: "hub", kind: "contact_note", elementId: note.id, action: "created", previous: null, written: { body: values.note } });
        }
      }
      if (items.length === before) unchanged += 1;
    }
    return { items, unchanged };
  });
}

// IMP-05 — éléments importés retouchés depuis l'import (signalés avant l'annulation).
export async function findModifiedImportedHubElements(
  organizationId: string,
  items: { kind: string; elementId: string; action: "created" | "updated"; written: Record<string, unknown> }[],
): Promise<boolean[]> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const flags: boolean[] = [];
    for (const item of items) {
      if (item.kind !== "contact") {
        flags.push(false);
        continue;
      }
      const [row] = await tx.select().from(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.id, item.elementId)));
      flags.push(row ? isModified(row, item.written) : false);
    }
    return flags;
  });
}

// IMP-05 — annulation, à l'envers de l'écriture : les notes importées sont retirées ; un contact créé
// est supprimé, sauf s'il a été retouché (sans confirmation), ou s'il sert depuis (une note de
// l'équipe, un foyer, une entreprise) ; un contact complété retrouve ses champs vides.
export async function undoImportedHubElements(organizationId: string, items: ImportUndoItem[]): Promise<ImportUndoOutcome[]> {
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const outcomes: ImportUndoOutcome[] = [];
    for (const item of items) {
      if (item.kind === "contact_note") {
        const removed = await tx
          .delete(contactNotes)
          .where(and(eq(contactNotes.organizationId, organizationId), eq(contactNotes.id, item.elementId)))
          .returning({ id: contactNotes.id });
        outcomes.push(removed.length > 0 ? "undone" : "missing");
        continue;
      }
      const [row] = await tx.select().from(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.id, item.elementId)));
      if (!row || item.kind !== "contact") {
        outcomes.push("missing");
        continue;
      }
      if (isModified(row, item.written) && !item.force) {
        outcomes.push("kept_modified");
        continue;
      }
      if (item.action === "updated") {
        await tx
          .update(contacts)
          .set(item.previous ?? {})
          .where(and(eq(contacts.organizationId, organizationId), eq(contacts.id, row.id)));
        outcomes.push("undone");
        continue;
      }
      const [note] = await tx.select({ id: contactNotes.id }).from(contactNotes).where(and(eq(contactNotes.organizationId, organizationId), eq(contactNotes.contactId, row.id))).limit(1);
      const [membership] = await tx
        .select({ id: contactMembers.id })
        .from(contactMembers)
        .where(and(eq(contactMembers.organizationId, organizationId), or(eq(contactMembers.groupContactId, row.id), eq(contactMembers.memberContactId, row.id))))
        .limit(1);
      if (note || membership) {
        outcomes.push("kept_in_use");
        continue;
      }
      await tx.delete(contacts).where(and(eq(contacts.organizationId, organizationId), eq(contacts.id, row.id)));
      outcomes.push("undone");
    }
    return outcomes;
  });
}

// IMP-03 — contacts auxquels une ligne peut être rapprochée : des personnes réelles de
// l'organisation, ni d'essai ni retirées par le RGPD.
export type ContactImportCandidate = { id: string; firstName: string; lastName: string | null; email: string | null; city: string | null };

export async function listContactImportCandidates(organizationId: string): Promise<ContactImportCandidate[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.organizationId, organizationId), eq(contacts.kind, "person"), eq(contacts.isDemo, false))),
  );
  return rows
    .filter((row) => !isAnonymized(row) && row.firstName)
    .map((row) => ({ id: row.id, firstName: row.firstName!, lastName: row.lastName, email: row.email, city: row.city }));
}
