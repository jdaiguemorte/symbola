// Lot 16 (ADR 0045) — rubrique « Types d'événements » des Paramètres : le type
// d'un événement dit qui sont ses clients (les mariés, ou un client), et donc
// le vocabulaire de ses écrans.
// Lot 74g (§ 7.1) : « Types d'évènements et termes des clients », une rubrique, deux blocs ; l'ancienne
// adresse des termes (/events/parametres/termes) mène au second (#termes). Le patron vient au lot 74i.
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { countEventsByType } from "@/modules/events/service";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { isEventsModuleEnabled } from "../../module-access";
import { AddEventTypeForm, EventTypeList } from "../event-type-forms";
import { ClientTermsBlock } from "../termes/client-terms-block";

export default async function EventTypesSettingsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("EventTypes");
  const tMenu = await getTranslations("SettingsMenu");
  if (!(await isEventsModuleEnabled(organizationId))) {
    const tEvents = await getTranslations("Events");
    return (
      <main>
        <h1>{tMenu("rubrics.eventTypes.label")}</h1>
        <p>{tEvents("moduleUnavailable")}</p>
      </main>
    );
  }
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const [types, counts] = await Promise.all([ensureEventTypes(organizationId, locale), countEventsByType(organizationId)]);

  return (
    <main>
      <h1>{tMenu("rubrics.eventTypes.label")}</h1>
      <ScreenHelp title={tHelp("eventTypes.title")} body={`${tHelp("eventTypes.body")} ${tHelp("clientTerms.body")}`} />
      <div className="settings-fused-block">
        <h2 id="types-title">{t("title")}</h2>
        <p>{t("intro")}</p>
        {/* Lot 62b (UX-13, D1) : tableau éditable, enregistré à la sortie du champ. */}
        <div className="card">
          <EventTypeList types={types} counts={counts} />
        </div>
        <section aria-labelledby="add-event-type-title" className="card">
          <h3 id="add-event-type-title">{t("add")}</h3>
          <AddEventTypeForm />
        </section>
      </div>
      <div id="termes" className="settings-fused-block">
        <ClientTermsBlock organizationId={organizationId} />
      </div>
    </main>
  );
}
