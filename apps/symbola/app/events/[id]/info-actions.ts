"use server";

// Lot 72e (EVT-03, EVT-05, UX-09, UX-10, SEC-12, SEC-13 ; C-26, D7, M1) — « Modifier les informations » :
// une seule action pour les cinq rubriques, qui remplace les six formulaires du panneau (date, fuseau,
// budget souhaité, lieu, fiche d'identité, notes) et le réglage de la plage occupée. Session, rôle,
// organisation, module et visibilité de l'évènement (lot 52) vérifiés côté serveur ; tout ou rien ; une
// erreur nomme son champ et la rubrique à ouvrir (lot 70b).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { EventDetailsConflictError, EventDetailsRefusedError, EventNotFoundError, EventArchivedError, getEvent, readEventConfidentialNotes, EventNotesForbiddenError } from "@/modules/events/service";
import type { EventDetailsRefusedField } from "@symbola/contracts";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { canSeeEvent } from "@/lib/event-visibility";
import { DETAILS_FIELDS, dateEditable, firstErrorRubric, parseEventDetails, type DetailsErrorCode, type DetailsErrors, type DetailsField, type DetailsRaw, type DetailsRubric } from "@/lib/events/event-details";
import { saveEventDetails } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type InfoWindowState = {
  success?: boolean;
  at?: number;
  error?: string;
  fieldErrors?: Partial<Record<DetailsField, string>>;
  rubric?: DetailsRubric | null;
  // Lot 39b (UX-09, D8) : une modification faite entre-temps ; rien n'est écrasé sans « Garder ma version ».
  conflict?: boolean;
};

const REFUSED: { [K in EventDetailsRefusedField]: [DetailsField, DetailsErrorCode] } = {
  eventDate: ["eventDate", "eventDate"],
  endTime: ["endTime", "busyRule"],
  notes: ["notes", "forbidden"],
  eventTypeId: ["eventTypeId", "unknown"],
  prospectSourceId: ["prospectSourceId", "unknown"],
};

export async function saveEventInfoAction(_previous: InfoWindowState, formData: FormData): Promise<InfoWindowState> {
  const t = await getTranslations("EventInfoWindow.error");
  const tEvents = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: tEvents("unauthenticated") };
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return { error: tEvents("moduleUnavailable") };
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId)) return { error: t("notFound") };
  // Lot 52 (SEC-13) : un évènement hors de vue d'une Planner répond comme un évènement inexistant.
  const viewer = { user: { id: auth.user.id, role: auth.user.role, organizationId } };
  if (auth.user.role === "member" && !(await canSeeEvent(viewer, eventId))) return { error: t("notFound") };
  const event = await getEvent(organizationId, eventId);
  if (!event) return { error: t("notFound") };

  // Les notes confidentielles d'une autre personne ne sont ni lues ni réécrites (lot 48a).
  const actor = { userId: auth.user.id, role: auth.user.role };
  const notesReadable =
    !event.notesConfidential ||
    (await readEventConfidentialNotes(organizationId, eventId, actor).then(
      () => true,
      (error: unknown) => {
        if (error instanceof EventNotesForbiddenError) return false;
        throw error;
      },
    ));
  const raw: DetailsRaw = {};
  for (const field of Object.keys(DETAILS_FIELDS) as DetailsField[]) {
    const value = formData.get(field);
    if (typeof value === "string") raw[field] = value.slice(0, 10_001);
  }
  const parsed = parseEventDetails(raw, { dateEditable: dateEditable({ status: event.status, eventDate: event.eventDate, archived: Boolean(event.archivedAt) }), notesReadable });
  const refused = (errors: DetailsErrors): InfoWindowState => ({
    fieldErrors: Object.fromEntries(Object.entries(errors).map(([field, code]) => [field, t(code)])),
    rubric: firstErrorRubric(errors),
    at: Date.now(),
  });
  if (!parsed.ok) return refused(parsed.errors);

  try {
    const version = formData.get("force") === "1" ? "" : String(formData.get("version") ?? "");
    await saveEventDetails({ organizationId, eventId, actor, ...(version ? { version } : {}), values: parsed.values });
  } catch (error) {
    if (error instanceof EventDetailsRefusedError) {
      const [field, code] = REFUSED[error.field];
      return refused({ [field]: code });
    }
    if (error instanceof EventDetailsConflictError) return { error: t("conflict"), conflict: true, at: Date.now() };
    if (error instanceof EventNotFoundError || error instanceof EventArchivedError) return { error: t("notFound"), at: Date.now() };
    if (error instanceof RangeError) return { error: t("tooLong"), at: Date.now() };
    throw error;
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  return { success: true, at: Date.now() };
}
