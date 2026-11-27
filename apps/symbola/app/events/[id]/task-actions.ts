"use server";

// PRD-EVT-04 — actions du rétroplanning et de la date sur la fiche d'un événement.
import { offerUndo } from "@/lib/undo";
import { fieldErrors, formValues, translatedFieldErrors } from "@/lib/forms/field-validation";
import { taskFieldsSchema } from "@/lib/forms/task-fields";
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
  releaseEventTask,
  removeEventTask,
  resolveTaskRecalculation,
  TaskAssigneeNotFoundError,
  TaskVendorInvalidError,
  TaskLabelRequiredError,
  TaskRecalculationPendingError,
  TaskTemplateNotFoundError,
  updateEventTask,
  PlanningInputError,
  setTaskMilestone,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";
import { readResponsibleCreate, readResponsibleEdit, UNCHANGED_RESPONSIBLE, type ResponsibleChoice } from "./task-responsible";

// Lot 70b (UX-10) : `fieldErrors`, les erreurs de saisie traduites, sous les champs.
export type TaskFormState = { error?: string; success?: boolean; recalculationProposed?: boolean; fieldErrors?: Record<string, string> };

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

async function authorize(t: Awaited<ReturnType<typeof getTranslations>>) {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") } as const;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") } as const;
  return { organizationId: auth.user.organizationId } as const;
}

// Lot 34b (CHR-02, D12) : « vendor:<id> » confie la tâche à ce prestataire retenu sur l'événement.
// Lot 70a (CHR-02 ; A1) : « member:<id> » la confie à ce collègue (vérifié par le service).
function readResponsible(formData: FormData): ResponsibleChoice | null {
  return readResponsibleCreate(String(formData.get("responsible") ?? ""));
}

// Erreurs métier connues → message traduit ; le reste remonte.
function taskErrorMessage(error: unknown, t: Awaited<ReturnType<typeof getTranslations>>): string {
  if (error instanceof EventNotFoundError) return t("eventNotFound");
  if (error instanceof EventTaskNotFoundError) return t("taskNotFound");
  if (error instanceof TaskTemplateNotFoundError) return t("taskTemplateNotFound");
  if (error instanceof EventDateRequiredError) return t("taskTemplateNeedsDate");
  if (error instanceof TaskRecalculationPendingError) return t("recalculationPendingFirst");
  if (error instanceof TaskLabelRequiredError) return t("missingLabel");
  if (error instanceof TaskVendorInvalidError) return t("taskVendorInvalid");
  // Lot 70a (§ 3.4) : un compte qui n'est pas un membre actif répond comme une tâche introuvable.
  if (error instanceof TaskAssigneeNotFoundError) return t("taskNotFound");
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
  // Lot 70b (UX-10) : le même schéma qu'à l'écran ; les erreurs vont sous les champs.
  const invalid = fieldErrors(taskFieldsSchema, formValues(formData));
  if (invalid.length > 0) return { fieldErrors: translatedFieldErrors(invalid, await getTranslations("Validation")) };
  const label = String(formData.get("label") ?? "").trim();
  const dueDate = String(formData.get("dueDate") ?? "");
  const responsible = readResponsible(formData);
  if (!responsible) return { error: t("invalidResponsible") };

  try {
    await addEventTask(access.organizationId, eventId, { label, dueDate, ...responsible });
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
  // Revue du 70a : champ absent ou « inchangé » (valeur qu'on ne peut plus choisir) = personne inchangée.
  const raw = formData.get("responsible");
  const responsible = readResponsibleEdit(raw === null ? null : String(raw));
  if (!responsible) return { error: t("invalidResponsible") };

  try {
    await updateEventTask({ organizationId: access.organizationId, taskId, label, dueDate, ...(responsible === UNCHANGED_RESPONSIBLE ? {} : responsible) });
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
  // PRD-HUB-02 : la même case se coche depuis l'accueil et l'écran Tâches.
  revalidatePath("/");
  revalidatePath("/taches");
}

// Lot 53 (CHR-05) : marquer une tâche comme jalon, ou ne plus la marquer.
export async function setTaskMilestoneAction(formData: FormData): Promise<void> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return;
  const eventId = String(formData.get("eventId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(eventId) || !isValidId(taskId)) return;
  try {
    await setTaskMilestone(access.organizationId, eventId, taskId, formData.get("milestone") === "true");
  } catch (error) {
    if (!(error instanceof PlanningInputError)) throw error;
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
  await offerUndo({ kind: "task", id: taskId });
  revalidatePath(`/events/${eventId}`);
}

// Lot 34a (DAT-07) : une tâche déplacée à la main redevient relative à la date de l'évènement.
export async function releaseEventTaskAction(formData: FormData): Promise<void> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return;
  const eventId = String(formData.get("eventId") ?? "");
  const taskId = String(formData.get("taskId") ?? "");
  if (!isValidId(eventId) || !isValidId(taskId)) return;
  try {
    await releaseEventTask(access.organizationId, taskId);
  } catch (error) {
    if (!(error instanceof EventTaskNotFoundError)) throw error;
  }
  revalidatePath(`/events/${eventId}`);
}
