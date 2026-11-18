import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { getBookingPage, listAppointments, listAppointmentTypes, type Appointment } from "@/modules/appointments/service";
import { appointmentsPlanner } from "./access";
import { Notice } from "./notice";

type Query = { ok?: string; erreur?: string; passes?: string };

// Lot 46 (RDV-01 à RDV-04 ; ADR 0082) — les rendez-vous de l'organisation : à venir d'abord, puis les
// trente derniers passés à la demande. L'app s'utilise seule (RDV-04) : sans type ni page, l'écran
// dit par quoi commencer ; jamais d'écran vide ni d'erreur.
export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await appointmentsPlanner();
  const t = await getTranslations("Appointments");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const organizationId = auth.user.organizationId;
  const now = new Date();
  const showPast = query.passes === "1";
  const [types, page, upcoming, past] = await Promise.all([
    listAppointmentTypes(organizationId),
    getBookingPage(organizationId),
    listAppointments(organizationId, { from: now }),
    showPast ? listAppointments(organizationId, { to: now, order: "desc", limit: 30 }) : Promise.resolve([]),
  ]);
  const list = (items: Appointment[], label: string) => (
    <ul className="appointment-list" aria-label={label}>
      {items.map((appointment) => (
        <li key={appointment.id} className="card appointment-row" data-status={appointment.status}>
          <Link href={`/rendez-vous/${appointment.id}`}>
            <strong>{formatDateTime(new Date(appointment.startsAt), locale)}</strong> — {appointment.typeName}
          </Link>
          <p className="meta">
            {appointment.personName}
            {appointment.status === "cancelled" ? ` · ${t("status.cancelled")}` : ""}
            {appointment.origin === "public" ? ` · ${t("origin.public")}` : ` · ${t("origin.manual")}`}
          </p>
        </li>
      ))}
    </ul>
  );

  return (
    <main>
      <PageHeader
        title={t("title")}
        subtitle={t("subtitle")}
        actions={
          <>
            <Link className="button-link" href="/rendez-vous/disponibilites">
              {t("availabilityLink")}
            </Link>
            <Link className="button-link" href="/rendez-vous/reglages">
              {t("settingsLink")}
            </Link>
            {types.length > 0 ? (
              <Link className="button-link button-link-primary" href="/rendez-vous/nouveau">
                {t("newManual")}
              </Link>
            ) : null}
          </>
        }
      />
      <ScreenHelp title={tHelp("appointmentsList.title")} body={tHelp("appointmentsList.body")} />
      <Notice ok={query.ok} error={query.erreur} />

      {types.length === 0 || !page ? (
        <section className="empty-state" aria-labelledby="rdv-start-title">
          <h2 id="rdv-start-title">{t("start.title")}</h2>
          <ol>
            <li className={types.length > 0 ? "done" : undefined}>{t("start.types")}</li>
            <li className={page ? "done" : undefined}>{t("start.page")}</li>
            <li>{t("start.share")}</li>
          </ol>
          <p className="row-wrap">
            <Link className="button-link button-link-primary" href="/rendez-vous/reglages">
              {t("start.action")}
            </Link>
            <Link href="/aide">{t("start.help")}</Link>
          </p>
        </section>
      ) : (
        <p className="meta">
          {t("pageAddress")} <code>/reserver/{page.slug}</code>
          {page.active ? "" : ` — ${t("pageInactive")}`}
        </p>
      )}

      <section aria-labelledby="rdv-upcoming-title">
        <h2 id="rdv-upcoming-title">{t("upcomingTitle")}</h2>
        {upcoming.length === 0 ? <p>{t("upcomingEmpty")}</p> : list(upcoming, t("upcomingTitle"))}
      </section>

      <section aria-labelledby="rdv-past-title">
        <h2 id="rdv-past-title">{t("pastTitle")}</h2>
        {showPast ? (past.length === 0 ? <p>{t("pastEmpty")}</p> : list(past, t("pastTitle"))) : <Link href="/rendez-vous?passes=1#rdv-past-title">{t("showPast")}</Link>}
      </section>
    </main>
  );
}
