"use server";

// Lot 70d (CHR-02, CHR-03, UX-07, UX-15 ; M2, C-36, C-40, C-09 ; page 2 des maquettes du lot 68) — les
// actions de la barre de sélection : « Fait », « Changer la date de N tâches » (décaler de N jours, ou
// toutes au même jour), « Confier à… », « Catégorie… », « Supprimer ». Chacune dit combien de tâches elle a
// touchées et s'annule pendant dix secondes : la date et la personne par les valeurs gardées en base
// (A18), « Fait » en rouvrant les mêmes tâches, la catégorie et le prestataire par les valeurs d'avant,
// rendues au navigateur et revérifiées ici à l'annulation, la suppression par la Corbeille (A5).
//
// Contrôles côté serveur à chaque appel : session de l'équipe, organisation, module ouvert ; la base ne
// montre que les tâches de l'organisation et des évènements visibles (RLS) ; une tâche introuvable ou d'une
// autre organisation n'est pas comptée.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { formatShortCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import {
  BulkTaskChangeInvalidError,
  changeEventTasks,
  changeTasksWithUndo,
  EventNotFoundError,
  EventTaskNotFoundError,
  getTask,
  removeEventTasks,
  setStandaloneTaskDone,
  TaskAssigneeNotFoundError,
  TaskCategoryNotFoundError,
  TaskVendorInvalidError,
  updateEventTask,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { offerUndo } from "@/lib/undo";
import { readResponsibleValue } from "@/app/events/[id]/task-responsible";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { responsibleValueOf } from "@/lib/tasks/task-line";

const MAX = 500;
const DAY = /^\d{4}-\d{2}-\d{2}$/;

export type BulkResult = { ok: boolean; count?: number; message?: string; error?: string; undoId?: string | null; previous?: { id: string; value: string }[]; doneIds?: string[] };

type Access = { organizationId: string; userId: string };

async function access(): Promise<Access | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

function refresh() {
  revalidatePath("/");
  revalidatePath("/taches");
  revalidatePath("/events/[id]", "page");
}

function ids(values: string[]): string[] | null {
  const valid = [...new Set(values.filter((value) => typeof value === "string" && isValidId(value)))];
  return valid.length === 0 || valid.length > MAX ? null : valid;
}

type Translator = Awaited<ReturnType<typeof getTranslations<"TaskScreen">>>;

function knownError(error: unknown, t: Translator): string {
  if (error instanceof EventTaskNotFoundError || error instanceof EventNotFoundError || error instanceof TaskAssigneeNotFoundError) return t("bulkNotFound");
  if (error instanceof TaskVendorInvalidError) return t("bulkVendorInvalid");
  if (error instanceof TaskCategoryNotFoundError) return t("bulkCategoryInvalid");
  if (error instanceof BulkTaskChangeInvalidError || error instanceof RangeError) return t("bulkInvalid");
  throw error;
}

// « Fait » (done = true) ou son « Annuler » (done = false) : tâche par tâche, comme « Fait » sur une ligne,
// pour qu'une tâche hors évènement qui se répète fasse naître la suivante (lot 53).
async function setDone(who: Access, taskIds: string[], done: boolean): Promise<string[]> {
  const now = new Date();
  const today = parisToday(now);
  const changed: string[] = [];
  for (const taskId of taskIds) {
    const task = await getTask(who.organizationId, taskId, today);
    if (!task || task.done === done) continue;
    if (task.eventId === null) await setStandaloneTaskDone(who.organizationId, taskId, done, now, today);
    else await updateEventTask({ organizationId: who.organizationId, taskId, done });
    changed.push(taskId);
  }
  return changed;
}

export async function bulkDoneAction(taskIds: string[]): Promise<BulkResult> {
  const t = await getTranslations("TaskScreen");
  const who = await access();
  const selected = ids(taskIds);
  if (!who || !selected) return { ok: false, error: t("bulkNotFound") };
  try {
    const doneIds = await setDone(who, selected, true);
    refresh();
    return { ok: true, count: doneIds.length, doneIds, message: t("bulkDone", { count: doneIds.length }) };
  } catch (error) {
    return { ok: false, error: knownError(error, t) };
  }
}

