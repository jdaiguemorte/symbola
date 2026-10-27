"use server";

// EVT-05 — modèles de programme du jour J de l'organisation.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { starterProgram, type StarterLocale } from "@symbola/starter-templates";
import {
  addProgramTemplateItem,
  createProgramTemplate,
  ProgramTemplateNotFoundError,
  removeProgramTemplate,
  removeProgramTemplateItem,
  TaskLabelRequiredError,
} from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type ProgramTemplateFormState = { error?: string; success?: boolean };

const PATH = "/events/modeles-programme";

async function authorizedOrganizationId(): Promise<string | null> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

export async function createProgramTemplateAction(
  _prevState: ProgramTemplateFormState,
  formData: FormData,
): Promise<ProgramTemplateFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("missingLabel") };
  await createProgramTemplate(organizationId, name, []);
  revalidatePath(PATH);
  return { success: true };
}

export async function addProgramTemplateItemAction(
  _prevState: ProgramTemplateFormState,
  formData: FormData,
): Promise<ProgramTemplateFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) return { error: t("programTemplateNotFound") };

  try {
    await addProgramTemplateItem(organizationId, templateId, {
      startTime: String(formData.get("startTime") ?? ""),
      endTime: String(formData.get("endTime") ?? ""),
      label: String(formData.get("label") ?? ""),
      location: String(formData.get("location") ?? ""),
      participantLabels: String(formData.get("participantLabels") ?? "").split(","),
    });
  } catch (error) {
    if (error instanceof ProgramTemplateNotFoundError) return { error: t("programTemplateNotFound") };
    if (error instanceof TaskLabelRequiredError) return { error: t("missingLabel") };
    if (error instanceof RangeError) return { error: t("invalidTime") };
    throw error;
  }
  revalidatePath(PATH);
  return { success: true };
}

// Modèle de départ (packages/starter-templates), dans la langue de la
// planner : copié dans un nouveau modèle qu'elle adapte ensuite.
export async function loadStarterProgramAction(
  _prevState: ProgramTemplateFormState,
  _formData: FormData,
): Promise<ProgramTemplateFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };
  const starter = starterProgram((await getLocale()) as StarterLocale);
  await createProgramTemplate(organizationId, starter.name, starter.items);
  revalidatePath(PATH);
  return { success: true };
}

export async function removeProgramTemplateItemAction(formData: FormData): Promise<void> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return;
  const itemId = String(formData.get("itemId") ?? "");
  if (!isValidId(itemId)) return;
  await removeProgramTemplateItem(organizationId, itemId);
  revalidatePath(PATH);
}

export async function removeProgramTemplateAction(formData: FormData): Promise<void> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return;
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) return;
  await removeProgramTemplate(organizationId, templateId);
  revalidatePath(PATH);
}
