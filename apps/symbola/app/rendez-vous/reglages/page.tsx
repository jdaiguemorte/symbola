import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { getDocumentHeader } from "@/modules/hub/service";
import { bookingPrivacyNotice, getBookingPage, listAppointmentTypes, suggestBookingSlug } from "@/modules/appointments/service";
import { appointmentsPlanner } from "../access";
import { Notice } from "../notice";
import { addStarterTypesAction, createAppointmentTypeAction, saveBookingPageAction, trashAppointmentTypeAction } from "../actions";

type Query = { ok?: string; erreur?: string; type?: string };

// Lot 46 (RDV-01, D11 ; ADR 0080) — la page publique de réservation (adresse, ouverture, mention
// d'information) et les types de rendez-vous. Un type se crée avec son nom et sa durée seulement
// (moins d'une minute) ; le reste a sa valeur par défaut et se règle ensuite.
export default async function AppointmentSettingsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await appointmentsPlanner();
  const t = await getTranslations("Appointments");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("settingsTitle")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const organizationId = auth.user.organizationId;
  const query = await searchParams;
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const [page, types] = await Promise.all([getBookingPage(organizationId), listAppointmentTypes(organizationId)]);
  const organizationName = (await getDocumentHeader(appDatabase(), organizationId))?.organizationName ?? "";
  const slug = page?.slug ?? (await suggestBookingSlug(organizationName));
  const defaultNotice = await bookingPrivacyNotice(organizationId, locale, null);

  return (
    <main>
      <PageHeader title={t("settingsTitle")} subtitle={t("settingsSubtitle")} actions={<Link href="/rendez-vous">{t("backToList")}</Link>} />
      <ScreenHelp title={tHelp("appointmentSettings.title")} body={tHelp("appointmentSettings.body")} />
      <Notice ok={query.ok} error={query.erreur} />

      <section className="card" aria-labelledby="types">
        <h2 id="types">{t("typesTitle")}</h2>
        {types.length === 0 ? (
          <>
            <p>{t("typesEmpty")}</p>
            <form action={addStarterTypesAction}>
              <button type="submit">{t("addStarters")}</button>
            </form>
          </>
        ) : (
          <ul className="appointment-types">
            {types.map((type) => (
              <li key={type.id} className={type.id === query.type ? "highlight" : undefined}>
                <Link href={`/rendez-vous/reglages/types/${type.id}`}>{type.name}</Link>{" "}
                <span className="meta">
                  {t("typeSummary", { minutes: type.durationMinutes, place: t(`locationKind.${type.locationKind}`) })}
                  {type.active ? "" : ` · ${t("typeInactive")}`}
                </span>
                <form action={trashAppointmentTypeAction} className="inline-form">
                  <input type="hidden" name="id" value={type.id} />
                  <button type="submit" className="link-button" aria-label={t("trashTypeLabel", { name: type.name })}>
                    {t("trashType")}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        {/* RDV-01 : deux champs, tout le reste par défaut. */}
        <form action={createAppointmentTypeAction} className="row-wrap" aria-labelledby="new-type-title">
          <h3 id="new-type-title" className="sr-only">
            {t("newTypeTitle")}
          </h3>
          <label>
            {t("typeName")}
            <input type="text" name="name" required maxLength={120} placeholder={t("typeNamePlaceholder")} />
          </label>
          <label>
            {t("typeDuration")}
            <select name="durationMinutes" defaultValue="60">
              {[15, 30, 45, 60, 90, 120, 180, 240].map((minutes) => (
                <option key={minutes} value={minutes}>
                  {t("minutes", { minutes })}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="primary">
            {t("createType")}
          </button>
        </form>
      </section>

      <section className="card" aria-labelledby="page-title">
        <h2 id="page-title">{t("pageTitle")}</h2>
        <p className="meta">{t("pageHint")}</p>
        <form action={saveBookingPageAction} className="stack">
          <label>
            {t("pageSlug")}
            <span className="input-prefix">
              <span aria-hidden="true">/reserver/</span>
              <input type="text" name="slug" defaultValue={slug} required minLength={3} maxLength={60} pattern="[a-z0-9]+(-[a-z0-9]+)*" aria-describedby="slug-hint" />
            </span>
          </label>
          <p id="slug-hint" className="meta">
            {t("pageSlugHint")}
          </p>
          <label className="checkbox">
            <input type="checkbox" name="active" defaultChecked={page?.active ?? true} />
            {t("pageActive")}
          </label>
          <label>
            {t("pageNotice")}
            <textarea name="privacyNotice" rows={6} maxLength={3000} defaultValue={page?.privacyNotice ?? ""} placeholder={defaultNotice} aria-describedby="notice-hint" />
          </label>
          <p id="notice-hint" className="meta">
            {t("pageNoticeHint")}
          </p>
          <button type="submit" className="primary">
            {t("pageSave")}
          </button>
        </form>
        {page?.active ? (
          <p>
            <Link href={`/reserver/${page.slug}`} target="_blank" rel="noopener">
              {t("pageOpen")}
            </Link>
          </p>
        ) : null}
      </section>
    </main>
  );
}
