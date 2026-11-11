"use server";

// PRD-EVT-05 — modèles de programme du jour J de l'organisation. Lot 21 (L21-EVT-21) :
// la liste des modèles, puis le détail d'un modèle ; une ligne se modifie
// sans être recréée, un modèle se renomme.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { starterProgram, type StarterLocale } from "@symbola/starter-templates";
import {
  addProgramTemplateItem,
  createProgramTemplate,
  ProgramTemplateNotFoundError,
  removeProgramTemplate,
  removeProgramTemplateItem,
  renameProgramTemplate,
  TaskLabelRequiredError,
  updateProgramTemplateItem,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type ProgramTemplateFormState = { error?: string; success?: boolean };

const PATH = "/events/modeles-programme";

async function authorizedOrganizationId(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

// Le modèle créé s'ouvre aussitôt : on y ajoute ses lignes.
export async function createProgramTemplateAction(
  _prevState: ProgramTemplateFormState,
  formData: FormData,
): Promise<ProgramTemplateFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("missingLabel") };
  const template = await createProgramTemplate(organizationId, name, []);
  revalidatePath(PATH);
  redirect(`${PATH}/${template.id}`);
}

export async function renameProgramTemplateAction(
  _prevState: ProgramTemplateFormState,
  formData: FormData,
): Promise<ProgramTemplateFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) return { error: t("programTemplateNotFound") };
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: t("missingLabel") };
  try {
    await renameProgramTemplate(organizationId, templateId, name);
  } catch (error) {
    if (error instanceof ProgramTemplateNotFoundError) return { error: t("programTemplateNotFound") };
    throw error;
  }
  revalidatePath(PATH);
  redirect(`${PATH}/${templateId}`);
}

// Ajout (le panneau reste ouvert pour enchaîner les lignes) ou modification
// d'une ligne (le panneau se ferme).
export async function saveProgramTemplateItemAction(
  _prevState: ProgramTemplateFormState,
  formData: FormData,
): Promise<ProgramTemplateFormState> {
  const t = await getTranslations("Events");
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return { error: t("unauthenticated") };
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) return { error: t("programTemplateNotFound") };
  const itemId = String(formData.get("itemId") ?? "");
  if (itemId && !isValidId(itemId)) return { error: t("programTemplateNotFound") };
  const item = {
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    label: String(formData.get("label") ?? ""),
    location: String(formData.get("location") ?? ""),
    participantLabels: String(formData.get("participantLabels") ?? "").split(","),
  };

  try {
    if (itemId) await updateProgramTemplateItem(organizationId, itemId, item);
    else await addProgramTemplateItem(organizationId, templateId, item);
  } catch (error) {
    if (error instanceof ProgramTemplateNotFoundError) return { error: t("programTemplateNotFound") };
    if (error instanceof TaskLabelRequiredError) return { error: t("missingLabel") };
    if (error instanceof RangeError) return { error: t("invalidTime") };
    throw error;
  }
  revalidatePath(`${PATH}/${templateId}`);
  if (itemId) redirect(`${PATH}/${templateId}`);
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
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(itemId) || !isValidId(templateId)) return;
  await removeProgramTemplateItem(organizationId, itemId);
  revalidatePath(`${PATH}/${templateId}`);
}

export async function removeProgramTemplateAction(formData: FormData): Promise<void> {
  const organizationId = await authorizedOrganizationId();
  if (!organizationId) return;
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(templateId)) return;
  await removeProgramTemplate(organizationId, templateId);
  revalidatePath(PATH);
  redirect(PATH);
}