export async function bulkReopenAction(taskIds: string[]): Promise<BulkResult> {
  const t = await getTranslations("TaskScreen");
  const who = await access();
  const selected = ids(taskIds);
  if (!who || !selected) return { ok: false, error: t("bulkNotFound") };
  try {
    const reopened = await setDone(who, selected, false);
    refresh();
    return { ok: true, count: reopened.length, message: t("bulkReopened", { count: reopened.length }) };
  } catch (error) {
    return { ok: false, error: knownError(error, t) };
  }
}

// « Décaler de N jours » ou « Toutes au <date> » ; « Annuler » rend les dates et leur état « date
// relative » d'avant (A18).
export async function bulkDateAction(taskIds: string[], choice: { kind: "shift"; days: number } | { kind: "setDate"; date: string }): Promise<BulkResult> {
  const t = await getTranslations("TaskScreen");
  const who = await access();
  const selected = ids(taskIds);
  if (!who || !selected) return { ok: false, error: t("bulkNotFound") };
  if (choice.kind === "shift" && (!Number.isInteger(choice.days) || choice.days === 0 || Math.abs(choice.days) > 366)) return { ok: false, error: t("bulkShiftInvalid") };
  if (choice.kind === "setDate" && (!DAY.test(choice.date) || new Date(`${choice.date}T00:00:00Z`).toISOString().slice(0, 10) !== choice.date)) return { ok: false, error: t("bulkDateInvalid") };
  try {
    const change = choice.kind === "shift" ? ({ kind: "shift", days: choice.days } as const) : ({ kind: "setDate", date: choice.date } as const);
    const { changed, undoId } = await changeTasksWithUndo({ organizationId: who.organizationId, userId: who.userId, taskIds: selected, change });
    refresh();
    const locale = (await getLocale()) as Locale;
    const message = choice.kind === "shift" ? t("bulkShifted", { count: changed, days: choice.days }) : t("bulkDated", { count: changed, date: formatShortCalendarDate(choice.date, locale) });
    return { ok: true, count: changed, undoId, message };
  } catch (error) {
    return { ok: false, error: knownError(error, t) };
  }
}

// « Confier à… » : vous, un collègue, les clients de chaque évènement (une tâche hors évènement reste à
// l'agence), ou un prestataire quand toutes les tâches sont du même évènement.
export async function bulkAssignAction(taskIds: string[], value: string): Promise<BulkResult> {
  const t = await getTranslations("TaskScreen");
  const who = await access();
  const selected = ids(taskIds);
  const choice = readResponsibleValue(value);
  if (!who || !selected) return { ok: false, error: t("bulkNotFound") };
  if (!choice) return { ok: false, error: t("bulkInvalid") };
  try {
    if (choice.responsible === "vendor") {
      const today = parisToday();
      const tasks = (await Promise.all(selected.map((taskId) => getTask(who.organizationId, taskId, today)))).filter((task) => task !== null);
      // Un prestataire ne vaut que pour un seul évènement : refusé sinon.
      if (tasks.length === 0 || new Set(tasks.map((task) => task.eventId)).size !== 1 || tasks[0]!.eventId === null) return { ok: false, error: t("bulkVendorOneEvent") };
      const previous = tasks.map((task) => ({ id: task.id, value: responsibleValueOf(task) }));
      for (const task of tasks) await updateEventTask({ organizationId: who.organizationId, taskId: task.id, responsible: "vendor", vendorCandidateId: choice.vendorCandidateId });
      refresh();
      return { ok: true, count: tasks.length, previous, message: t("bulkAssigned", { count: tasks.length }) };
    }
    const change = choice.assigneeUserId ? ({ kind: "assign", userId: choice.assigneeUserId } as const) : ({ kind: "responsible", responsible: choice.responsible === "clients" ? "clients" : "planner" } as const);
    const { changed, undoId } = await changeTasksWithUndo({ organizationId: who.organizationId, userId: who.userId, taskIds: selected, change });
    refresh();
    return { ok: true, count: changed, undoId, message: t("bulkAssigned", { count: changed }) };
  } catch (error) {
    return { ok: false, error: knownError(error, t) };
  }
}

