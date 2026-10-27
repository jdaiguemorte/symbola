"use server";

import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createProspect, listProspectSources } from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";

export type NewProspectFormState = { error?: string };

export async function createProspectAction(
  _prevState: NewProspectFormState,
  formData: FormData,
): Promise<NewProspectFormState> {
  const t = await getTranslations("Events");
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return { error: t("moduleUnavailable") };

  const firstName1 = String(formData.get("firstName1") ?? "").trim();
  const lastName1 = String(formData.get("lastName1") ?? "").trim();
  const firstName2 = String(formData.get("firstName2") ?? "").trim();
  const lastName2 = String(formData.get("lastName2") ?? "").trim();
  const prospectSourceId = String(formData.get("prospectSourceId") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "").trim();
  const venueName = String(formData.get("venueName") ?? "").trim();
  const venueCity = String(formData.get("venueCity") ?? "").trim();

  if (!firstName1) return { error: t("missingFirstName") };
  if (!prospectSourceId) return { error: t("missingSource") };

  const sources = await listProspectSources(organizationId);
  if (!sources.some((source) => source.id === prospectSourceId)) return { error: t("missingSource") };

  const clients = [{ firstName: firstName1, lastName: lastName1 || null }];
  if (firstName2) clients.push({ firstName: firstName2, lastName: lastName2 || null });

  const result = await createProspect({
    organizationId,
    createdByUserId: auth.user.id,
    clients,
    prospectSourceId,
    eventDate: eventDate || null,
    venueName: venueName || null,
    venueCity: venueCity || null,
  });

  redirect(`/events/${result.id}`);
}
