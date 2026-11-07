"use server";

// EVT-03 — liste de postes par défaut de l'organisation.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { starterVendorSlots, type StarterLocale } from "@symbola/starter-templates";
import { z } from "zod";
import { addDefaultVendorSlots, removeDefaultVendorSlot, reorderDefaultVendorSlots, VendorSlotNotFoundError } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";
import { ICON_KEYS } from "@/app/budget-line-icon";

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

  // Lot 13 (HUB-16) : l'icône se choisit dès l'ajout, depuis le panneau latéral.
  const iconValue = String(formData.get("icon") ?? "");
  const icon = (ICON_KEYS as readonly string[]).includes(iconValue) ? iconValue : null;
  const added = await addDefaultVendorSlots(organizationId, [{ label, icon }]);
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

// Lot 13 (HUB-16) — nouvel ordre des lignes du budget (glisser-déposer ou
// boutons « Monter » / « Descendre »). Renvoie false si la liste ne
// correspond plus aux lignes enregistrées (modifiées entre-temps).
const orderSchema = z.array(z.uuid()).min(1).max(200);

export async function reorderDefaultVendorSlotsAction(orderedIds: unknown): Promise<boolean> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return false;
  const parsed = orderSchema.safeParse(orderedIds);
  if (!parsed.success) return false;
  try {
    await reorderDefaultVendorSlots(organizationId, parsed.data);
  } catch (error) {
    if (error instanceof VendorSlotNotFoundError) return false;
    throw error;
  }
  revalidatePath("/events/parametres");
  return true;
}
