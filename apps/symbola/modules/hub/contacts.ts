// Lot 36a (CRM-03, DAT-12, UX-02, ARC-03 ; décisions D2 à D5, D8 ; ADR 0069) — le contact unique,
// dans le noyau du hub. Une personne, un foyer ou une entreprise n'existe qu'une fois dans
// l'organisation : les clients d'un évènement, les liens personnels et les signataires d'un devis
// ne gardent que son identifiant, et le lisent ici. Une adresse e-mail n'appartient qu'à un contact
// (DAT-12) : une adresse déjà connue reprend le contact qui la porte, ou est refusée sur un autre.
import { and, asc, count, desc, eq, ilike, inArray, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { z } from "zod";
import type { Contact, ContactInput, ContactKind, ContactMembership, ContactNote } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { contactMembers, contactNotes, contacts } from "@symbola/db/schema/hub";
import { foldedContains } from "@symbola/db/search";
import { inTrash, markDeleted, UNMARKED } from "@symbola/db/soft-delete";
import { withOrganization } from "@symbola/db/with-organization";
import { ANONYMIZED, prepareTerms, recordMatches, type PersonTerms } from "@symbola/privacy";
import { detectDuplicatesOf, resolveMergedContactIds } from "./contact-duplicates";

type ContactRow = typeof contacts.$inferSelect;

export class ContactNotFoundError extends Error {}
// L'adresse est déjà celle d'un autre contact de l'organisation (DAT-12).
export class ContactEmailTakenError extends Error {
  constructor(readonly existingContactId: string) {
    super("adresse e-mail déjà utilisée");
  }
}
export class ContactInvalidError extends Error {
  constructor(readonly field: "name" | "email" | "note" | "companyIdNumber" | "vatNumber" | "member" | "role") {
    super(field);
  }
}
// Seul l'auteur d'une note la retire.
export class ContactNoteNotFoundError extends Error {}

export const CONTACT_NOTE_MAX = 2000;
const TEXT_MAX = 300;
const LIST_PAGE_SIZE = 50;

const emailSchema = z.email();

function clean(value: string | null | undefined): string | null {
  const text = value?.trim() ?? "";
  return text === "" ? null : text.slice(0, TEXT_MAX);
}

// Lot 36b (SC-11) : SIREN (9 chiffres) ou SIRET (14), espaces et points retirés.
export function normalizeCompanyIdNumber(value: string | null | undefined): string | null {
  const digits = value?.replace(/[\s.]/g, "") ?? "";
  if (digits === "") return null;
  if (!/^[0-9]{9}([0-9]{5})?$/.test(digits)) throw new ContactInvalidError("companyIdNumber");
  return digits;
}

// Numéro de TVA intracommunautaire : deux lettres de pays puis 2 à 13 caractères, sans espaces.
export function normalizeVatNumber(value: string | null | undefined): string | null {
  const compact = value?.replace(/\s/g, "").toUpperCase() ?? "";
  if (compact === "") return null;
  if (!/^[A-Z]{2}[0-9A-Z]{2,13}$/.test(compact)) throw new ContactInvalidError("vatNumber");
  return compact;
}

export function normalizeContactEmail(value: string | null | undefined): string | null {
  const email = value?.trim().toLowerCase() ?? "";
  if (email === "") return null;
  if (!emailSchema.safeParse(email).success) throw new ContactInvalidError("email");
  return email;
}

export function displayNameOf(row: Pick<ContactRow, "kind" | "firstName" | "lastName" | "name">): string {
  if (row.kind === "person") return [row.firstName, row.lastName].filter(Boolean).join(" ");
  return row.name ?? "";
}

function toContact(row: ContactRow): Contact {
  return {
    id: row.id,
    kind: row.kind,
    firstName: row.firstName,
    lastName: row.lastName,
    name: row.name,
    displayName: displayNameOf(row),
    anonymized: row.firstName === ANONYMIZED || row.name === ANONYMIZED,
    isDemo: row.isDemo,
    email: row.email,
    phone: row.phone,
    addressLine: row.addressLine,
    postalCode: row.postalCode,
    city: row.city,
    country: row.country,
    billingAddress: row.billingAddress,
    companyIdNumber: row.companyIdNumber,
    vatNumber: row.vatNumber,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// Valeurs d'un contact à écrire : une personne a un prénom, un foyer ou une entreprise un nom.
function contactValues(input: ContactInput, kind: ContactKind) {
  const firstName = clean(input.firstName);
  const name = clean(input.name);
  if (kind === "person" ? !firstName : !name) throw new ContactInvalidError("name");
  return {
    kind,
    firstName: kind === "person" ? firstName : null,
    lastName: kind === "person" ? clean(input.lastName) : null,
    name: kind === "person" ? null : name,
    email: normalizeContactEmail(input.email),
    phone: clean(input.phone),
    addressLine: clean(input.addressLine),
    postalCode: clean(input.postalCode),
    city: clean(input.city),
    country: clean(input.country),
    billingAddress: input.billingAddress?.trim() ? input.billingAddress.trim().slice(0, 1000) : null,
    // Lot 36b : identifiants d'une entreprise seulement.
    companyIdNumber: kind === "company" ? normalizeCompanyIdNumber(input.companyIdNumber) : null,
    vatNumber: kind === "company" ? normalizeVatNumber(input.vatNumber) : null,
  };
}

async function contactIdByEmail(organizationId: string, email: string, exceptId?: string): Promise<string | null> {
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(and(eq(contacts.organizationId, organizationId), eq(contacts.email, email), ...(exceptId ? [ne(contacts.id, exceptId)] : []))),
  );
  return row?.id ?? null;
}

// Contacts par identifiant, pour les modules qui les affichent (clients d'un évènement, signataires).
// Lot 45 (CRM-07, D5) : un identifiant d'une fiche absorbée par une fusion donne la fiche gardée, le
// temps que les modules repointent leurs références.
export async function getContactsByIds(organizationId: string, ids: readonly string[]): Promise<Map<string, Contact>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const select = (wanted: string[]) =>
    withOrganization(appDatabase(), organizationId, (tx) =>
      tx
        .select()
        .from(contacts)
        .where(and(eq(contacts.organizationId, organizationId), inArray(contacts.id, wanted))),
    );
  const rows = await select(unique);
  const found = new Map(rows.map((row) => [row.id, toContact(row)]));
  const missing = unique.filter((id) => !found.has(id));
  if (missing.length > 0) {
    const merged = await resolveMergedContactIds(organizationId, missing);
    if (merged.size > 0) {
      const keptRows = await select([...new Set(merged.values())]);
      for (const [absorbed, kept] of merged) {
        const row = keptRows.find((candidate) => candidate.id === kept);
        if (row) found.set(absorbed, toContact(row));
      }
    }
  }
  return found;
}

export async function getContact(organizationId: string, id: string): Promise<Contact | null> {
  return (await getContactsByIds(organizationId, [id])).get(id) ?? null;
}

export async function findContactByEmail(organizationId: string, email: string): Promise<Contact | null> {
  const normalized = normalizeContactEmail(email);
  if (!normalized) return null;
  const id = await contactIdByEmail(organizationId, normalized);
  return id ? getContact(organizationId, id) : null;
}

// Crée un contact ; une adresse déjà prise est refusée, avec le contact qui la porte (DAT-12).
export async function createContact(organizationId: string, input: ContactInput, options: { isDemo?: boolean } = {}): Promise<Contact> {
  const values = contactValues(input, input.kind ?? "person");
  if (values.email) {
    const existing = await contactIdByEmail(organizationId, values.email);
    if (existing) throw new ContactEmailTakenError(existing);
  }
  try {
    const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
      tx
        .insert(contacts)
        .values({ organizationId, ...values, isDemo: options.isDemo ?? false })
        .returning(),
    );
    if (!row) throw new Error("création du contact échouée");
    // Lot 45 (CRM-07) : détection des doublons à la saisie (jamais bloquante).
    if (!row.isDemo) await detectDuplicatesOf(organizationId, row.id).catch(() => undefined);
    return toContact(row);
  } catch (error) {
    // Deux créations simultanées de la même adresse : l'index unique n'en garde qu'une.
    if (values.email) {
      const existing = await contactIdByEmail(organizationId, values.email);
      if (existing) throw new ContactEmailTakenError(existing);
    }
    throw error;
  }
}

