// Lot 16 (ADR 0045) — rubrique « Types d'événements » des Paramètres : le type
// d'un événement dit qui sont ses clients (les mariés, ou un client), et donc
// le vocabulaire de ses écrans.
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { countEventsByType } from "@/modules/events/service";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { isEventsModuleEnabled } from "../../module-access";
import { AddEventTypeForm, EventTypeRow } from "../event-type-forms";

export default async function EventTypesSettingsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("EventTypes");
  if (!(await isEventsModuleEnabled(organizationId))) {
    const tEvents = await getTranslations("Events");
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{tEvents("moduleUnavailable")}</p>
      </main>
    );
  }
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const [types, counts] = await Promise.all([ensureEventTypes(organizationId, locale), countEventsByType(organizationId)]);

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("eventTypes.title")} body={tHelp("eventTypes.body")} />
      <p>{t("intro")}</p>
      <div className="list-table-wrap" role="region" aria-label={t("tableLabel")} tabIndex={0}>
        <table className="list-table">
          <thead>
            <tr>
              <th scope="col">{t("columnLabel")}</th>
              <th scope="col">{t("columnEvents")}</th>
              <th scope="col">{t("columnActions")}</th>
            </tr>
          </thead>
          <tbody>
            {types.map((type) => (
              <EventTypeRow key={`${type.id}-${type.label}-${type.audience}`} type={type} eventCount={counts[type.id] ?? 0} others={types.filter((other) => other.id !== type.id)} />
            ))}
          </tbody>
        </table>
      </div>
      <section aria-labelledby="add-event-type-title" className="card">
        <h2 id="add-event-type-title">{t("add")}</h2>
        <AddEventTypeForm />
      </section>
    </main>
  );
}
