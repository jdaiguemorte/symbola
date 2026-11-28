import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { getAvailability, listMyCalendarSources } from "@/modules/appointments/service";
import { appointmentsPlanner } from "../access";
import { WeekEditor } from "./week-editor";
import { Notice } from "../notice";
import { addCalendarSourceAction, addClosureAction, refreshCalendarSourceAction, removeCalendarSourceAction, removeClosureAction, saveAvailabilityAction } from "../actions";

// Lot 46 (RDV-02 ; D2, D4 ; ADR 0082) — mes disponibilités : plages de la semaine (deux par jour au
// plus), jours fermés, et mes agendas extérieurs (adresse secrète ICS, relue toutes les quinze
// minutes ; seules les plages occupées sont gardées). Chaque personne de l'équipe ne voit que les
// siens ; l'adresse n'est jamais réaffichée.
export default async function AvailabilityPage({ searchParams }: { searchParams: Promise<{ ok?: string; erreur?: string }> }) {
  const auth = await appointmentsPlanner();
  const t = await getTranslations("Appointments");
  const tMenu = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{tMenu("rubrics.appointmentAvailability.label")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const { organizationId, id: userId } = auth.user;
  const [availability, sources] = await Promise.all([getAvailability(organizationId, userId), listMyCalendarSources(organizationId, userId)]);
  
  return (
    <main>
      <PageHeader title={tMenu("rubrics.appointmentAvailability.label")} subtitle={t("availabilitySubtitle")} actions={<Link href="/rendez-vous">{t("backToList")}</Link>} />
      <ScreenHelp title={tHelp("appointmentAvailability.title")} body={tHelp("appointmentAvailability.body")} />
      <Notice ok={query.ok} error={query.erreur} />

      {/* Lot 61 (retours de recette) : la semaine tenait sur plus de deux écrans (quatre champs empilés par
          jour), et « Mes agendas » se trouvait tout en bas. Une ligne par jour ; un sommaire en tête. */}
      <nav aria-label={t("availabilitySections")} className="toolbar">
        <a href="#week-title" className="button-link">
          {t("weekTitle")}
        </a>
        <a href="#closures-title" className="button-link">
          {t("closuresTitle")}
        </a>
        <a href="#agendas" className="button-link">
          {t("sourcesTitle")}
        </a>
      </nav>

      <section className="card" aria-labelledby="week-title">
        <h2 id="week-title">{t("weekTitle")}</h2>
        <p className="field-hint">{t("weekHint")}</p>
        {availability.isDefault ? <p className="field-hint">{t("weekDefault")}</p> : null}
        {/* Lot 64 (maquette M6) : une grille, une ligne par jour, à la manière de Calendly. */}
        <WeekEditor rules={availability.rules} isDefault={availability.isDefault} action={saveAvailabilityAction} />
      </section>

      <section className="card" aria-labelledby="closures-title">
        <h2 id="closures-title">{t("closuresTitle")}</h2>
        {availability.closures.length === 0 ? <p>{t("closuresEmpty")}</p> : null}
        <ul className="plain-list">
          {availability.closures.map((closure) => (
            <li key={closure.id} className="row-wrap">
              <span>
                {closure.startsOn === closure.endsOn ? formatCalendarDate(closure.startsOn, locale) : t("closureRange", { from: formatCalendarDate(closure.startsOn, locale), to: formatCalendarDate(closure.endsOn, locale) })}
                {closure.reason ? ` — ${closure.reason}` : ""}
              </span>
              <form action={removeClosureAction} className="inline-form">
                <input type="hidden" name="id" value={closure.id} />
                <button type="submit" className="link-button">
                  {t("remove")}
                </button>
              </form>
            </li>
          ))}
        </ul>
        <form action={addClosureAction} className="form-inline">
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
          <button type="submit" className="button-secondary">
            {t("closureAdd")}
          </button>
        </form>
      </section>

      <section className="card" aria-labelledby="agendas">
        <h2 id="agendas">{t("sourcesTitle")}</h2>
        <p>{t("sourcesIntro")}</p>
        {sources.length === 0 ? (
          <p>{t("sourcesEmpty")}</p>
        ) : (
          <ul className="setting-list calendar-sources">
            {sources.map((source) => (
              <li key={source.id} className="setting-row" data-state={source.state}>
                <div className="setting-row-text">
                  <div className="setting-row-head">
                    <h3>{source.label}</h3>
                    <span className={source.state === "ok" ? "badge badge-sauge" : source.state === "error" ? "badge badge-terracotta" : "badge badge-ambre"}>{t(`sourceState.${source.state}`)}</span>
                  </div>
                  <p>{source.urlHint}</p>
                  <p className={source.state === "error" ? "text-overdue" : undefined}>
                    {source.state === "ok" && source.lastSuccessAt ? t("sourceOk", { date: formatDateTime(new Date(source.lastSuccessAt), locale) }) : null}
                    {source.state === "pending" ? t("sourcePending") : null}
                    {source.state === "error" ? t("sourceError", { reason: t(`sourceErrorKind.${source.lastErrorKind ?? "http"}`) }) : null}
                  </p>
                </div>
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
        )}
        <h3 id="agenda-add-title">{t("sourceAddTitle")}</h3>
        <ol className="calendar-steps" id="source-url-hint">
          <li>
            {t("sourceStepFind")}
            <ul>
              <li>{t("sourceStepGoogle")}</li>
              <li>{t("sourceStepApple")}</li>
              <li>{t("sourceStepOutlook")}</li>
            </ul>
          </li>
          <li>{t("sourceStepPaste")}</li>
        </ol>
        <form action={addCalendarSourceAction} className="stack agenda-form" aria-labelledby="agenda-add-title">
          <div className="form-row">
            <label>
              {t("sourceLabel")}
              <input type="text" name="label" required maxLength={80} placeholder={t("sourceLabelPlaceholder")} />
            </label>
            <label>
              {t("sourceUrl")}
              <input type="text" inputMode="url" name="url" required maxLength={2000} autoComplete="off" spellCheck={false} aria-describedby="source-url-hint" />
            </label>
          </div>
          <button type="submit">{t("sourceAdd")}</button>
        </form>
        <p className="field-hint">{t("sourcesPrivacy")}</p>
      </section>
    </main>
  );
}