// Le contact d'un client, d'un signataire, d'une ligne importée (UX-02) : celui qu'on a choisi, ou
// celui qui porte déjà l'adresse e-mail donnée, ou un nouveau.
export async function resolveContact(organizationId: string, input: ContactInput & { contactId?: string | null }, options: { isDemo?: boolean } = {}): Promise<Contact> {
  if (input.contactId) {
    const chosen = await getContact(organizationId, input.contactId);
    if (!chosen || chosen.anonymized) throw new ContactNotFoundError();
    return chosen;
  }
  const email = normalizeContactEmail(input.email);
  if (email) {
    const existing = await findContactByEmail(organizationId, email);
    if (existing) return existing;
  }
  try {
    return await createContact(organizationId, input, options);
  } catch (error) {
    if (error instanceof ContactEmailTakenError) {
      const existing = await getContact(organizationId, error.existingContactId);
      if (existing) return existing;
    }
    throw error;
  }
}

// Identité et coordonnées d'un contact ; un champ absent du patch garde sa valeur. Une adresse prise
// par un autre contact est refusée (DAT-12). Un contact anonymisé par le RGPD ne se modifie plus.
export async function updateContact(organizationId: string, id: string, patch: ContactInput): Promise<Contact> {
  const current = await getContact(organizationId, id);
  if (!current || current.anonymized) throw new ContactNotFoundError();
  const merged: ContactInput = {
    kind: current.kind,
    firstName: patch.firstName !== undefined ? patch.firstName : current.firstName,
    lastName: patch.lastName !== undefined ? patch.lastName : current.lastName,
    name: patch.name !== undefined ? patch.name : current.name,
    email: patch.email !== undefined ? patch.email : current.email,
    phone: patch.phone !== undefined ? patch.phone : current.phone,
    addressLine: patch.addressLine !== undefined ? patch.addressLine : current.addressLine,
    postalCode: patch.postalCode !== undefined ? patch.postalCode : current.postalCode,
    city: patch.city !== undefined ? patch.city : current.city,
    country: patch.country !== undefined ? patch.country : current.country,
    billingAddress: patch.billingAddress !== undefined ? patch.billingAddress : current.billingAddress,
    companyIdNumber: patch.companyIdNumber !== undefined ? patch.companyIdNumber : current.companyIdNumber,
    vatNumber: patch.vatNumber !== undefined ? patch.vatNumber : current.vatNumber,
  };
  const values = contactValues(merged, current.kind);
  if (values.email) {
    const existing = await contactIdByEmail(organizationId, values.email, id);
    if (existing) throw new ContactEmailTakenError(existing);
  }
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .update(contacts)
      .set(values)
      .where(and(eq(contacts.organizationId, organizationId), eq(contacts.id, id)))
      .returning(),
  );
  if (!row) throw new ContactNotFoundError();
  if (!row.isDemo && (values.email !== current.email || values.phone !== current.phone)) await detectDuplicatesOf(organizationId, row.id).catch(() => undefined);
  return toContact(row);
}

