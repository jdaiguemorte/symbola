"use server";

// Lot 36a (CRM-03, DAT-12, UX-02 ; ADR 0069) — le contact unique, pour toute l'équipe : créer un
// contact, modifier sa fiche, l'annoter, et le chercher pour l'ajouter comme client d'un évènement.
// Contrôles côté serveur : session, organisation (requirePlanner), et le service du hub (RLS).
// Une adresse e-mail déjà prise est refusée et nomme le contact qui la porte (DAT-12).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ContactInput, ContactKind } from "@symbola/contracts";
import { requirePlanner } from "@/lib/guards";
import {
  addContactMember,
  addContactNote,
  ContactEmailTakenError,
  ContactInvalidError,
  ContactMemberNotFoundError,
  ContactNoteNotFoundError,
  ContactNotFoundError,
  createContact,
  listContacts,
  removeContactMember,
  removeContactNote,
  updateContact,
} from "@/modules/hub/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Lot 36b : après une erreur, les valeurs saisies reviennent (`values`) avec une marque d'envoi
// (`at`) : le formulaire se reconstruit avec elles au lieu de se vider.
export type ContactFormState = { error?: string; existingContactId?: string; saved?: boolean; at?: number; values?: ContactInput };

const KINDS: readonly ContactKind[] = ["person", "household", "company"];

function kindOf(value: FormDataEntryValue | null): ContactKind {
  return KINDS.find((kind) => kind === value) ?? "person";
}

// Lot 36b : seuls les champs présents dans le formulaire sont écrits (un formulaire de foyer n'a pas
// de prénom ; il ne l'efface pas). La nature d'un contact ne change pas après sa création.
function contactInput(formData: FormData): ContactInput {
  const value = (name: string) => (formData.has(name) ? String(formData.get(name) ?? "") : undefined);
  const input: ContactInput = { kind: kindOf(formData.get("kind")) };
  for (const field of ["firstName", "lastName", "name", "email", "phone", "addressLine", "postalCode", "city", "country", "billingAddress", "companyIdNumber", "vatNumber"] as const) {
    const fieldValue = value(field);
    if (fieldValue !== undefined) input[field] = fieldValue;
  }
  return input;
}

async function failure(error: unknown, kind: ContactKind = "person"): Promise<ContactFormState> {
  const t = await getTranslations("Contacts");
  if (error instanceof ContactEmailTakenError) return { error: t("emailTaken"), existingContactId: error.existingContactId };
  if (error instanceof ContactInvalidError) {
    if (error.field === "email") return { error: t("invalidEmail") };
    if (error.field === "companyIdNumber") return { error: t("invalidCompanyIdNumber") };
    if (error.field === "vatNumber") return { error: t("invalidVatNumber") };
    return { error: kind === "person" ? t("missingFirstName") : t("missingName") };
  }
  if (error instanceof ContactNotFoundError) return { error: t("notFound") };
  throw error;
}

export async function createContactAction(_previous: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const auth = await requirePlanner();
  let id: string;
  const input = contactInput(formData);
  try {
    id = (await createContact(auth.user.organizationId, input)).id;
  } catch (error) {
    return { ...(await failure(error, input.kind)), at: Date.now(), values: input };
  }
  revalidatePath("/contacts");
  redirect(`/contacts/${id}`);
}

export async function updateContactAction(_previous: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const auth = await requirePlanner();
  const id = String(formData.get("contactId") ?? "");
  if (!UUID.test(id)) return failure(new ContactNotFoundError());
  const input = contactInput(formData);
  try {
    await updateContact(auth.user.organizationId, id, input);
  } catch (error) {
    return { ...(await failure(error, input.kind)), at: Date.now(), values: input };
  }
  revalidatePath(`/contacts/${id}`);
  return { saved: true, at: Date.now() };
}

export type NoteFormState = { error?: string; added?: boolean };

export async function addContactNoteAction(_previous: NoteFormState, formData: FormData): Promise<NoteFormState> {
  const auth = await requirePlanner();
  const t = await getTranslations("Contacts");
  const id = String(formData.get("contactId") ?? "");
  if (!UUID.test(id)) return { error: t("notFound") };
  try {
    await addContactNote(auth.user.organizationId, { contactId: id, authorUserId: auth.user.id, body: String(formData.get("body") ?? "") });
  } catch (error) {
    if (error instanceof ContactInvalidError) return { error: t("noteInvalid") };
    if (error instanceof ContactNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(`/contacts/${id}`);
  return { added: true };
}

export async function removeContactNoteAction(formData: FormData): Promise<void> {
  const auth = await requirePlanner();
  const id = String(formData.get("contactId") ?? "");
  const noteId = String(formData.get("noteId") ?? "");
  if (!UUID.test(id) || !UUID.test(noteId)) return;
  try {
    await removeContactNote(auth.user.organizationId, { noteId, authorUserId: auth.user.id });
  } catch (error) {
    if (!(error instanceof ContactNoteNotFoundError)) throw error;
  }
  revalidatePath(`/contacts/${id}`);
}

export type ContactChoice = { id: string; kind: ContactKind; displayName: string; email: string | null; city: string | null };

// Choix d'un contact existant (création d'un évènement, UX-02 ; membre d'un foyer, lot 36b) :
// quelques résultats, des natures demandées, jamais ceux d'une autre organisation (RLS).
export async function searchContactsAction(term: string, kinds?: readonly ContactKind[]): Promise<ContactChoice[]> {
  const auth = await requirePlanner();
  const search = term.trim().slice(0, 100);
  if (search.length < 2) return [];
  const wanted = kinds?.filter((kind) => KINDS.includes(kind));
  const { contacts } = await listContacts(auth.user.organizationId, { search });
  return contacts
    .filter((contact) => !wanted || wanted.length === 0 || wanted.includes(contact.kind))
    .slice(0, 8)
    .map(({ id, kind, displayName, email, city }) => ({ id, kind, displayName, email, city }));
}

// —— Foyers et entreprises (lot 36b, CRM-03, D2) ——————————————————————————————

export type MemberFormState = { error?: string; addedAt?: number };

export async function addContactMemberAction(_previous: MemberFormState, formData: FormData): Promise<MemberFormState> {
  const auth = await requirePlanner();
  const t = await getTranslations("Contacts");
  const groupContactId = String(formData.get("groupContactId") ?? "");
  const memberContactId = String(formData.get("memberContactId") ?? "");
  if (!UUID.test(groupContactId)) return { error: t("notFound") };
  if (!UUID.test(memberContactId)) return { error: t("memberInvalid") };
  try {
    await addContactMember(auth.user.organizationId, { groupContactId, memberContactId, role: String(formData.get("role") ?? "") });
  } catch (error) {
    if (error instanceof ContactInvalidError) return { error: error.field === "role" ? t("memberRoleInvalid") : t("memberInvalid") };
    if (error instanceof ContactNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(`/contacts/${groupContactId}`);
  return { addedAt: Date.now() };
}

export async function removeContactMemberAction(formData: FormData): Promise<void> {
  const auth = await requirePlanner();
  const groupContactId = String(formData.get("groupContactId") ?? "");
  const membershipId = String(formData.get("membershipId") ?? "");
  if (!UUID.test(groupContactId) || !UUID.test(membershipId)) return;
  try {
    await removeContactMember(auth.user.organizationId, membershipId);
  } catch (error) {
    if (!(error instanceof ContactMemberNotFoundError)) throw error;
  }
  revalidatePath(`/contacts/${groupContactId}`);
}
