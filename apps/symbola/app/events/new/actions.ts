"use server";

import { redirect } from "next/navigation";
import { unexpectedActionError } from "@/lib/action-errors";
import { discardMyFormDraft } from "@/lib/form-drafts";
import { getLocale, getTranslations } from "next-intl/server";
import type { EventClientInput } from "@symbola/contracts";
import type { Locale } from "@symbola/i18n";
import { ContactNotFoundError } from "@/modules/hub/service";
import { changeEventStatus, countOrganizationRealEvents, createProspect, getActiveEventsTrial, listEventTypes, listProspectSources } from "@/modules/events/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { eventsMessageFor } from "@/lib/vocabulary";
import { isEventsModuleEnabled } from "../module-access";

export type NewProspectFormState = { error?: string };

export async function createProspectAction(
  _prevState: NewProspectFormState,
  formData: FormData,
): Promise<NewProspectFormState> {
  const t = await getTranslations("Events");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return { error: t("moduleUnavailable") };

  // Lot 36a (UX-02) : un contact existant choisi, ou un nom saisi (un nouveau contact).
  const contactIdOf = (name: string) => {
    const value = String(formData.get(name) ?? "").trim();
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) ? value : null;
  };
  const contactId1 = contactIdOf("contactId1");
  const contactId2 = contactIdOf("contactId2");
  const firstName1 = String(formData.get("firstName1") ?? "").trim();
  const lastName1 = String(formData.get("lastName1") ?? "").trim();
  const firstName2 = String(formData.get("firstName2") ?? "").trim();
  const lastName2 = String(formData.get("lastName2") ?? "").trim();
  const prospectSourceId = String(formData.get("prospectSourceId") ?? "").trim();
  const eventDate = String(formData.get("eventDate") ?? "").trim();
  const venueName = String(formData.get("venueName") ?? "").trim();
  const venueCity = String(formData.get("venueCity") ?? "").trim();
  // Lot 16 (ADR 0045) : un type de l'organisation ; il dit aussi comment parler des clients.
  const eventTypeId = String(formData.get("eventTypeId") ?? "").trim();
  const eventType = (await listEventTypes(organizationId)).find((type) => type.id === eventTypeId);
  if (!eventType) return { error: t("missingEventType") };

  if (!firstName1 && !contactId1) return { error: eventsMessageFor((await getLocale()) as Locale, eventType.audience, "missingFirstName") };
  if (!prospectSourceId) return { error: t("missingSource") };

  const sources = await listProspectSources(organizationId);
  if (!sources.some((source) => source.id === prospectSourceId)) return { error: t("missingSource") };

  const clients: EventClientInput[] = [contactId1 ? { contactId: contactId1, firstName: "" } : { firstName: firstName1, lastName: lastName1 || null }];
  if (contactId2) clients.push({ contactId: contactId2, firstName: "" });
  else if (firstName2) clients.push({ firstName: firstName2, lastName: lastName2 || null });

  let result: { id: string };
  try {
    result = await createProspect({
      organizationId,
      createdByUserId: auth.user.id,
      clients,
      prospectSourceId,
      eventTypeId: eventType.id,
      eventDate: eventDate || null,
      venueName: venueName || null,
      venueCity: venueCity || null,
    });
  } catch (error) {
    // Un contact choisi qui n'existe pas (ou plus) dans l'organisation.
    if (error instanceof ContactNotFoundError) return { error: (await getTranslations("Contacts"))("notFound") };
    return { error: await unexpectedActionError(error) };
  }

  // L12-HUB-13 : « Créer un événement » depuis l'agenda = confirmé d'emblée (la
  // fiche propose alors le rétroplanning, L12-EVT-13).
  if (formData.get("confirmed") === "1") {
    await changeEventStatus({ organizationId, eventId: result.id, changedByUserId: auth.user.id, toStatus: "confirmed" });
  }

  // Lot 33b (HUB-10, D10) : au premier évènement réel, la suppression de l'exemple est proposée.
  const example = await getActiveEventsTrial(organizationId);
  const first = example ? (await countOrganizationRealEvents(organizationId)) === 1 : false;
  // Lot 39b (UX-09) : l'évènement est créé, le brouillon de la saisie n'a plus lieu d'être.
  await discardMyFormDraft("event-new");
  redirect(`/events/${result.id}${first ? "?exemple=proposer" : ""}`);
}