export type ContactListItem = Pick<Contact, "id" | "kind" | "displayName" | "email" | "phone" | "city" | "updatedAt">;

// Liste des contacts (écran « Contacts ») : recherche par nom, e-mail ou téléphone, par page ; ni
// les contacts d'essai, ni ceux retirés par le RGPD.
export async function listContacts(
  organizationId: string,
  options: { search?: string | null; page?: number } = {},
): Promise<{ contacts: ContactListItem[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, options.page ?? 1);
  const term = options.search?.trim();
  const conditions = [eq(contacts.organizationId, organizationId), eq(contacts.isDemo, false), sql`coalesce(${contacts.firstName}, ${contacts.name}) <> ${ANONYMIZED}`];
  if (term) {
    const like = `%${term}%`;
    conditions.push(
      or(
        ilike(contacts.firstName, like),
        ilike(contacts.lastName, like),
        ilike(contacts.name, like),
        ilike(sql`concat_ws(' ', ${contacts.firstName}, ${contacts.lastName})`, like),
        ilike(contacts.email, like),
        ilike(contacts.phone, like),
      )!,
    );
  }
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const [total] = await tx.select({ value: count() }).from(contacts).where(and(...conditions));
    const rows = await tx
      .select()
      .from(contacts)
      .where(and(...conditions))
      .orderBy(asc(sql`lower(coalesce(${contacts.lastName}, ${contacts.name}, ${contacts.firstName}))`), asc(sql`lower(coalesce(${contacts.firstName}, ''))`), asc(contacts.id))
      .limit(LIST_PAGE_SIZE)
      .offset((page - 1) * LIST_PAGE_SIZE);
    return {
      contacts: rows.map(toContact).map(({ id, kind, displayName, email, phone, city, updatedAt }) => ({ id, kind, displayName, email, phone, city, updatedAt })),
      total: Number(total?.value ?? 0),
      page,
      pageSize: LIST_PAGE_SIZE,
    };
  });
}

