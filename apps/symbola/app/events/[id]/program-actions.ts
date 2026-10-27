"use server";

// EVT-05 — actions du programme du jour J sur la fiche d'un événement.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import {
  addProgramItem,
  applyProgramTemplate,
  EventNotFoundError,
  ProgramItemNotFoundError,
  ProgramParticipantNotFoundError,
  ProgramTemplateNotFoundError,
  removeProgramItem,
  TaskLabelRequiredError,
  updateProgramItem,
  type ProgramItemInput,
} from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type ProgramFormState = { error?: string; success?: boolean };

type Translator = Awaited<ReturnType<typeof getTranslations>>;

async function authorize(t: Translator) {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") } as const;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") } as const;
  return { organizationId: auth.user.organizationId } as const;
}

// Les intervenants libres se saisissent séparés par des virgules.
function readProgramItem(formData: FormData): ProgramItemInput | null {
  const vendorSlotIds = formData.getAll("vendorSlotIds").map(String);
  if (!vendorSlotIds.every(isValidId)) return null;
  return {
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    label: String(formData.get("label") ?? ""),
    location: String(formData.get("location") ?? ""),
    internalNote: String(formData.get("internalNote") ?? ""),
    vendorSlotIds,
    freeParticipants: String(formData.get("freeParticipants") ?? "").split(","),
  };
}

function programErrorMessage(error: unknown, t: Translator): string {
  if (error instanceof EventNotFoundError) return t("eventNotFound");
  if (error instanceof ProgramItemNotFoundError) return t("programItemNotFound");
  if (error instanceof ProgramParticipantNotFoundError) return t("programParticipantNotFound");
  if (error instanceof ProgramTemplateNotFoundError) return t("programTemplateNotFound");
  if (error instanceof TaskLabelRequiredError) return t("missingLabel");
  if (error instanceof RangeError) return t("invalidTime");
  throw error;
}

export async function addProgramItemAction(_prevState: ProgramFormState, formData: FormData): Promise<ProgramFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const item = readProgramItem(formData);
  if (!item) return { error: t("programParticipantNotFound") };

  try {
    await addProgramItem(access.organizationId, eventId, item);
  } catch (error) {
    return { error: programErrorMessage(error, t) };
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function updateProgramItemAction(_prevState: ProgramFormState, formData: FormData): Promise<ProgramFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = String(formData.get("eventId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!isValidId(eventId) || !isValidId(itemId)) return { error: t("programItemNotFound") };
  const item = readProgramItem(formData);
  if (!item) return { error: t("programParticipantNotFound") };

  try {
    await updateProgramItem(access.organizationId, itemId, item);
  } catch (error) {
    return { error: programErrorMessage(error, t) };
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function applyProgramTemplateAction(_prevState: ProgramFormState, formData: FormData): Promise<ProgramFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = String(formData.get("eventId") ?? "");
  const templateId = String(formData.get("templateId") ?? "");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  if (!isValidId(templateId)) return { error: t("programTemplateNotFound") };

  try {
    await applyProgramTemplate(access.organizationId, eventId, templateId);
  } catch (error) {
    return { error: programErrorMessage(error, t) };
  }
  revalidatePath(`/events/${eventId}`);
  return { success: true };
}

export async function removeProgramItemAction(formData: FormData): Promise<void> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return;
  const eventId = String(formData.get("eventId") ?? "");
  const itemId = String(formData.get("itemId") ?? "");
  if (!isValidId(eventId) || !isValidId(itemId)) return;
  await removeProgramItem(access.organizationId, itemId);
  revalidatePath(`/events/${eventId}`);
}
