"use server";

// PRD-EVT-03 — actions des postes prestataires de la fiche d'un événement.
// Lot 28a (PRE-02, BUD-02) : le poste n'a plus de statut à lui ; il garde la
// case « Non requis » et le raccourci « prestataire retenu + montant », dont
// l'engagement au-delà du seuil d'alerte se confirme d'abord.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { parseAmountToCents } from "@symbola/i18n";
import {
  addEventVendorSlot,
  EventNotFoundError,
  listEventVendorSlots,
  removeEventVendorSlot,
  setEventVendorSlotIcon,
  updateEventVendorSlot,
  VendorNameRequiredError,
  VendorSlotNotFoundError,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";
import { ICON_KEYS } from "@/app/budget-line-icon";
import { engagementAlert } from "./engagement-alert";

// `confirm` : dépassement du seuil à confirmer avant l'engagement (BUD-02).
export type VendorSlotFormState = { error?: string; success?: boolean; confirm?: string };

async function authorize(t: Awaited<ReturnType<typeof getTranslations>>) {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") } as const;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") } as const;
  return { userId: auth.user.id, organizationId: auth.user.organizationId } as const;
}

export async function updateVendorSlotAction(
  _prevState: VendorSlotFormState,
  formData: FormData,
): Promise<VendorSlotFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };

  const eventId = String(formData.get("eventId") ?? "");
  const vendorSlotId = String(formData.get("vendorSlotId") ?? "");
  if (!isValidId(eventId) || !isValidId(vendorSlotId)) return { error: t("vendorSlotNotFound") };

  const amountCents = parseAmountToCents(String(formData.get("amount") ?? ""));
  if (amountCents === undefined) return { error: t("invalidAmount") };
  const vendorName = String(formData.get("vendorName") ?? "").trim();

  const slot = (await listEventVendorSlots(access.organizationId, eventId)).find((entry) => entry.id === vendorSlotId);
  if (!slot) return { error: t("vendorSlotNotFound") };
  // L'engagé augmente quand un autre prestataire est retenu, ou que le montant monte.
  const sameVendor = (slot.vendorName ?? "").trim().toLowerCase() === vendorName.toLowerCase();
  const raises = vendorName !== "" && amountCents !== null && (!sameVendor || amountCents > (slot.amountCents ?? 0));
  if (raises) {
    const confirm = await engagementAlert({
      organizationId: access.organizationId,
      eventId,
      vendorSlotId,
      amountCents,
      confirmed: formData.get("confirmed") === "1",
    });
    if (confirm) return { confirm };
  }

  try {
    await updateEventVendorSlot({
      organizationId: access.organizationId,
      vendorSlotId,
      changedByUserId: access.userId,
      notRequired: formData.get("notRequired") === "on",
      vendorName,
      amountCents,
    });
  } catch (error) {
    if (error instanceof VendorNameRequiredError) return { error: t("missingVendorName") };
    if (error instanceof VendorSlotNotFoundError) return { error: t("vendorSlotNotFound") };
    throw error;
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function addVendorSlotAction(
  _prevState: VendorSlotFormState,
  formData: FormData,
): Promise<VendorSlotFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };

  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: t("missingLabel") };

  try {
    await addEventVendorSlot(access.organizationId, eventId, label);
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    throw error;
  }

  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function removeVendorSlotAction(formData: FormData): Promise<void> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return;

  const eventId = String(formData.get("eventId") ?? "");
  const vendorSlotId = String(formData.get("vendorSlotId") ?? "");
  if (!isValidId(eventId) || !isValidId(vendorSlotId)) return;

  await removeEventVendorSlot(access.organizationId, vendorSlotId);
  revalidatePath(`/events/${eventId}`);
}

// Lot 12 (L12-EVT-14) : icône d'une ligne du budget de l'événement.
export async function setVendorSlotIconAction(_prevState: VendorSlotFormState, formData: FormData): Promise<VendorSlotFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = String(formData.get("eventId") ?? "");
  const vendorSlotId = String(formData.get("vendorSlotId") ?? "");
  if (!isValidId(eventId) || !isValidId(vendorSlotId)) return { error: t("vendorSlotNotFound") };
  const icon = String(formData.get("icon") ?? "");
  await setEventVendorSlotIcon(access.organizationId, vendorSlotId, (ICON_KEYS as readonly string[]).includes(icon) ? icon : null);
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}
