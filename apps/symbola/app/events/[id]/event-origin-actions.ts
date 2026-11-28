"use server";

// Lot 70e (EVT-01, EVT-07, CRM-03 ; A14) — la source du prospect et un client de plus, depuis la fiche :
// « Nouvel évènement » ne les demande plus. Session, organisation et module vérifiés ; l'évènement et la
// source sont ceux de l'organisation (RLS).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import type { EventClientInput } from "@symbola/contracts";
import { unexpectedActionError } from "@/lib/action-errors";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { ContactNotFoundError } from "@/modules/hub/service";
import { addEventClient, EventClientsFullError, EventNotFoundError } from "@/modules/events/service";
import { isEventsModuleEnabled, isValidId } from "../module-access";

export type EventOriginFormState = { error?: string; success?: boolean };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const field = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim().slice(0, 200);

async function authorize(t: Awaited<ReturnType<typeof getTranslations>>) {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") } as const;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return { error: t("moduleUnavailable") } as const;
  return { organizationId: auth.user.organizationId } as const;
}

export async function addEventClientAction(_prev: EventOriginFormState, formData: FormData): Promise<EventOriginFormState> {
  const t = await getTranslations("Events");
  const access = await authorize(t);
  if ("error" in access) return { error: access.error };
  const eventId = field(formData, "eventId");
  if (!isValidId(eventId)) return { error: t("eventNotFound") };
  const contactId = field(formData, "contactId");
  const firstName = field(formData, "firstName");
  const lastName = field(formData, "lastName");
  let client: EventClientInput;
  if (UUID.test(contactId)) client = { contactId, firstName: "" };
  else if (firstName) client = { firstName, lastName: lastName || null };
  else return { error: (await getTranslations("Validation"))("clientFirstNameRequired") };
  try {
    await addEventClient({ organizationId: access.organizationId, eventId, client });
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("eventNotFound") };
    if (error instanceof EventClientsFullError) return { error: t("clientsFull") };
    if (error instanceof ContactNotFoundError) return { error: (await getTranslations("Contacts"))("notFound") };
    return { error: await unexpectedActionError(error) };
  }
  revalidatePath(`/events/${eventId}`);
  revalidatePath("/events");
  return { success: true };
}
