"use server";

// Lot 38b (HUB-29 ; D11 ; ADR 0072) — créer (ou régénérer) l'adresse secrète d'un flux de calendrier,
// la sienne ou celle du programme d'un évènement, et la retirer. L'adresse n'est rendue qu'ici, une
// fois. Session planner vérifiée ; le module Évènements doit être souscrit ; l'évènement doit être
// de l'organisation.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { parseEnv } from "@symbola/env";
import { requirePlanner } from "@/lib/guards";
import { isEventsModuleEnabled, isValidId } from "@/app/events/module-access";
import { getEvent } from "@/modules/events/service";
import { issueCalendarFeed, revokeCalendarFeed } from "@/modules/hub/service";

export type CalendarAddressState = { url?: string; error?: string; at?: number };

async function target(formData: FormData): Promise<{ organizationId: string; userId: string; eventId: string | null } | null> {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return null;
  const eventId = String(formData.get("eventId") ?? "");
  if (!eventId) return { organizationId, userId: auth.user.id, eventId: null };
  if (!isValidId(eventId) || !(await getEvent(organizationId, eventId))) return null;
  return { organizationId, userId: auth.user.id, eventId };
}

export async function issueCalendarAddressAction(_prev: CalendarAddressState, formData: FormData): Promise<CalendarAddressState> {
  const found = await target(formData);
  if (!found) return { error: (await getTranslations("Calendar"))("unavailable") };
  const { token } = await issueCalendarFeed(found);
  revalidatePath("/profil");
  if (found.eventId) revalidatePath(`/events/${found.eventId}`);
  return { url: `${parseEnv(process.env).APP_PUBLIC_URL.replace(/\/+$/, "")}/calendrier/${token}.ics`, at: Date.now() };
}

export async function revokeCalendarAddressAction(formData: FormData): Promise<void> {
  const found = await target(formData);
  if (!found) return;
  await revokeCalendarFeed(found);
  revalidatePath("/profil");
  if (found.eventId) revalidatePath(`/events/${found.eventId}`);
}
