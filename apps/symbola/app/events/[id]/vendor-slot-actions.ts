"use server";

// EVT-03 — actions des postes prestataires de la fiche d'un événement.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { parseAmountToCents } from "@symbola/i18n";
import {
  addEventVendorSlot,
  EventNotFoundError,
  removeEventVendorSlot,
  updateEventVendorSlot,
  VENDOR_SLOT_STATUSES,
  VendorNameRequiredError,
  VendorSlotNotFoundError,
  type VendorSlotStatus,
} from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type VendorSlotFormState = { error?: string; success?: boolean };

async function authorize(t: Awaited<ReturnType<typeof getTranslations>>) {
  const auth = await getAuthContext();
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

  const status = String(formData.get("status") ?? "");
  if (!VENDOR_SLOT_STATUSES.includes(status as VendorSlotStatus)) return { error: t("invalidStatus") };

  const amountCents = parseAmountToCents(String(formData.get("amount") ?? ""));
  if (amountCents === undefined) return { error: t("invalidAmount") };

  try {
    await updateEventVendorSlot({
      organizationId: access.organizationId,
      vendorSlotId,
      changedByUserId: access.userId,
      status: status as VendorSlotStatus,
      vendorName: String(formData.get("vendorName") ?? ""),
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
