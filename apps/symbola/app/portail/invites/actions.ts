"use server";

// Lot 49 (INV-02, INV-03, INV-04 ; D4, D5) — actions de la rubrique « Invités » du portail du
// client. L'accès est relu à chaque requête (lien valable, rubrique ouverte, modules ouverts) ;
// l'évènement est toujours celui du lien, jamais celui du formulaire. Aucun régime nominatif.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { issueGuestLink, recordHouseholdAnswers, saveHousehold } from "@/modules/guests/service";
import type { GuestFormState, GuestLinkState, ImportState } from "@/app/events/[id]/invites/actions";
import { guestErrorKey, parseHousehold } from "@/app/events/[id]/invites/form-schemas";
import { runImport } from "@/app/events/[id]/invites/import-runner";
import { isValidId } from "@/app/events/module-access";
import { portalGuestsAccess } from "./access";

async function translate(key: string): Promise<string> {
  const t = await getTranslations("Guests.errors");
  return t.has(key) ? t(key) : t("generic");
}

async function failure(error: unknown): Promise<{ error: string }> {
  const key = guestErrorKey(error);
  if (!key) throw error;
  return { error: await translate(key) };
}

export async function portalSaveHouseholdAction(_prev: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const access = await portalGuestsAccess();
  if (!access) return { error: await translate("denied") };
  const householdId = String(formData.get("householdId") ?? "");
  const input = parseHousehold(formData.get("household"));
  if (!input || (householdId && !isValidId(householdId))) return { error: await translate("household.person_name_missing") };
  try {
    await saveHousehold(access.organizationId, access.eventId, householdId || null, input);
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/portail/invites");
  return { success: true };
}

export async function portalImportAction(_prev: ImportState, formData: FormData): Promise<ImportState> {
  const access = await portalGuestsAccess();
  if (!access) return { error: await translate("denied") };
  return runImport(access.organizationId, access.eventId, formData, "client");
}

export async function portalRecordAnswersAction(_prev: GuestFormState, formData: FormData): Promise<GuestFormState> {
  const access = await portalGuestsAccess();
  if (!access) return { error: await translate("denied") };
  const householdId = String(formData.get("householdId") ?? "");
  if (!isValidId(householdId)) return { error: await translate("notFound") };
  const presence = [...formData.entries()].flatMap(([name, value]) => {
    const match = /^presence:([0-9a-f-]{36}):([0-9a-f-]{36})$/.exec(name);
    if (!match || (value !== "yes" && value !== "no")) return [];
    return [{ guestId: match[1]!, keyMomentId: match[2]!, attending: value === "yes" }];
  });
  try {
    await recordHouseholdAnswers(access.organizationId, access.eventId, householdId, presence, "client");
  } catch (error) {
    return failure(error);
  }
  revalidatePath("/portail/invites");
  return { success: true };
}

// D4 : le client envoie lui-même le lien d'un invité (SMS, messagerie) ou imprime son QR code.
export async function portalIssueLinkAction(_prev: GuestLinkState, formData: FormData): Promise<GuestLinkState> {
  const access = await portalGuestsAccess();
  if (!access) return { error: await translate("denied") };
  const guestId = String(formData.get("guestId") ?? "");
  if (!isValidId(guestId)) return { error: await translate("notFound") };
  try {
    return await issueGuestLink(access.organizationId, access.eventId, guestId);
  } catch (error) {
    return failure(error);
  }
}