// Identifiants des contacts dont le nom, l'adresse e-mail ou le téléphone contient le terme : pour
// la recherche des évènements par client, et la recherche globale.
export async function searchContactIds(organizationId: string, term: string, limit = 200): Promise<string[]> {
  if (term.trim() === "") return [];
  const like = `%${term.trim()}%`;
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, organizationId),
          or(
            ilike(contacts.firstName, like),
            ilike(contacts.lastName, like),
            ilike(contacts.name, like),
            ilike(sql`concat_ws(' ', ${contacts.firstName}, ${contacts.lastName})`, like),
            ilike(contacts.email, like),
            ilike(contacts.phone, like),
          ),
        ),
      )
      .limit(limit),
  );
  return rows.map((row) => row.id);
}

// Recherche globale (AIDE-08) : contacts dont le nom, l'adresse ou le téléphone contient le mot
// replié (sans accents ni casse), comme les autres recherches de l'app.
export async function searchContactIdsByWord(organizationId: string, word: string, limit = 500): Promise<string[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select({ id: contacts.id })
      .from(contacts)
      .where(
        and(
          eq(contacts.organizationId, organizationId),
          eq(contacts.isDemo, false),
          foldedContains(sql`concat_ws(' ', ${contacts.firstName}, ${contacts.lastName}, ${contacts.name}, ${contacts.email}, ${contacts.phone})`, word),
        ),
      )
      .limit(limit),
  );
  return rows.map((row) => row.id);
}

// RGPD-01 : contacts dont un champ personnel correspond à la personne cherchée (mêmes règles de
// correspondance que les autres modules) ; ni ceux d'un essai, ni ceux déjà anonymisés.
export async function findContactsByTerms(organizationId: string, terms: PersonTerms): Promise<Contact[]> {
  const prepared = prepareTerms(terms);
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.organizationId, organizationId), eq(contacts.isDemo, false))),
  );
  return rows
    .map(toContact)
    .filter((contact) => !contact.anonymized && recordMatches([contact.firstName, contact.lastName, contact.name, contact.email, contact.phone, contact.addressLine, contact.city, contact.billingAddress], prepared));
}

// RGPD-03 et RGPD-05 : nom remplacé par « [anonymisé] », coordonnées, notes et rôles effacés. La
// ligne reste, pour que les évènements et les statistiques restent justes.
export async function anonymizeContacts(organizationId: string, ids: readonly string[]): Promise<number> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return 0;
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    await tx.delete(contactNotes).where(and(eq(contactNotes.organizationId, organizationId), inArray(contactNotes.contactId, unique)));
    // Lot 36b : le rôle d'une personne dans un foyer ou une entreprise s'efface avec elle.
    await tx
      .update(contactMembers)
      .set({ role: null })
      .where(and(eq(contactMembers.organizationId, organizationId), or(inArray(contactMembers.groupContactId, unique), inArray(contactMembers.memberContactId, unique))));
    const rows = await tx
      .update(contacts)
      .set({
        firstName: sql`case when ${contacts.kind} = 'person' then ${ANONYMIZED} else null end`,
        lastName: null,
        name: sql`case when ${contacts.kind} = 'person' then null else ${ANONYMIZED} end`,
        email: null,
        phone: null,
        addressLine: null,
        postalCode: null,
        city: null,
        country: null,
        billingAddress: null,
        companyIdNumber: null,
        vatNumber: null,
      })
      .where(and(eq(contacts.organizationId, organizationId), inArray(contacts.id, unique)))
      .returning({ id: contacts.id });
    return rows.length;
  });
}

