import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { getAvailability, listMyCalendarSources } from "@/modules/appointments/service";
import { appointmentsPlanner } from "../access";
import { Notice } from "../notice";
import { addCalendarSourceAction, addClosureAction, refreshCalendarSourceAction, removeCalendarSourceAction, removeClosureAction, saveAvailabilityAction } from "../actions";

// Lot 46 (RDV-02 ; D2, D4 ; ADR 0083) — mes disponibilités : plages de la semaine (deux par jour au
// plus), jours fermés, et mes agendas extérieurs (adresse secrète ICS, relue toutes les quinze
// minutes ; seules les plages occupées sont gardées). Chaque personne de l'équipe ne voit que les
// siens ; l'adresse n'est jamais réaffichée.
export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const auth = await appointmentsPlanner();
  const t = await getTranslations("Appointments");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("availabilityTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const { organizationId, id: userId } = auth.user;
  const [availability, sources] = await Promise.all([getAvailability(organizationId, userId), listMyCalendarSources(organizationId, userId)]);
  const rulesOf = (weekday: number) => availability.rules.filter((rule) => rule.weekday === weekday);

  return (
    <main>
      <PageHeader title={t("availabilityTitle")} subtitle={t("availabilitySubtitle")} actions={<Link href="/rendez-vous">{t("backToList")}</Link>} />
      <ScreenHelp title={tHelp("appointmentAvailability.title")} body={tHelp("appointmentAvailability.body")} />
      <Notice ok={query.ok} error={query.erreur} />

      <section className="card" aria-labelledby="week-title">
        <h2 id="week-title">{t("weekTitle")}</h2>
        {availability.isDefault ? <p className="meta">{t("weekDefault")}</p> : null}
        <form action={saveAvailabilityAction} className="stack">
          {[1, 2, 3, 4, 5, 6, 7].map((weekday) => (
            <fieldset key={weekday} className="availability-day">
              <legend>{t(`weekday.${weekday}`)}</legend>
              {[0, 1].map((slot) => {
                const rule = rulesOf(weekday)[slot];
                return (
                  <div key={slot} className="row-wrap">
                    <label>
                      {t("from")}
                      <input type="time" name={`d${weekday}s${slot}`} defaultValue={rule?.startTime ?? ""} step={900} />
                    </label>
                    <label>
                      {t("to")}
                      <input type="time" name={`d${weekday}e${slot}`} defaultValue={rule?.endTime ?? ""} step={900} />
                    </label>
                  </div>
                );
              })}
            </fieldset>
          ))}
          <button type="submit" className="primary">
            {t("weekSave")}
          </button>
        </form>
      </section>

      <section className="card" aria-labelledby="closures-title">
        <h2 id="closures-title">{t("closuresTitle")}</h2>
        {availability.closures.length === 0 ? <p>{t("closuresEmpty")}</p> : null}
        <ul>
          {availability.closures.map((closure) => (
            <li key={closure.id}>
              {closure.startsOn === closure.endsOn ? formatCalendarDate(closure.startsOn, locale) : t("closureRange", { from: formatCalendarDate(closure.startsOn, locale), to: formatCalendarDate(closure.endsOn, locale) })}
              {closure.reason ? ` — ${closure.reason}` : ""}
              <form action={removeClosureAction} className="inline-form">
                <input type="hidden" name="id" value={closure.id} />
                <button type="submit" className="link-button">
                  {t("remove")}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addClosureAction} className="row-wrap">
          <label>
            {t("closureFrom")}
            <input type="date" name="startsOn" required />
          </label>
          <label>
            {t("closureTo")}
            <input type="date" name="endsOn" />
          </label>
          <label>
            {t("closureReason")}
            <input type="text" name="reason" maxLength={80} />
          </label>
          <button type="submit">{t("closureAdd")}</button>
        </form>
      </section>

      <section className="card" aria-labelledby="agendas">
        <h2 id="agendas">{t("sourcesTitle")}</h2>
        <p className="meta">{t("sourcesHint")}</p>
        {sources.length === 0 ? <p>{t("sourcesEmpty")}</p> : null}
        <ul className="calendar-sources">
          {sources.map((source) => (
            <li key={source.id} data-state={source.state}>
              <strong>{source.label}</strong> <span className="meta">{source.urlHint}</span>
              <p className={source.state === "error" ? "text-overdue" : "meta"}>
                {source.state === "ok" && source.lastSuccessAt ? t("sourceOk", { date: formatDateTime(new Date(source.lastSuccessAt), locale) }) : null}
                {source.state === "pending" ? t("sourcePending") : null}
                {source.state === "error" ? t("sourceError", { reason: t(`sourceErrorKind.${source.lastErrorKind ?? "http"}`) }) : null}
              </p>
              <div className="row-wrap">
                <form action={refreshCalendarSourceAction}>
                  <input type="hidden" name="id" value={source.id} />
                  <button type="submit">{t("sourceRefresh")}</button>
                </form>
                <form action={removeCalendarSourceAction}>
                  <input type="hidden" name="id" value={source.id} />
                  <button type="submit" aria-label={t("sourceRemoveLabel", { label: source.label })}>
                    {t("remove")}
                  </button>
                </form>
              </div>
            </li>
          ))}
        </ul>
        <form action={addCalendarSourceAction} className="stack">
          <label>
            {t("sourceLabel")}
            <input type="text" name="label" required maxLength={80} placeholder={t("sourceLabelPlaceholder")} />
          </label>
          <label>
            {t("sourceUrl")}
            <input type="text" inputMode="url" name="url" required maxLength={2000} autoComplete="off" spellCheck={false} aria-describedby="source-url-hint" />
          </label>
          <p id="source-url-hint" className="meta">
            {t("sourceUrlHint")}
          </p>
          <button type="submit">{t("sourceAdd")}</button>
        </form>
      </section>
    </main>
  );
}
