"use server";

// Lot 29b (JRJ-04, décision D8) — choix des documents embarqués pour le jour J, pour
// l'événement (toute l'équipe embarque les mêmes). Seules les pièces que les modules
// donnent comme candidates de l'événement sont retenues (day-documents.ts) : une
// pièce d'un autre événement ou d'une autre organisation est ignorée.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { getEvent, setDayDocumentEmbedded } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { isDayOfOpen } from "./day-of-view";
import { dayDocumentKey, listDayDocumentCandidates } from "./day-documents";

export type DayDocumentsState = { error?: string; success?: boolean };

export async function saveDayDocumentsAction(_previous: DayDocumentsState, formData: FormData): Promise<DayDocumentsState> {
  const t = await getTranslations("DayOf");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("chooseUnauthorized") };
  const organizationId = auth.user.organizationId;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId) || !(await isEventsModuleEnabled(organizationId))) return { error: t("chooseUnauthorized") };
  const event = await getEvent(organizationId, eventId);
  if (!event || !isDayOfOpen(event)) return { error: t("chooseUnauthorized") };

  const wanted = new Set(formData.getAll("document").map(String));
  for (const candidate of await listDayDocumentCandidates(organizationId, eventId)) {
    const embedded = wanted.has(dayDocumentKey(candidate.source, candidate.sourceId));
    if (embedded !== candidate.embedded) {
      await setDayDocumentEmbedded({ organizationId, eventId, source: candidate.source, sourceId: candidate.sourceId, embedded });
    }
  }
  revalidatePath(`/jour-j/${eventId}`);
  return { success: true };
}