// « Annuler » d'un « Confier à un prestataire » : chaque tâche revient à qui s'en chargeait ; chaque
// valeur est revérifiée par le service (membre actif, prestataire de l'évènement).
export async function bulkRestoreAssignAction(previous: { id: string; value: string }[]): Promise<BulkResult> {
  const t = await getTranslations("TaskScreen");
  const who = await access();
  if (!who || !ids(previous.map((item) => item.id))) return { ok: false, error: t("bulkNotFound") };
  let restored = 0;
  try {
    for (const item of previous) {
      const choice = readResponsibleValue(item.value);
      if (!choice || !isValidId(item.id)) continue;
      await updateEventTask({ organizationId: who.organizationId, taskId: item.id, responsible: choice.responsible, vendorCandidateId: choice.vendorCandidateId, ...(choice.assigneeUserId ? { assigneeUserId: choice.assigneeUserId } : {}) });
      restored += 1;
    }
  } catch (error) {
    return { ok: false, error: knownError(error, t) };
  }
  refresh();
  return { ok: true, count: restored };
}

// « Catégorie… » ; « Annuler » remet à chaque tâche sa catégorie d'avant.
export async function bulkCategoryAction(taskIds: string[], categoryId: string | null): Promise<BulkResult> {
  const t = await getTranslations("TaskScreen");
  const who = await access();
  const selected = ids(taskIds);
  if (!who || !selected) return { ok: false, error: t("bulkNotFound") };
  if (categoryId !== null && !isValidId(categoryId)) return { ok: false, error: t("bulkCategoryInvalid") };
  try {
    const today = parisToday();
    const tasks = (await Promise.all(selected.map((taskId) => getTask(who.organizationId, taskId, today)))).filter((task) => task !== null);
    const previous = tasks.map((task) => ({ id: task.id, value: task.categoryId ?? "" }));
    const count = await changeEventTasks(who.organizationId, tasks.map((task) => task.id), { kind: "category", categoryId });
    refresh();
    return { ok: true, count, previous, message: t("bulkCategorized", { count }) };
  } catch (error) {
    return { ok: false, error: knownError(error, t) };
  }
}

export async function bulkRestoreCategoriesAction(previous: { id: string; value: string }[]): Promise<BulkResult> {
  const t = await getTranslations("TaskScreen");
  const who = await access();
  if (!who || !ids(previous.map((item) => item.id))) return { ok: false, error: t("bulkNotFound") };
  const byCategory = new Map<string, string[]>();
  for (const item of previous) {
    if (!isValidId(item.id) || (item.value !== "" && !isValidId(item.value))) continue;
    byCategory.set(item.value, [...(byCategory.get(item.value) ?? []), item.id]);
  }
  let restored = 0;
  try {
    for (const [categoryId, group] of byCategory) restored += await changeEventTasks(who.organizationId, group, { kind: "category", categoryId: categoryId === "" ? null : categoryId });
  } catch (error) {
    return { ok: false, error: knownError(error, t) };
  }
  refresh();
  return { ok: true, count: restored };
}

// « Supprimer » : dans la Corbeille, d'un seul « Annuler » (message de retour du lot 70b, ADR 0073 et A5).
export async function bulkDeleteAction(taskIds: string[]): Promise<BulkResult> {
  const t = await getTranslations("TaskScreen");
  const who = await access();
  const selected = ids(taskIds);
  if (!who || !selected) return { ok: false, error: t("bulkNotFound") };
  const count = await removeEventTasks(who.organizationId, selected);
  if (count > 0) await offerUndo({ kind: count === 1 ? "task" : "taskBatch", id: selected[0]! });
  refresh();
  return { ok: true, count, message: t("bulkDeleted", { count }) };
}
