import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { eventNames, listEvents } from "@/modules/events/service";
import { isEventsModuleAvailable, listAppointmentTypes } from "@/modules/appointments/service";
import { appointmentsPlanner } from "../access";
import { Notice } from "../notice";
import { createManualAppointmentAction } from "../actions";

// Lot 46 (RDV-03, D8) — un rendez-vous saisi à la main (téléphone, salon, dégustation), sans page
// publique : à l'heure choisie (heure de Paris) ; la personne est prévenue si elle a une adresse
// e-mail et si la case est cochée. Avec le module Évènements, il se rattache tout de suite.
export default async function NewAppointmentPage({ searchParams }: { searchParams: Promise<{ erreur?: string; evenement?: string }> }) {
  const auth = await appointmentsPlanner();
  const t = await getTranslations("Appointments");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("newManual")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const query = await searchParams;
  const organizationId = auth.user.organizationId;
  const types = (await listAppointmentTypes(organizationId)).filter((type) => type.active);
  const events = (await isEventsModuleAvailable(organizationId)) ? (await listEvents({ organizationId })).filter((event) => !event.isDemo && event.status !== "cancelled" && event.status !== "closed") : null;

  return (
    <main>
      <PageHeader title={t("newManual")} subtitle={t("newManualSubtitle")} actions={<Link href="/rendez-vous">{t("backToList")}</Link>} />
      <ScreenHelp title={tHelp("appointmentNew.title")} body={tHelp("appointmentNew.body")} />
      <Notice error={query.erreur} />
      {types.length === 0 ? (
        <p>
          {t("noActiveType")} <Link href="/rendez-vous/reglages#types">{t("settingsLink")}</Link>
        </p>
      ) : (
        <form action={createManualAppointmentAction} className="stack card">
          <label>
            {t("type")}
            <select name="typeId" required>
              {types.map((type) => (
                <option key={type.id} value={type.id}>
                  {t("typeOption", { name: type.name, minutes: type.durationMinutes })}
                </option>
              ))}
            </select>
          </label>
          <label>
            {t("startsAt")}
            <input type="datetime-local" name="startsAt" required step={900} />
          </label>
          <label>
            {t("personName")}
            <input type="text" name="name" required maxLength={200} autoComplete="off" />
          </label>
          <label>
            {t("personEmail")}
            <input type="email" name="email" maxLength={254} autoComplete="off" />
          </label>
          <label>
            {t("personPhone")}
            <input type="tel" name="phone" maxLength={40} autoComplete="off" />
          </label>
          {events ? (
            <label>
              {t("linkedEvent")}
              <select name="eventId" defaultValue={query.evenement ?? ""}>
                <option value="">{t("noEvent")}</option>
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {eventNames(event.clients)}
                    {event.eventDate ? ` — ${event.eventDate}` : ""}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <input type="hidden" name="eventId" value="" />
          )}
          <label className="checkbox">
            <input type="checkbox" name="notify" defaultChecked />
            {t("notifyPerson")}
          </label>
          <button type="submit" className="primary">
            {t("createManual")}
          </button>
        </form>
      )}
    </main>
  );
}
