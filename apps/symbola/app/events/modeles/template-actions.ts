"use server";

// EVT-04 — modèles de rétroplanning de l'organisation.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { starterRetroplanning, type StarterLocale } from "@symbola/starter-templates";
import {
  addTaskTemplateItem,
  createTaskTemplate,
  removeTaskTemplate,
  removeTaskTemplateItem,
  TASK_RESPONSIBLES,
  TaskLabelRequiredError,
  TaskTemplateNotFoundError,
  type TaskResponsible,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type TaskTemplateFormState = { error?: string; success?: boolean };

// Au-delà de trois ans avant ou après l'événement, la saisie est une erreur de frappe.
const MAX_OFFSET_DAYS = 1095;

async function authorizedOrganizationId(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

export async function createTaskTemplateAction(
  _prevState: TaskTemplateFormState,
  formData: FormData,
): Promise<TaskTemplateFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("missingLabel") };
  await createTaskTemplate(organizationId, name, []);
  revalidatePath("/events/modeles");
  return { success: true };
}

export async function addTaskTemplateItemAction(
  _prevState: TaskTemplateFormState,
  formData: FormData,
): Promise<TaskTemplateFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };

  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) return { error: t("taskTemplateNotFound") };
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: t("missingLabel") };
  const rawOffset = String(formData.get("offsetDays") ?? "").trim();
  const offsetDays = Number(rawOffset);
  if (!/^[+-]?\d+$/.test(rawOffset) || Math.abs(offsetDays) > MAX_OFFSET_DAYS) return { error: t("invalidOffset") };
  const responsible = String(formData.get("responsible") ?? "");
  if (!TASK_RESPONSIBLES.includes(responsible as TaskResponsible)) return { error: t("invalidResponsible") };

  try {
    await addTaskTemplateItem(organizationId, templateId, {
      label,
      offsetDays,
      responsible: responsible as TaskResponsible,
    });
  } catch (error) {
    if (error instanceof TaskTemplateNotFoundError) return { error: t("taskTemplateNotFound") };
    if (error instanceof TaskLabelRequiredError) return { error: t("missingLabel") };
    throw error;
  }
  revalidatePath("/events/modeles");
  return { success: true };
}

// Modèle de départ (packages/starter-templates), dans la langue de la
// planner : copié dans un nouveau modèle qu'elle adapte ensuite.
export async function loadStarterRetroplanningAction(
  _prevState: TaskTemplateFormState,
  _formData: FormData,
): Promise<TaskTemplateFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };

  const starter = starterRetroplanning((await getLocale()) as StarterLocale);
  await createTaskTemplate(organizationId, starter.name, starter.items);
  revalidatePath("/events/modeles");
  return { success: true };
}

export async function removeTaskTemplateItemAction(formData: FormData): Promise<void> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return;
  const itemId = String(formData.get("itemId") ?? "");
  if (!isValidId(itemId)) return;
  await removeTaskTemplateItem(organizationId, itemId);
  revalidatePath("/events/modeles");
}

export async function removeTaskTemplateAction(formData: FormData): Promise<void> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return;
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) return;
  await removeTaskTemplate(organizationId, templateId);
  revalidatePath("/events/modeles");
}