// Fin d'un essai guidé (AIDE-02) et annulation d'un import : contacts supprimés, notes comprises.
// `demoOnly` : seulement ceux marqués d'essai.
export async function deleteContacts(organizationId: string, ids: readonly string[], options: { demoOnly?: boolean } = {}): Promise<number> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return 0;
  return withOrganization(appDatabase(), organizationId, async (tx) => {
    const rows = await tx
      .delete(contacts)
      .where(and(eq(contacts.organizationId, organizationId), inArray(contacts.id, unique), ...(options.demoOnly ? [eq(contacts.isDemo, true)] : [])))
      .returning({ id: contacts.id });
    return rows.length;
  });
}

// D9 (RGPD-05) : contacts réels, non anonymisés, modifiés pour la dernière fois avant la date donnée
// (la purge les propose s'ils n'ont aucun évènement).
export async function listContactsUnchangedSince(organizationId: string, before: Date): Promise<{ id: string; displayName: string; updatedAt: Date }[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(contacts)
      .where(and(eq(contacts.organizationId, organizationId), eq(contacts.isDemo, false), sql`${contacts.updatedAt} < ${before.toISOString()}::timestamptz`)),
  );
  return rows
    .map(toContact)
    .filter((contact) => !contact.anonymized)
    .map((contact) => ({ id: contact.id, displayName: contact.displayName, updatedAt: contact.updatedAt }));
}

// —— Notes (CRM-03) ——————————————————————————————————————————————————————————————

function toNote(row: typeof contactNotes.$inferSelect): ContactNote {
  return { id: row.id, contactId: row.contactId, authorUserId: row.authorUserId, body: row.body, createdAt: row.createdAt };
}

export async function listContactNotes(organizationId: string, contactId: string): Promise<ContactNote[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(contactNotes)
      .where(and(eq(contactNotes.organizationId, organizationId), eq(contactNotes.contactId, contactId)))
      .orderBy(desc(contactNotes.createdAt)),
  );
  return rows.map(toNote);
}

export async function addContactNote(organizationId: string, input: { contactId: string; authorUserId: string; body: string }): Promise<ContactNote> {
  const body = input.body.trim();
  if (body === "" || body.length > CONTACT_NOTE_MAX) throw new ContactInvalidError("note");
  const contact = await getContact(organizationId, input.contactId);
  if (!contact || contact.anonymized) throw new ContactNotFoundError();
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx.insert(contactNotes).values({ organizationId, contactId: input.contactId, authorUserId: input.authorUserId, body }).returning(),
  );
  if (!row) throw new Error("note non enregistrée");
  return toNote(row);
}

// Lot 39a (UX-07 ; ADR 0073) : la note est marquée, « Annuler » la démarque ; la purge l'efface.
export async function removeContactNote(organizationId: string, input: { noteId: string; authorUserId: string }): Promise<void> {
  const rows = await inTrash(organizationId, (tx) =>
    tx
      .update(contactNotes)
      .set(markDeleted())
      .where(and(eq(contactNotes.id, input.noteId), eq(contactNotes.authorUserId, input.authorUserId), isNull(contactNotes.deletedAt)))
      .returning({ id: contactNotes.id }),
  );
  if (rows.length === 0) throw new ContactNoteNotFoundError();
}

export async function restoreContactNote(organizationId: string, input: { noteId: string; authorUserId: string }): Promise<boolean> {
  const rows = await inTrash(organizationId, (tx) =>
    tx
      .update(contactNotes)
      .set(UNMARKED)
      .where(and(eq(contactNotes.id, input.noteId), eq(contactNotes.authorUserId, input.authorUserId), isNotNull(contactNotes.deletedAt)))
      .returning({ id: contactNotes.id }),
  );
  return rows.length > 0;
}

