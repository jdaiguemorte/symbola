// Lot 33b (HUB-10, PAR-01 ; D10) — « Votre espace est prêt » : l'écran qui suit le questionnaire
// dit en clair ce qui a été préparé (types d'évènements, tâches de rétroplanning, postes de budget,
// régime de TVA), puis propose deux chemins : créer le premier évènement, ou explorer un exemple.
// « Moment de vérité » de PAR-01 : la planner doit y reconnaître son métier.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { getActiveEventsTrial, listDefaultVendorSlots, listTaskTemplates } from "@/modules/events/service";
import { ensureEventTypes } from "@/lib/events/event-types";
import { getOrganizationProfile, getSetupState } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { clientFieldLabelsByAudience } from "@/lib/vocabulary";
import { ScreenHelp } from "@/app/screen-help";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { exploreExampleAction } from "./actions";
import { FirstEventForm } from "./first-event-form";

export default async function ReadyPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Onboarding");
  const tHelp = await getTranslations("Help");
  const db = appDatabase();
  const state = await getSetupState(db, organizationId);
  if (!state.completed && auth.user.role === "owner") redirect("/demarrage");

  const locale = (await getLocale()) as Locale;
  const eventsEnabled = await isEventsModuleEnabled(organizationId);
  const [profile, eventTypes, templates, budgetLines, example] = await Promise.all([
    getOrganizationProfile(db, organizationId),
    eventsEnabled ? ensureEventTypes(organizationId, locale) : Promise.resolve([]),
    eventsEnabled ? listTaskTemplates(organizationId) : Promise.resolve([]),
    eventsEnabled ? listDefaultVendorSlots(organizationId) : Promise.resolve([]),
    eventsEnabled ? getActiveEventsTrial(organizationId) : Promise.resolve(null),
  ]);
  const tasks = templates[0]?.items.length ?? 0;

  return (
    <main className="setup onboarding-ready">
      <h1>{t("ready.title")}</h1>
      <ScreenHelp title={tHelp("setupReady.title")} body={tHelp("setupReady.body")} />
      <section className="card" aria-labelledby="ready-prepared">
        <h2 id="ready-prepared">{t("ready.intro")}</h2>
        <ul className="ready-list">
          {eventTypes.length > 0 ? <li>{t("ready.eventTypes", { types: eventTypes.map((type) => type.label).join(", ") })}</li> : null}
          {eventsEnabled ? <li>{t("ready.tasks", { count: tasks })}</li> : null}
          {eventsEnabled ? <li>{t("ready.budgetLines", { count: budgetLines.length })}</li> : null}
          {profile.vatRegime ? <li>{t("ready.vat", { regime: t(`vatRegime.${profile.vatRegime}`) })}</li> : null}
        </ul>
        <p className="muted">
          {t("ready.editLater")} <Link href="/parametres">{t("ready.settingsLink")}</Link>
        </p>
      </section>

      <h2>{t("ready.choiceTitle")}</h2>
      {eventsEnabled ? (
        <div className="ready-choices">
          <section className="card" aria-labelledby="ready-first-event">
            <h3 id="ready-first-event">{t("ready.firstEventTitle")}</h3>
            <p>{t("ready.firstEventBody")}</p>
            <FirstEventForm eventTypes={eventTypes.map(({ id, label, audience }) => ({ id, label, audience }))} clientLabels={clientFieldLabelsByAudience(locale)} />
          </section>
          <section className="card" aria-labelledby="ready-example">
            <h3 id="ready-example">{t("ready.exampleTitle")}</h3>
            <p>{t("ready.exampleBody")}</p>
            {example ? (
              <Link className="button-link" href={`/events/${example.eventId}`}>
                {t("ready.exampleOpen")}
              </Link>
            ) : (
              <form action={exploreExampleAction}>
                <button type="submit">{t("ready.exampleSubmit")}</button>
              </form>
            )}
          </section>
        </div>
      ) : (
        <section className="card">
          <p>{t("ready.noEventsModule")}</p>
          <Link href="/">{t("ready.goHome")}</Link>
        </section>
      )}
    </main>
  );
}
