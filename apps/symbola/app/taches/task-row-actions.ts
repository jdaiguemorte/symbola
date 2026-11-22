"use server";

// Lot 63d (CHR-02, CHR-03, UX-07 ; recette du 21/11/2026, maquette M6) — actions du tableau des tâches,
// le même sur l'écran « Tâches » et dans le rétroplanning d'un évènement : enregistrer la fenêtre de la
// tâche, changer l'échéance dans la cellule, reporter, supprimer (tout de suite, « Annuler » pendant dix
// secondes), et les actions groupées. Contrôles côté serveur à chaque appel : session de l'équipe,
// organisation, module ; la base ne montre que les tâches de l'organisation (et des évènements visibles).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  BulkTaskChangeInvalidError,
  changeEventTasks,
  EventNotFoundError,
  EventTaskNotFoundError,
  removeEventTask,
  removeEventTasks,
  TASK_RESPONSIBLES,
  TaskCategoryNotFoundError,
  TaskLabelRequiredError,
  TaskVendorInvalidError,
  updateEventTask,
  type BulkTaskChange,
  type TaskResponsible,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { offerUndo } from "@/lib/undo";
import { isPostponeChoice, postponedDueDate } from "@/lib/tasks/postpone";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

export type TaskRowState = { error?: string; success?: string; done?: number };

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function organizationOrNull(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  return (await isEventsModuleEnabled(auth.user.organizationId)) ? auth.user.organizationId : null;
}

// Les écrans qui montrent des tâches : l'accueil, l'écran « Tâches », la fiche de chaque évènement.
function refresh() {
  revalidatePath("/");
  revalidatePath("/taches");
  revalidatePath("/events/[id]", "page");
}

function knownError(error: unknown, t: Awaited<ReturnType<typeof getTranslations<"Events">>>): string {
  if (error instanceof EventTaskNotFoundError || error instanceof EventNotFoundError) return t("taskNotFound");
  if (error instanceof TaskLabelRequiredError) return t("missingLabel");
  if (error instanceof TaskVendorInvalidError) return t("taskVendorInvalid");
  if (error instanceof TaskCategoryNotFoundError) return t("taskCategoryInvalid");
  if (error instanceof BulkTaskChangeInvalidError) return t("tasksBulkInvalid");
  if (error instanceof RangeError) return t("invalidDate");
  throw error;
}

// « vendor:<id> » confie la tâche à ce prestataire retenu sur l'évènement (lot 34b).
function readResponsible(value: string): { responsible: TaskResponsible; vendorCandidateId: string | null } | null {
  if (value.startsWith("vendor:")) {
    const vendorCandidateId = value.slice("vendor:".length);
    return isValidId(vendorCandidateId) ? { responsible: "vendor", vendorCandidateId } : null;
  }
  return value !== "vendor" && TASK_RESPONSIBLES.includes(value as TaskResponsible) ? { responsible: value as TaskResponsible, vendorCandidateId: null } : null;
}

const saveSchema = z.object({
  taskId: z.string().refine(isValidId),
  label: z.string().trim().min(1).max(300),
  dueDate: z.string().regex(DATE),
  responsible: z.string(),
  categoryId: z.string(),
  priority: z.enum(["high", "normal"]),
});

// La fenêtre de la tâche : « Enregistrer ».
export async function saveTaskAction(_prev: TaskRowState, formData: FormData): Promise<TaskRowState> {
  const t = await getTranslations("Events");
  const organizationId = await organizationOrNull();
  if (!organizationId) return { error: t("unauthenticated") };
  const parsed = saveSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues.some((issue) => issue.path[0] === "label") ? t("missingLabel") : t("invalidDate") };
  const responsible = readResponsible(parsed.data.responsible);
  if (!responsible) return { error: t("invalidResponsible") };
  const categoryId = parsed.data.categoryId === "" ? null : parsed.data.categoryId;
  if (categoryId !== null && !isValidId(categoryId)) return { error: t("taskCategoryInvalid") };
  try {
    await updateEventTask({ organizationId, taskId: parsed.data.taskId, label: parsed.data.label, dueDate: parsed.data.dueDate, ...responsible, categoryId, priority: parsed.data.priority });
  } catch (error) {
    return { error: knownError(error, t) };
  }
  refresh();
  return { success: t("taskSaved") };
}