// —— Foyers et entreprises (lot 36b, CRM-03, D2) ————————————————————————————————————

export class ContactMemberNotFoundError extends Error {}

const ROLE_MAX = 100;

function membershipOf(row: typeof contactMembers.$inferSelect, other: Contact): ContactMembership {
  return {
    id: row.id,
    groupContactId: row.groupContactId,
    memberContactId: row.memberContactId,
    role: row.role,
    contact: { id: other.id, kind: other.kind, displayName: other.displayName, email: other.email, anonymized: other.anonymized },
  };
}

// Les personnes d'un foyer ou d'une entreprise, dans l'ordre où elles ont été ajoutées.
export async function listContactMembers(organizationId: string, groupContactId: string): Promise<ContactMembership[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(contactMembers)
      .where(and(eq(contactMembers.organizationId, organizationId), eq(contactMembers.groupContactId, groupContactId)))
      .orderBy(asc(contactMembers.createdAt), asc(contactMembers.id)),
  );
  const people = await getContactsByIds(organizationId, rows.map((row) => row.memberContactId));
  return rows.flatMap((row) => {
    const person = people.get(row.memberContactId);
    return person ? [membershipOf(row, person)] : [];
  });
}

// Les foyers et entreprises dont une personne fait partie.
export async function listContactGroups(organizationId: string, memberContactId: string): Promise<ContactMembership[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(contactMembers)
      .where(and(eq(contactMembers.organizationId, organizationId), eq(contactMembers.memberContactId, memberContactId)))
      .orderBy(asc(contactMembers.createdAt), asc(contactMembers.id)),
  );
  const groups = await getContactsByIds(organizationId, rows.map((row) => row.groupContactId));
  return rows.flatMap((row) => {
    const group = groups.get(row.groupContactId);
    return group ? [membershipOf(row, group)] : [];
  });
}

// Rattache une personne à un foyer ou à une entreprise, avec un rôle libre ; déjà rattachée, son
// rôle est mis à jour. Les deux contacts doivent exister dans l'organisation, hors essai et hors
// RGPD ; un foyer ou une entreprise ne se rattache pas à un autre.
export async function addContactMember(organizationId: string, input: { groupContactId: string; memberContactId: string; role?: string | null }): Promise<ContactMembership> {
  const role = input.role?.trim() ? input.role.trim() : null;
  if (role && role.length > ROLE_MAX) throw new ContactInvalidError("role");
  if (input.groupContactId === input.memberContactId) throw new ContactInvalidError("member");
  const found = await getContactsByIds(organizationId, [input.groupContactId, input.memberContactId]);
  const group = found.get(input.groupContactId);
  const member = found.get(input.memberContactId);
  if (!group || group.anonymized || group.isDemo || !member || member.anonymized || member.isDemo) throw new ContactNotFoundError();
  if (group.kind === "person" || member.kind !== "person") throw new ContactInvalidError("member");
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .insert(contactMembers)
      .values({ organizationId, groupContactId: group.id, memberContactId: member.id, role })
      .onConflictDoUpdate({ target: [contactMembers.groupContactId, contactMembers.memberContactId], set: { role } })
      .returning(),
  );
  if (!row) throw new Error("membre non enregistré");
  return membershipOf(row, member);
}

export async function removeContactMember(organizationId: string, membershipId: string): Promise<void> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .delete(contactMembers)
      .where(and(eq(contactMembers.organizationId, organizationId), eq(contactMembers.id, membershipId)))
      .returning({ id: contactMembers.id }),
  );
  if (rows.length === 0) throw new ContactMemberNotFoundError();
}

// Lot 39b (UX-09 ; D8 ; ADR 0074) — version d'une fiche (date et auteur de la dernière modification),
// pour l'enregistrement automatique : une modification faite entre-temps est fusionnée ou signalée.
export async function getContactStamp(organizationId: string, id: string): Promise<{ updatedAt: Date; updatedBy: string | null } | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) return null;
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) =>
    tx.select({ updatedAt: contacts.updatedAt, updatedBy: contacts.updatedBy }).from(contacts).where(eq(contacts.id, id)),
  );
  return row ?? null;
}
