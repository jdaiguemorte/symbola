"use server";

// EVT-04 — actions du rétroplanning et de la date sur la fiche d'un événement.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  addEventTask,
  applyTaskTemplate,
  changeEventDate,
  EventDateRequiredError,
  EventNotFoundError,
  EventTaskNotFoundError,
  moveEventTask,
  removeEventTask,
  resolveTaskRecalculation,
  TASK_RESPONSIBLES,
  TaskLabelRequiredError,
  TaskRecalculationPendingError,
  TaskTemplateNotFoundError,
  updateEventTask,
  type TaskResponsible,
} from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type TaskFormState = { error?: string; success?: boolean; recalculationProposed?: boolean };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function authorize(t: Awaited<ReturnType<typeof getTranslations>>) {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") } as const;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") } as const;
  return { organizationId: auth.user.organizationId } as const;
}

function readResponsible(formData: FormData): TaskResponsible | null {
  const value = String(formData.get("responsible") ?? "");
  return TASK_RESPONSIBLES.includes(value as TaskResponsible) ? (value as TaskResponsible) : null;
}

// Erreurs métier connues → message traduit ; le reste remonte.
function taskErrorMessage(error: unknown, t: Awaited<ReturnType<typeof getTranslations>>): string {
  if (error instanceof EventNotFoundError) return t("eventNotFound");
  if (error instanceof EventTaskNotFoundError) return t("taskNotFound");
  if (error instanceof TaskTemplateNotFoundError) return t("taskTemplateNotFound");
  if (error instanceof EventDateRequiredError) return t("taskTemplateNeedsDate");
  if (error instanceof TaskRecalculationPendingError) return t("recalculationPendingFirst");
  if (error instanceof TaskLabelRequiredError) return t("missingLabel");
  if (error instanceof RangeError) return t("invalidDate");
  throw error;
}

export async function changeEventDateAction(_prevState: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };

  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const raw = String(formData.get("eventDate") ?? "").trim();
  if (raw && !DATE_PATTERN.test(raw)) return { error: t("invalidDate") };

  try {
    const recalculation = await changeEventDate(access.organizationId, eventId, raw || null);
    revalidatePath(`/events/${eventId}`);
    return { success: true, recalculationProposed: recalculation.pending };
  } catch (error) {
    return { error: taskErrorMessage(error, t) };
  }
}

export async function resolveRecalculationAction(formData: FormData): Promise<void> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return;
  await resolveTaskRecalculation(access.organizationId, eventId, formData.get("decision") === "accept");
  revalidatePath(`/events/${eventId}`);
}

export async function applyTaskTemplateAction(_prevState: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };

  const eventId = String(formData.get("eventId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  if (!isValidId(templateId)) return { error: t("taskTemplateNotFound") };

  try {
    await applyTaskTemplate(access.organizationId, eventId, templateId);
  } catch (error) {
    return { error: taskErrorMessage(error, t) };
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function addEventTaskAction(_prevState: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };

  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: t("missingLabel") };
  const dueDate = String(formData.get("dueDate") ?? "");
  if (!DATE_PATTERN.test(dueDate)) return { error: t("invalidDate") };
  const responsible = readResponsible(formData);
  if (!responsible) return { error: t("invalidResponsible") };

  try {
    await addEventTask(access.organizationId, eventId, { label, dueDate, responsible });
  } catch (error) {
    return { error: taskErrorMessage(error, t) };
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function updateEventTaskAction(_prevState: TaskFormState, formData: FormData): Promise<TaskFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };

  const eventId = String(formData.get("eventId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(eventId) || !isValidId(taskId)) return { error: t("taskNotFound") };
  const label = String(formData.get("label") ?? "").trim();
  if (!label) return { error: t("missingLabel") };
  const dueDate = String(formData.get("dueDate") ?? "");
  if (!DATE_PATTERN.test(dueDate)) return { error: t("invalidDate") };
  const responsible = readResponsible(formData);
  if (!responsible) return { error: t("invalidResponsible") };

  try {
    await updateEventTask({ organizationId: access.organizationId, taskId, label, dueDate, responsible });
  } catch (error) {
    return { error: taskErrorMessage(error, t) };
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function toggleEventTaskAction(formData: FormData): Promise<void> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return;
  const eventId = String(formData.get("eventId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(eventId) || !isValidId(taskId)) return;
  try {
    await updateEventTask({ organizationId: access.organizationId, taskId, done: formData.get("done") === "true" });
  } catch (error) {
    if (!(error instanceof EventTaskNotFoundError)) throw error;
  }
  revalidatePath(`/events/${eventId}`);
}

export async function moveEventTaskAction(formData: FormData): Promise<void> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return;
  const eventId = String(formData.get("eventId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  const direction = formData.get("direction") === "up" ? "up" : "down";
  if (!isValidId(eventId) || !isValidId(taskId)) return;
  try {
    await moveEventTask(access.organizationId, taskId, direction);
  } catch (error) {
    if (!(error instanceof EventTaskNotFoundError)) throw error;
  }
  revalidatePath(`/events/${eventId}`);
}

export async function removeEventTaskAction(formData: FormData): Promise<void> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return;
  const eventId = String(formData.get("eventId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(eventId) || !isValidId(taskId)) return;
  await removeEventTask(access.organizationId, taskId);
  revalidatePath(`/events/${eventId}`);
}
