"use server";

// PRD-EVT-05 — actions du programme du jour J sur la fiche d'un événement.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  addProgramItem,
  applyProgramTemplate,
  EventNotFoundError,
  getEventProgram,
  ProgramItemInvalidError,
  ProgramItemNotFoundError,
  ProgramShiftOutOfDayError,
  ProgramParticipantNotFoundError,
  ProgramTemplateNotFoundError,
  removeProgramItem,
  shiftProgramItems,
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

// Les intervenants libres se saisissent séparés par des virgules. Lot 30b : la durée
// (minutes) donne l'heure de fin quand celle-ci est vide.
function readProgramItem(formData: FormData): ProgramItemInput | null {
  const vendorSlotIds = formData.getAll("vendorSlotIds").map(String);
  if (!vendorSlotIds.every(isValidId)) return null;
  const duration = String(formData.get("durationMinutes") ?? "").trim();
  return {
    startTime: String(formData.get("startTime") ?? ""),
    endTime: String(formData.get("endTime") ?? ""),
    durationMinutes: duration === "" ? null : /^\d+$/.test(duration) ? Number(duration) : Number.NaN,
    label: String(formData.get("label") ?? ""),
    location: String(formData.get("location") ?? ""),
    internalNote: String(formData.get("internalNote") ?? ""),
    responsible: String(formData.get("responsible") ?? ""),
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
  if (error instanceof ProgramItemInvalidError) return error.reason === "responsible" ? t("programResponsibleTooLong") : t("programDurationInvalid");
  if (error instanceof ProgramShiftOutOfDayError) return t("programShiftOutOfDay");
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

  // Lot 30b (CHR-06, décision D8) : l'heure de début d'avant, pour proposer de décaler
  // les séquences suivantes d'autant.
  const before = await getEventProgram(access.organizationId, eventId).catch(() => null);
  const oldStart = before?.items.find((line) => line.id === itemId)?.startTime ?? null;
  let saved;
  try {
    saved = await updateProgramItem(access.organizationId, itemId, item);
  } catch (error) {
    return { error: programErrorMessage(error, t) };
  }
  revalidatePath(`/events/${eventId}`);
  if (oldStart && oldStart !== saved.startTime && saved.eventId === eventId) {
    redirect(`/events/${eventId}?${new URLSearchParams({ onglet: "programme", decalage: itemId, depuis: oldStart }).toString()}#program-title`);
  }
  return { success: true };
}

// Lot 30b (CHR-06, décision D8 ; UX-07) : décaler les séquences suivantes, et annuler
// dans les dix secondes par le décalage opposé.
const shiftSchema = z.object({
  eventId: z.string().refine(isValidId),
  itemIds: z.array(z.string().refine(isValidId)).min(1).max(500),
  minutes: z.number().int().min(-720).max(720).refine((value) => value !== 0),
});

export type ProgramShiftState = { ok: true; count: number } | { ok: false; error: string };

export async function shiftProgramItemsAction(input: { eventId: string; itemIds: string[]; minutes: number }): Promise<ProgramShiftState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { ok: false, error: access.error };
  const parsed = shiftSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("programItemNotFound") };
  try {
    const shifted = await shiftProgramItems(access.organizationId, parsed.data.eventId, parsed.data.itemIds, parsed.data.minutes);
    revalidatePath(`/events/${parsed.data.eventId}`);
    return { ok: true, count: shifted.length };
  } catch (error) {
    return { ok: false, error: programErrorMessage(error, t) };
  }
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
