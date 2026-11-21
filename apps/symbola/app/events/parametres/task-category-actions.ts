"use server";

// Lot 63d (CHR-03, HUB-20) — rubrique « Catégories des tâches » des Paramètres des évènements : ajout,
// libellé et couleur (enregistrés à la sortie du champ), rang, retrait (ses tâches restent sans
// catégorie). Contrôles côté serveur : session de l'équipe, organisation, module.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  createTaskCategory,
  moveTaskCategory,
  removeTaskCategory,
  TaskCategoryInvalidError,
  TaskCategoryNotFoundError,
  updateTaskCategory,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type TaskCategoryFormState = { error?: string; success?: string };

async function organizationOrNull(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  return (await isEventsModuleEnabled(auth.user.organizationId)) ? auth.user.organizationId : null;
}

function refresh() {
  revalidatePath("/events/parametres/taches");
  revalidatePath("/taches");
  revalidatePath("/");
  revalidatePath("/events/[id]", "page");
}

function readInput(formData: FormData) {
  return { label: String(formData.get("label") ?? ""), color: String(formData.get("color") ?? "") };
}

async function known(error: unknown): Promise<string> {
  const t = await getTranslations("TaskCategories");
  if (error instanceof TaskCategoryNotFoundError) return t("notFound");
  if (error instanceof TaskCategoryInvalidError) return t(error.reason === "too_many" ? "tooMany" : error.reason === "last" ? "last" : "invalid");
  throw error;
}

export async function createTaskCategoryAction(_prev: TaskCategoryFormState, formData: FormData): Promise<TaskCategoryFormState> {
  const t = await getTranslations("TaskCategories");
  const organizationId = await organizationOrNull();
  if (!organizationId) return { error: (await getTranslations("Events"))("unauthenticated") };
  try {
    await createTaskCategory(organizationId, readInput(formData));
  } catch (error) {
    return { error: await known(error) };
  }
  refresh();
  return { success: t("added") };
}

export async function updateTaskCategoryAction(_prev: TaskCategoryFormState, formData: FormData): Promise<TaskCategoryFormState> {
  const organizationId = await organizationOrNull();
  if (!organizationId) return { error: (await getTranslations("Events"))("unauthenticated") };
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!isValidId(categoryId)) return { error: (await getTranslations("TaskCategories"))("notFound") };
  try {
    await updateTaskCategory(organizationId, categoryId, readInput(formData));
  } catch (error) {
    return { error: await known(error) };
  }
  refresh();
  return {};
}

export async function moveTaskCategoryAction(_prev: TaskCategoryFormState, formData: FormData): Promise<TaskCategoryFormState> {
  const organizationId = await organizationOrNull();
  if (!organizationId) return { error: (await getTranslations("Events"))("unauthenticated") };
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!isValidId(categoryId)) return { error: (await getTranslations("TaskCategories"))("notFound") };
  try {
    await moveTaskCategory(organizationId, categoryId, formData.get("direction") === "up" ? "up" : "down");
  } catch (error) {
    return { error: await known(error) };
  }
  refresh();
  return {};
}

export async function removeTaskCategoryAction(_prev: TaskCategoryFormState, formData: FormData): Promise<TaskCategoryFormState> {
  const t = await getTranslations("TaskCategories");
  const organizationId = await organizationOrNull();
  if (!organizationId) return { error: (await getTranslations("Events"))("unauthenticated") };
  const categoryId = String(formData.get("categoryId") ?? "");
  if (!isValidId(categoryId)) return { error: t("notFound") };
  try {
    const count = await removeTaskCategory(organizationId, categoryId);
    refresh();
    return { success: t("removed", { count }) };
  } catch (error) {
    return { error: await known(error) };
  }
}
