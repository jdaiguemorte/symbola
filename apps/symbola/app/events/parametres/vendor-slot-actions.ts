"use server";

// EVT-03 — liste de postes par défaut de l'organisation.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { starterVendorSlots, type StarterLocale } from "@symbola/starter-templates";
import { addDefaultVendorSlots, removeDefaultVendorSlot } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type DefaultVendorSlotFormState = { error?: string; success?: boolean; added?: number };

async function authorizedOrganizationId(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

export async function addDefaultVendorSlotAction(
  _prevState: DefaultVendorSlotFormState,
  formData: FormData,
): Promise<DefaultVendorSlotFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };

  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: t("missingLabel") };

  const added = await addDefaultVendorSlots(organizationId, [label]);
  revalidatePath("/events/parametres");
  return added.length > 0 ? { success: true, added: added.length } : { error: t("vendorSlotAlreadyExists") };
}

// Modèle de départ (packages/starter-templates), dans la langue de la
// planner ; les postes déjà présents ne sont pas dupliqués.
export async function loadStarterVendorSlotsAction(
  _prevState: DefaultVendorSlotFormState,
  _formData: FormData,
): Promise<DefaultVendorSlotFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };

  const locale = (await getLocale()) as StarterLocale;
  const added = await addDefaultVendorSlots(organizationId, starterVendorSlots(locale));
  revalidatePath("/events/parametres");
  return { success: true, added: added.length };
}

export async function removeDefaultVendorSlotAction(formData: FormData): Promise<void> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return;
  const defaultVendorSlotId = String(formData.get("defaultVendorSlotId") ?? "");
  if (!isValidId(defaultVendorSlotId)) return;
  await removeDefaultVendorSlot(organizationId, defaultVendorSlotId);
  revalidatePath("/events/parametres");
}
