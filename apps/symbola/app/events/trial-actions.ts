"use server";

// AIDE-02 — démarrer ou terminer l'essai guidé du module événements.
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { endEventsTrial, startEventsTrial } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled, isValidId } from "./module-access";

export async function startTrialAction(): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) redirect("/login");
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) redirect("/events");
  const trial = await startEventsTrial({
    organizationId: auth.user.organizationId,
    userId: auth.user.id,
    locale: (await getLocale()) === "en" ? "en" : "fr",
  });
  redirect(`/events/${trial.eventId}`);
}

export async function endTrialAction(formData: FormData): Promise<void> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) redirect("/login");
  const eventId = String(formData.get("eventId") ?? "");
  if (isValidId(eventId)) await endEventsTrial(auth.user.organizationId, eventId);
  redirect("/events?essai=termine");
}
