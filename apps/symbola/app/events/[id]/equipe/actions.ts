"use server";

// Lot 52 (EVT-06 ; D2, D3 ; ADR 0094) — l'équipe d'un évènement (planner principal, assistants) et ses
// renforts du jour J (lien personnel, sans compte). Contrôles côté serveur : session de l'équipe,
// organisation, module, évènement visible ; la base ne touche que l'organisation (RLS).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale } from "next-intl/server";
import { EVENT_TEAM_ROLES, type EventTeamRole } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { MailQuotaExceededError } from "@symbola/mail";
import { requirePlanner } from "@/lib/guards";
import { canViewEvent, createDayHelper, DemoEventRestrictionError, EventLinkInvalidError, EventNotFoundError, EventTeamMemberInvalidError, removeEventTeamMember, revokeDayHelper, setEventTeamMember } from "@/modules/events/service";
import { EmailVariableMissingError, getEventVisibility } from "@/modules/hub/service";
import { isEventsModuleEnabled, isValidId } from "../../module-access";

async function context(formData: FormData) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const eventId = String(formData.get("eventId") ?? "");
  if (!isValidId(eventId) || !(await isEventsModuleEnabled(organizationId))) redirect("/events");
  const { allPlannersSeeAll } = await getEventVisibility(appDatabase(), organizationId);
  if (!(await canViewEvent(organizationId, { userId: auth.user.id, role: auth.user.role as "owner" | "member", allPlannersSeeAll }, eventId))) redirect("/events");
  return { organizationId, eventId, userId: auth.user.id };
}

function back(eventId: string, outcome: string): never {
  revalidatePath(`/events/${eventId}/equipe`);
  redirect(`/events/${eventId}/equipe?resultat=${outcome}`);
}

export async function setTeamMemberAction(formData: FormData): Promise<void> {
  const { organizationId, eventId, userId } = await context(formData);
  const member = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!isValidId(member) || !EVENT_TEAM_ROLES.includes(role as EventTeamRole)) back(eventId, "invalid");
  try {
    await setEventTeamMember({ organizationId, eventId, userId: member, role: role as EventTeamRole, byUserId: userId });
  } catch (error) {
    if (error instanceof EventTeamMemberInvalidError || error instanceof EventNotFoundError) back(eventId, "invalid");
    throw error;
  }
  back(eventId, "saved");
}

export async function removeTeamMemberAction(formData: FormData): Promise<void> {
  const { organizationId, eventId, userId } = await context(formData);
  const member = String(formData.get("userId") ?? "");
  if (!isValidId(member)) back(eventId, "invalid");
  await removeEventTeamMember({ organizationId, eventId, userId: member, byUserId: userId });
  back(eventId, "removed");
}

export type AddHelperState = { error?: "name" | "email" | "phone" | "date" | "demo" | "quota" | "template" | "failed"; sent?: boolean };

export async function addDayHelperAction(_previous: AddHelperState, formData: FormData): Promise<AddHelperState> {
  const { organizationId, eventId, userId } = await context(formData);
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  try {
    await createDayHelper({
      organizationId,
      eventId,
      helper: { personName: String(formData.get("personName") ?? ""), email: String(formData.get("email") ?? ""), phone: String(formData.get("phone") ?? "") || null },
      locale,
      byUserId: userId,
    });
  } catch (error) {
    if (error instanceof EventLinkInvalidError) return { error: error.reason === "phone" || error.reason === "date" || error.reason === "email" ? error.reason : "name" };
    if (error instanceof DemoEventRestrictionError) return { error: "demo" };
    if (error instanceof MailQuotaExceededError) return { error: "quota" };
    if (error instanceof EmailVariableMissingError) return { error: "template" };
    console.error("renfort du jour J : création impossible", error instanceof Error ? error.name : "erreur");
    return { error: "failed" };
  }
  revalidatePath(`/events/${eventId}/equipe`);
  return { sent: true };
}

export async function revokeDayHelperAction(formData: FormData): Promise<void> {
  const { organizationId, eventId } = await context(formData);
  const linkId = String(formData.get("linkId") ?? "");
  if (!isValidId(linkId)) back(eventId, "invalid");
  const revoked = await revokeDayHelper(organizationId, eventId, linkId);
  back(eventId, revoked ? "helper_revoked" : "invalid");
}
