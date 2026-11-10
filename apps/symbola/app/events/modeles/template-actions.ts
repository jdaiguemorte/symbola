"use server";

// EVT-04 — modèles de rétroplanning de l'organisation. Lot 21 (EVT-22) : la
// liste des modèles, puis le détail d'un modèle ; une tâche se modifie sans
// être recréée, un modèle se renomme.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { starterRetroplanning, type StarterLocale } from "@symbola/starter-templates";
import {
  addTaskTemplateItem,
  createTaskTemplate,
  removeTaskTemplate,
  removeTaskTemplateItem,
  renameTaskTemplate,
  TASK_RESPONSIBLES,
  TaskLabelRequiredError,
  TaskTemplateNotFoundError,
  updateTaskTemplateItem,
  type TaskResponsible,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type TaskTemplateFormState = { error?: string; success?: boolean };

const PATH = "/events/modeles";

// Au-delà de trois ans avant ou après l'événement, la saisie est une erreur de frappe.
const MAX_OFFSET_DAYS = 1095;

async function authorizedOrganizationId(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

// Le modèle créé s'ouvre aussitôt : on y ajoute ses tâches.
export async function createTaskTemplateAction(
  _prevState: TaskTemplateFormState,
  formData: FormData,
): Promise<TaskTemplateFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("missingLabel") };
  const template = await createTaskTemplate(organizationId, name, []);
  revalidatePath(PATH);
  redirect(`${PATH}/${template.id}`);
}

export async function renameTaskTemplateAction(
  _prevState: TaskTemplateFormState,
  formData: FormData,
): Promise<TaskTemplateFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) return { error: t("taskTemplateNotFound") };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("missingLabel") };
  try {
    await renameTaskTemplate(organizationId, templateId, name);
  } catch (error) {
    if (error instanceof TaskTemplateNotFoundError) return { error: t("taskTemplateNotFound") };
    throw error;
  }
  revalidatePath(PATH);
  redirect(`${PATH}/${templateId}`);
}

// Ajout (le panneau reste ouvert pour enchaîner les tâches) ou modification
// d'une tâche (le panneau se ferme).
export async function saveTaskTemplateItemAction(
  _prevState: TaskTemplateFormState,
  formData: FormData,
): Promise<TaskTemplateFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };

  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) return { error: t("taskTemplateNotFound") };
  const itemId = String(formData.get("itemId") ?? "");
  if (itemId && !isValidId(itemId)) return { error: t("taskTemplateNotFound") };
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: t("missingLabel") };
  const rawOffset = String(formData.get("offsetDays") ?? "").trim();
  const offsetDays = Number(rawOffset);
  if (!/^[+-]?\d+$/.test(rawOffset) || Math.abs(offsetDays) > MAX_OFFSET_DAYS) return { error: t("invalidOffset") };
  const responsible = String(formData.get("responsible") ?? "");
  if (!TASK_RESPONSIBLES.includes(responsible as TaskResponsible)) return { error: t("invalidResponsible") };
  const item = { label, offsetDays, responsible: responsible as TaskResponsible };

  try {
    if (itemId) await updateTaskTemplateItem(organizationId, itemId, item);
    else await addTaskTemplateItem(organizationId, templateId, item);
  } catch (error) {
    if (error instanceof TaskTemplateNotFoundError) return { error: t("taskTemplateNotFound") };
    if (error instanceof TaskLabelRequiredError) return { error: t("missingLabel") };
    throw error;
  }
  revalidatePath(`${PATH}/${templateId}`);
  if (itemId) redirect(`${PATH}/${templateId}`);
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
  revalidatePath(PATH);
  return { success: true };
}

export async function removeTaskTemplateItemAction(formData: FormData): Promise<void> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return;
  const itemId = String(formData.get("itemId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(itemId) || !isValidId(templateId)) return;
  await removeTaskTemplateItem(organizationId, itemId);
  revalidatePath(`${PATH}/${templateId}`);
}

export async function removeTaskTemplateAction(formData: FormData): Promise<void> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return;
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) return;
  await removeTaskTemplate(organizationId, templateId);
  revalidatePath(PATH);
  redirect(PATH);
}