// L'échéance changée dans sa cellule, ou « Reporter » (demain, dans une semaine, une date choisie).
export async function setTaskDueDateAction(_prev: TaskRowState, formData: FormData): Promise<TaskRowState> {
  const t = await getTranslations("Events");
  const organizationId = await organizationOrNull();
  if (!organizationId) return { error: t("unauthenticated") };
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(taskId)) return { error: t("taskNotFound") };
  const choice = String(formData.get("postpone") ?? "");
  const raw = String(formData.get("dueDate") ?? "");
  const dueDate = isPostponeChoice(choice) ? postponedDueDate(choice) : raw;
  if (!DATE.test(dueDate)) return { error: t("invalidDate") };
  try {
    await updateEventTask({ organizationId, taskId, dueDate });
  } catch (error) {
    return { error: knownError(error, t) };
  }
  refresh();
  return { success: t("taskDueChanged") };
}

// « Supprimer » sur la ligne ou dans la fenêtre : tout de suite, sans confirmation ; le bandeau du
// gabarit propose « Annuler » pendant dix secondes (UX-07), puis la tâche est purgée de la corbeille.
export async function deleteTaskAction(formData: FormData): Promise<void> {
  const organizationId = await organizationOrNull();
  if (!organizationId) return;
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(taskId)) return;
  await removeEventTask(organizationId, taskId);
  await offerUndo({ kind: "task", id: taskId });
  refresh();
}

const bulkSchema = z.object({
  op: z.enum(["shift", "responsible", "category", "delete"]),
  days: z.coerce.number().int().optional(),
  responsible: z.enum(["planner", "clients"]).optional(),
  categoryId: z.string().optional(),
});

// Actions groupées : décaler de N jours, responsable, catégorie, supprimer (un seul « Annuler »).
export async function bulkTasksAction(_prev: TaskRowState, formData: FormData): Promise<TaskRowState> {
  const t = await getTranslations("Events");
  const organizationId = await organizationOrNull();
  if (!organizationId) return { error: t("unauthenticated") };
  const taskIds = formData.getAll("taskIds").map(String).filter(isValidId);
  if (taskIds.length === 0) return { error: t("tasksBulkNone") };
  const parsed = bulkSchema.safeParse({
    op: formData.get("op"),
    days: formData.get("days") || undefined,
    responsible: formData.get("responsible") || undefined,
    categoryId: formData.get("categoryId") ?? undefined,
  });
  if (!parsed.success) return { error: t("tasksBulkInvalid") };
  const { op } = parsed.data;
  try {
    if (op === "delete") {
      const count = await removeEventTasks(organizationId, taskIds);
      if (count > 0) await offerUndo({ kind: count === 1 ? "task" : "taskBatch", id: taskIds[0]! });
      refresh();
      return { success: t("tasksBulkDeleted", { count }), done: count };
    }
    let change: BulkTaskChange;
    if (op === "shift") {
      if (parsed.data.days === undefined) return { error: t("tasksBulkInvalid") };
      change = { kind: "shift", days: parsed.data.days };
    } else if (op === "responsible") {
      if (!parsed.data.responsible) return { error: t("invalidResponsible") };
      change = { kind: "responsible", responsible: parsed.data.responsible };
    } else {
      const categoryId = parsed.data.categoryId ? parsed.data.categoryId : null;
      if (categoryId !== null && !isValidId(categoryId)) return { error: t("taskCategoryInvalid") };
      change = { kind: "category", categoryId };
    }
    const count = await changeEventTasks(organizationId, taskIds, change);
    refresh();
    const message =
      change.kind === "shift" ? t("tasksBulkShifted", { count, days: change.days }) : change.kind === "responsible" ? t("tasksBulkResponsibleDone", { count }) : t("tasksBulkCategoryDone", { count });
    return { success: message, done: count };
  } catch (error) {
    return { error: knownError(error, t) };
  }
}
