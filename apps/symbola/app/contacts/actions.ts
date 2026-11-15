"use server";

// Lot 36a (CRM-03, DAT-12, UX-02 ; ADR 0069) — le contact unique, pour toute l'équipe : créer un
// contact, modifier sa fiche, l'annoter, et le chercher pour l'ajouter comme client d'un évènement.
// Contrôles côté serveur : session, organisation (requirePlanner), et le service du hub (RLS).
// Une adresse e-mail déjà prise est refusée et nomme le contact qui la porte (DAT-12).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import type { ContactInput } from "@symbola/contracts";
import { requirePlanner } from "@/lib/guards";
import {
  addContactNote,
  ContactEmailTakenError,
  ContactInvalidError,
  ContactNoteNotFoundError,
  ContactNotFoundError,
  createContact,
  listContacts,
  removeContactNote,
  updateContact,
} from "@/modules/hub/service";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ContactFormState = { error?: string; existingContactId?: string; saved?: boolean };

function contactInput(formData: FormData): ContactInput {
  const value = (name: string) => String(formData.get(name) ?? "");
  return {
    kind: "person",
    firstName: value("firstName"),
    lastName: value("lastName"),
    email: value("email"),
    phone: value("phone"),
    addressLine: value("addressLine"),
    postalCode: value("postalCode"),
    city: value("city"),
    country: value("country"),
    billingAddress: value("billingAddress"),
  };
}

async function failure(error: unknown): Promise<ContactFormState> {
  const t = await getTranslations("Contacts");
  if (error instanceof ContactEmailTakenError) return { error: t("emailTaken"), existingContactId: error.existingContactId };
  if (error instanceof ContactInvalidError) return { error: error.field === "email" ? t("invalidEmail") : t("missingFirstName") };
  if (error instanceof ContactNotFoundError) return { error: t("notFound") };
  throw error;
}

export async function createContactAction(_previous: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const auth = await requirePlanner();
  let id: string;
  try {
    id = (await createContact(auth.user.organizationId, contactInput(formData))).id;
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/contacts");
  redirect(`/contacts/${id}`);
}

export async function updateContactAction(_previous: ContactFormState, formData: FormData): Promise<ContactFormState> {
  const auth = await requirePlanner();
  const id = String(formData.get("contactId") ?? "");
  if (!UUID.test(id)) return failure(new ContactNotFoundError());
  try {
    await updateContact(auth.user.organizationId, id, contactInput(formData));
  } catch (error) {
    return failure(error);
  }
  revalidatePath(`/contacts/${id}`);
  return { saved: true };
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

export type ContactChoice = { id: string; displayName: string; email: string | null; city: string | null };

// Choix d'un contact existant (création d'un évènement, UX-02) : quelques résultats, jamais ceux
// d'une autre organisation (RLS).
export async function searchContactsAction(term: string): Promise<ContactChoice[]> {
  const auth = await requirePlanner();
  const search = term.trim().slice(0, 100);
  if (search.length < 2) return [];
  const { contacts } = await listContacts(auth.user.organizationId, { search });
  return contacts.slice(0, 8).map(({ id, displayName, email, city }) => ({ id, displayName, email, city }));
}
