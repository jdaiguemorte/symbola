"use server";

// Lot 70c (CHR-02, CHR-03, CHR-10, UX-07, UX-09 ; D3, M1, M3, A3, A8, A22 ; page 1 et 2 des maquettes du
// lot 68) — les gestes de la ligne type et du panneau unique d'une tâche, d'évènement ou hors évènement :
// « Fait » (et son « Annuler »), « Changer la date », « Confier à », « Enregistrer » (et « Fait » qui
// enregistre aussi), « Créer la tâche ». Contrôles côté serveur à chaque appel : session de l'équipe,
// organisation, module ouvert ; la base ne montre que les tâches de l'organisation (RLS) ; une tâche
// introuvable, d'une autre organisation ou un identifiant inventé reçoivent la même réponse.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { TASK_NOTE_MAX, TASK_RECURRENCE_VALUES } from "@symbola/contracts";
import { formatShortCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { getLocale } from "next-intl/server";
import {
  addEventTask,
  addStandaloneTask,
  changeTasksWithUndo,
  EventNotFoundError,
  EventTaskNotFoundError,
  getTask,
  PlanningInputError,
  setStandaloneTaskDone,
  TaskAssigneeNotFoundError,
  TaskCategoryNotFoundError,
  TaskLabelRequiredError,
  TaskVendorInvalidError,
  undoTaskChange,
  updateEventTask,
  updateStandaloneTask,
  BulkTaskChangeInvalidError,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { fieldErrors, formValues, translatedFieldErrors } from "@/lib/forms/field-validation";
import { taskFieldsSchema } from "@/lib/forms/task-fields";
import { isDateShortcut, shortcutDate } from "@/lib/tasks/date-shortcuts";
import { readResponsibleCreate, readResponsibleEdit, UNCHANGED_RESPONSIBLE } from "@/app/events/[id]/task-responsible";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";

export type TaskLineResult = { ok: boolean; error?: string; undoId?: string | null; message?: string };
export type TaskPanelState = { ok?: boolean; error?: string; fieldErrors?: Record<string, string>; message?: string; taskId?: string };

const DAY = /^\d{4}-\d{2}-\d{2}$/;

type Access = { organizationId: string; userId: string };

async function access(): Promise<Access | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

// Les écrans qui montrent des tâches : l'accueil, « Tâches », la fiche de chaque évènement.
function refresh() {
  revalidatePath("/");
  revalidatePath("/taches");
  revalidatePath("/events/[id]", "page");
}

type Translator = Awaited<ReturnType<typeof getTranslations<"TaskLine">>>;

function knownError(error: unknown, t: Translator): string {
  // Une tâche ou un évènement introuvable, un compte qui n'est pas un membre actif : la même réponse (§ 3.4).
  if (error instanceof EventTaskNotFoundError || error instanceof EventNotFoundError || error instanceof TaskAssigneeNotFoundError) return t("notFound");
  if (error instanceof PlanningInputError) return t(error.reason === "not_found" ? "notFound" : "invalid");
  if (error instanceof TaskLabelRequiredError) return t("invalid");
  if (error instanceof TaskVendorInvalidError) return t("vendorInvalid");
  if (error instanceof TaskCategoryNotFoundError) return t("categoryInvalid");
  if (error instanceof BulkTaskChangeInvalidError || error instanceof RangeError) return t("invalid");
  throw error;
}

// « Fait » sur la ligne ou dans le panneau, et son « Annuler » (done = false) ; une tâche hors évènement
// qui se répète fait naître la suivante (lot 53).
export async function setTaskDoneAction(taskId: string, done: boolean): Promise<TaskLineResult> {
  const t = await getTranslations("TaskLine");
  const who = await access();
  if (!who || !isValidId(taskId)) return { ok: false, error: t("notFound") };
  try {
    const now = new Date();
    const task = await getTask(who.organizationId, taskId, parisToday(now));
    if (!task) return { ok: false, error: t("notFound") };
    if (task.eventId === null) await setStandaloneTaskDone(who.organizationId, taskId, done, now, parisToday(now));
    else await updateEventTask({ organizationId: who.organizationId, taskId, done });
  } catch (error) {
    return { ok: false, error: knownError(error, t) };
  }
  refresh();
  return { ok: true };
}

// « Changer la date » : un raccourci (demain, lundi prochain, dans une semaine) ou une date ; « Annuler »
// rend la date d'avant et son état « date relative » d'avant (DAT-07 ; valeurs gardées dix minutes, A18).
export async function changeTaskDateAction(taskId: string, choice: string): Promise<TaskLineResult> {
  const t = await getTranslations("TaskLine");
  const who = await access();
  if (!who || !isValidId(taskId)) return { ok: false, error: t("notFound") };
  const date = isDateShortcut(choice) ? shortcutDate(choice, parisToday()) : choice;
  if (!DAY.test(date) || Number.isNaN(Date.parse(`${date}T00:00:00Z`))) return { ok: false, error: t("invalidDate") };
  try {
    const { changed, undoId } = await changeTasksWithUndo({ organizationId: who.organizationId, userId: who.userId, taskIds: [taskId], change: { kind: "setDate", date } });
    if (changed === 0) return { ok: false, error: t("notFound") };
    refresh();
    const locale = (await getLocale()) as Locale;
    return { ok: true, undoId, message: formatShortCalendarDate(date, locale) };
  } catch (error) {
    return { ok: false, error: knownError(error, t) };
  }
}

// « Confier à… » : vous, un collègue, les clients, un prestataire de l'évènement.
export async function assignTaskAction(taskId: string, value: string): Promise<TaskLineResult> {
  const t = await getTranslations("TaskLine");
  const who = await access();
  if (!who || !isValidId(taskId)) return { ok: false, error: t("notFound") };
  const choice = readResponsibleCreate(value);
  if (!choice) return { ok: false, error: t("invalid") };
  try {
    if (choice.responsible === "vendor") {
      // Un prestataire : pas de lot ni d'« Annuler » côté base (le prestataire est vérifié sur l'évènement).
      await updateEventTask({ organizationId: who.organizationId, taskId, responsible: "vendor", vendorCandidateId: choice.vendorCandidateId });
      refresh();
      return { ok: true, undoId: null };
    }
    const change = choice.assigneeUserId ? ({ kind: "assign", userId: choice.assigneeUserId } as const) : ({ kind: "responsible", responsible: choice.responsible === "clients" ? "clients" : "planner" } as const);
    const { changed, undoId } = await changeTasksWithUndo({ organizationId: who.organizationId, userId: who.userId, taskIds: [taskId], change });
    if (changed === 0) return { ok: false, error: t("notFound") };
    refresh();
    return { ok: true, undoId };
  } catch (error) {
    return { ok: false, error: knownError(error, t) };
  }
}

// « Annuler » d'un changement de date ou de personne : seule la personne qui a fait le geste, dans les
// dix minutes.
export async function undoTaskChangeAction(undoId: string): Promise<TaskLineResult> {
  const t = await getTranslations("TaskLine");
  const who = await access();
  if (!who || !isValidId(undoId)) return { ok: false, error: t("undoExpired") };
  const restored = await undoTaskChange({ organizationId: who.organizationId, userId: who.userId, undoId });
  if (restored === 0) return { ok: false, error: t("undoExpired") };
  refresh();
  return { ok: true };
}

const panelSchema = z.object({
  label: z.string().trim().min(1).max(300),
  dueDate: z.string().regex(DAY),
  responsible: z.string().optional(),
  categoryId: z.string(),
  note: z.string().max(TASK_NOTE_MAX),
  priority: z.enum(["high", "normal"]),
  recurrence: z.union([z.literal(""), z.enum(TASK_RECURRENCE_VALUES)]),
});

function readPanel(formData: FormData) {
  return panelSchema.safeParse({
    label: formData.get("label") ?? "",
    dueDate: formData.get("dueDate") ?? "",
    responsible: formData.get("responsible") ?? undefined,
    categoryId: formData.get("categoryId") ?? "",
    note: formData.get("note") ?? "",
    // La case « Prioritaire » (A6).
    priority: formData.get("priority") === "high" ? "high" : "normal",
    recurrence: formData.get("recurrence") ?? "",
  });
}

// « Enregistrer » (et « Fait », qui enregistre aussi les changements en cours : `done=true`). M1 : tous
// les changements d'un coup.
export async function saveTaskPanelAction(_prev: TaskPanelState, formData: FormData): Promise<TaskPanelState> {
  const t = await getTranslations("TaskLine");
  const who = await access();
  const taskId = String(formData.get("taskId") ?? "");
  if (!who || !isValidId(taskId)) return { error: t("notFound") };
  // Lot 70b (UX-10) : le même schéma qu'à l'écran ; les erreurs vont sous les champs.
  const invalid = fieldErrors(taskFieldsSchema, formValues(formData));
  if (invalid.length > 0) return { fieldErrors: translatedFieldErrors(invalid, await getTranslations("Validation")) };
  const parsed = readPanel(formData);
  if (!parsed.success) return { error: t("invalid") };
  const responsible = readResponsibleEdit(parsed.data.responsible);
  if (!responsible) return { error: t("invalid") };
  const categoryId = parsed.data.categoryId === "" ? null : parsed.data.categoryId;
  if (categoryId !== null && !isValidId(categoryId)) return { error: t("categoryInvalid") };
  const done = formData.get("done") === "true";
  try {
    const now = new Date();
    const task = await getTask(who.organizationId, taskId, parisToday(now));
    if (!task) return { error: t("notFound") };
    const standalone = task.eventId === null;
    await updateEventTask({
      organizationId: who.organizationId,
      taskId,
      label: parsed.data.label,
      dueDate: parsed.data.dueDate,
      ...(responsible === UNCHANGED_RESPONSIBLE ? {} : responsible),
      categoryId,
      priority: parsed.data.priority,
      note: parsed.data.note.trim() === "" ? null : parsed.data.note,
      // Une tâche d'évènement : la coche part avec le reste, dans la même écriture.
      ...(done && !standalone ? { done: true } : {}),
    });
    if (standalone) {
      // La répétition, puis la coche (la suivante naît si elle se répète).
      await updateStandaloneTask(who.organizationId, taskId, { label: parsed.data.label, dueDate: parsed.data.dueDate, recurrence: parsed.data.recurrence === "" ? null : parsed.data.recurrence }, now);
      if (done) await setStandaloneTaskDone(who.organizationId, taskId, true, now, parisToday(now));
    }
  } catch (error) {
    return { error: knownError(error, t) };
  }
  refresh();
  return { ok: true, taskId, message: done ? "done" : "saved" };
}

// « Créer la tâche » : avec un évènement (A8 : une date, ou « {n} jours avant le jour J », la tâche reste
// alors relative), ou sans (« Aucun évènement », avec sa répétition).
export async function createTaskPanelAction(_prev: TaskPanelState, formData: FormData): Promise<TaskPanelState> {
  const t = await getTranslations("TaskLine");
  const who = await access();
  if (!who) return { error: t("notFound") };
  const invalid = fieldErrors(taskFieldsSchema, formValues(formData));
  if (invalid.length > 0) return { fieldErrors: translatedFieldErrors(invalid, await getTranslations("Validation")) };
  const parsed = readPanel(formData);
  if (!parsed.success) return { error: t("invalid") };
  const eventId = String(formData.get("eventId") ?? "");
  if (eventId !== "" && !isValidId(eventId)) return { error: t("notFound") };
  const responsible = readResponsibleCreate(parsed.data.responsible ?? "planner");
  if (!responsible) return { error: t("invalid") };
  const categoryId = parsed.data.categoryId === "" ? null : parsed.data.categoryId;
  if (categoryId !== null && !isValidId(categoryId)) return { error: t("categoryInvalid") };
  const note = parsed.data.note.trim() === "" ? null : parsed.data.note;
  let taskId: string;
  try {
    if (eventId === "") {
      // Hors évènement : toujours à l'agence (contrainte de la base), à la personne choisie sinon à qui crée.
      if (responsible.responsible !== "planner") return { error: t("standaloneAgencyOnly") };
      const created = await addStandaloneTask(who.organizationId, {
        label: parsed.data.label,
        dueDate: parsed.data.dueDate,
        recurrence: parsed.data.recurrence === "" ? null : parsed.data.recurrence,
        ...(responsible.assigneeUserId ? { assigneeUserId: responsible.assigneeUserId } : {}),
      });
      taskId = created.id;
      if (categoryId !== null || note !== null || parsed.data.priority === "high") {
        await updateEventTask({ organizationId: who.organizationId, taskId, categoryId, note, priority: parsed.data.priority });
      }
    } else {
      const created = await addEventTask(who.organizationId, eventId, {
        label: parsed.data.label,
        dueDate: parsed.data.dueDate,
        responsible: responsible.responsible,
        vendorCandidateId: responsible.vendorCandidateId,
        ...(responsible.assigneeUserId ? { assigneeUserId: responsible.assigneeUserId } : {}),
        categoryId,
        priority: parsed.data.priority,
        note,
      });
      taskId = created.id;
    }
  } catch (error) {
    return { error: knownError(error, t) };
  }
  refresh();
  return { ok: true, taskId, message: "created" };
}
