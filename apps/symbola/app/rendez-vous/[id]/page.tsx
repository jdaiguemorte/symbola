import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { APPOINTMENT_CANCEL_REASONS } from "@symbola/contracts";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { eventNames, getEvent, listEvents, listProspectSources } from "@/modules/events/service";
import { getAppointment, getAppointmentReport, isEventsModuleAvailable } from "@/modules/appointments/service";
import { appointmentsPlanner } from "../access";
import { Notice } from "../notice";
import {
  addReportActionAction,
  cancelAppointmentAction,
  convertActionToTaskAction,
  createOptionAction,
  linkEventAction,
  moveAppointmentAction,
  removeReportActionAction,
  saveReportAction,
  trashAppointmentAction,
} from "../actions";

// « 2027-03-02T10:00 » pour un champ date et heure, à l'heure de Paris.
function localInput(iso: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const part = (type: string) => parts.find((entry) => entry.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

// Lot 46 (RDV-03, RDV-04, EVT-10 ; D7 à D9 ; ADR 0082) — la fiche d'un rendez-vous : déplacer ou
// annuler (la personne est prévenue), rattacher à un évènement ou en créer une option sans ressaisie
// (si le module Évènements est ouvert), compte rendu et actions ; une action devient une tâche de
// l'évènement en un geste. Le compte rendu n'est jamais partagé au client (POR-10).
export default async function AppointmentPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erreur?: string }> }) {
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
  const { id } = await params;
  const organizationId = auth.user.organizationId;
  const appointment = await getAppointment(organizationId, id);
  if (!appointment) notFound();
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const report = await getAppointmentReport(organizationId, appointment.id);
  const eventsAvailable = await isEventsModuleAvailable(organizationId);
  const linkedEvent = eventsAvailable && appointment.eventId ? await getEvent(organizationId, appointment.eventId) : null;
  const events = eventsAvailable && !appointment.eventId ? (await listEvents({ organizationId })).filter((event) => !event.isDemo && event.status !== "cancelled" && event.status !== "closed") : [];
  const sources = eventsAvailable && !appointment.eventId ? await listProspectSources(organizationId) : [];
  const booked = appointment.status === "booked";

  return (
    <main>
      <PageHeader
        title={`${appointment.typeName} — ${appointment.personName}`}
        badge={<span className={booked ? "badge badge-sauge" : "badge badge-terracotta"}>{t(`status.${appointment.status}`)}</span>}
        subtitle={formatDateTime(new Date(appointment.startsAt), locale)}
        actions={<Link href="/rendez-vous">{t("backToList")}</Link>}
      />
      <ScreenHelp title={tHelp("appointmentDetail.title")} body={tHelp("appointmentDetail.body")} />
      <Notice ok={query.ok} error={query.erreur} />

      <section className="card" aria-labelledby="details-title">
        <h2 id="details-title">{t("detailsTitle")}</h2>
        <dl>
          <dt>{t("personName")}</dt>
          <dd>{appointment.contactId ? <Link href={`/contacts/${appointment.contactId}`}>{appointment.personName}</Link> : appointment.personName}</dd>
          {appointment.personEmail ? (
            <>
              <dt>{t("personEmail")}</dt>
              <dd>{appointment.personEmail}</dd>
            </>
          ) : null}
          {appointment.personPhone ? (
            <>
              <dt>{t("personPhone")}</dt>
              <dd>{appointment.personPhone}</dd>
            </>
          ) : null}
          <dt>{t("typeLocation")}</dt>
          <dd>
            {t(`locationKind.${appointment.locationKind}`)}
            {appointment.location ? ` — ${appointment.location}` : ""}
          </dd>
          <dt>{t("originLabel")}</dt>
          <dd>{t(`origin.${appointment.origin}`)}</dd>
          {appointment.cancelledAt ? (
            <>
              <dt>{t("cancelledOn")}</dt>
              <dd>
                {formatDateTime(new Date(appointment.cancelledAt), locale)} · {t(`cancelledBy.${appointment.cancelledBy ?? "planner"}`)}
                {appointment.cancelReason ? ` · ${t(`cancelReason.${appointment.cancelReason}`)}` : ""}
              </dd>
            </>
          ) : null}
        </dl>
        {appointment.answers.length > 0 ? (
          <>
            <h3>{t("answersTitle")}</h3>
            <dl>
              {appointment.answers.map((answer) => (
                <div key={answer.questionId}>
                  <dt>{answer.label}</dt>
                  <dd>{answer.answer}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}
      </section>

      {booked ? (
        <section className="card" aria-labelledby="change-title">
          <h2 id="change-title">{t("changeTitle")}</h2>
          <form action={moveAppointmentAction} className="row-wrap">
            <input type="hidden" name="id" value={appointment.id} />
            <label>
              {t("newStartsAt")}
              <input type="datetime-local" name="startsAt" required step={900} defaultValue={localInput(appointment.startsAt)} />
            </label>
            <label className="checkbox">
              <input type="checkbox" name="notify" defaultChecked={Boolean(appointment.personEmail)} disabled={!appointment.personEmail} />
              {t("notifyPerson")}
            </label>
            <button type="submit">{t("move")}</button>
          </form>
          <form action={cancelAppointmentAction} className="row-wrap">
            <input type="hidden" name="id" value={appointment.id} />
            <label>
              {t("cancelReasonLabel")}
              <select name="reason" defaultValue="">
                <option value="">{t("cancelReasonNone")}</option>
                {APPOINTMENT_CANCEL_REASONS.map((reason) => (
                  <option key={reason} value={reason}>
                    {t(`cancelReason.${reason}`)}
                  </option>
                ))}
              </select>
            </label>
            <label className="checkbox">
              <input type="checkbox" name="notify" defaultChecked={Boolean(appointment.personEmail)} disabled={!appointment.personEmail} />
              {t("notifyPerson")}
            </label>
            <button type="submit" className="button-danger">
              {t("cancel")}
            </button>
          </form>
        </section>
      ) : null}

      {eventsAvailable ? (
        <section className="card" aria-labelledby="event-title">
          <h2 id="event-title">{t("eventTitle")}</h2>
          {linkedEvent ? (
            <>
              <p>
                <Link href={`/events/${linkedEvent.id}`}>{eventNames(linkedEvent.clients)}</Link>
                {linkedEvent.eventDate ? ` — ${formatCalendarDate(linkedEvent.eventDate, locale)}` : ""}
              </p>
              <form action={linkEventAction}>
                <input type="hidden" name="id" value={appointment.id} />
                <input type="hidden" name="eventId" value="" />
                <button type="submit" className="link-button">
                  {t("unlinkEvent")}
                </button>
              </form>
            </>
          ) : (
            <>
              <p className="meta">{t("eventHint")}</p>
              {events.length > 0 ? (
                <form action={linkEventAction} className="row-wrap">
                  <input type="hidden" name="id" value={appointment.id} />
                  <label>
                    {t("linkedEvent")}
                    <select name="eventId" required>
                      {events.map((event) => (
                        <option key={event.id} value={event.id}>
                          {eventNames(event.clients)}
                          {event.eventDate ? ` — ${formatCalendarDate(event.eventDate, locale)}` : ""}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button type="submit">{t("linkEvent")}</button>
                </form>
              ) : null}
              {sources.length > 0 ? (
                <form action={createOptionAction} className="row-wrap">
                  <input type="hidden" name="id" value={appointment.id} />
                  <label>
                    {t("optionSource")}
                    <select name="prospectSourceId" required>
                      {sources.map((source) => (
                        <option key={source.id} value={source.id}>
                          {source.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {t("optionDate")}
                    <input type="date" name="eventDate" />
                  </label>
                  <button type="submit">{t("createOption")}</button>
                </form>
              ) : (
                <p className="meta">
                  {t("optionNeedsSource")} <Link href="/events/parametres/sources">{t("optionSourcesLink")}</Link>
                </p>
              )}
            </>
          )}
        </section>
      ) : null}

      <section className="card" aria-labelledby="compte-rendu">
        <h2 id="compte-rendu">{t("reportTitle")}</h2>
        <p className="meta">{t("reportPrivate")}</p>
        <form action={saveReportAction} className="stack">
          <input type="hidden" name="id" value={appointment.id} />
          <label>
            {t("reportNotes")}
            <textarea name="notes" rows={6} maxLength={10_000} defaultValue={report?.notes ?? ""} />
          </label>
          <FreeTextNotice />
          <button type="submit">{t("reportSave")}</button>
        </form>

        <h3>{t("actionsTitle")}</h3>
        {report && report.actions.length > 0 ? (
          <ul className="report-actions">
            {report.actions.map((action) => (
              <li key={action.id}>
                <strong>{action.label}</strong>
                <span className="meta">
                  {action.dueOn ? ` · ${formatCalendarDate(action.dueOn, locale)}` : ""} · {t(`responsible.${action.responsible}`)}
                </span>
                {action.taskId && action.taskEventId ? (
                  eventsAvailable ? (
                    <Link href={`/events/${action.taskEventId}?onglet=retroplanning&tache=${action.taskId}`} className="badge badge-sauge">
                      {t("isTask")}
                    </Link>
                  ) : (
                    <span className="badge badge-sauge">{t("isTask")}</span>
                  )
                ) : appointment.eventId && eventsAvailable ? (
                  <form action={convertActionToTaskAction} className="inline-form">
                    <input type="hidden" name="id" value={appointment.id} />
                    <input type="hidden" name="actionId" value={action.id} />
                    <button type="submit" aria-label={t("makeTaskLabel", { label: action.label })}>
                      {t("makeTask")}
                    </button>
                  </form>
                ) : eventsAvailable ? (
                  <a href="#event-title" className="meta">
                    {t("linkFirst")}
                  </a>
                ) : null}
                {!action.taskId ? (
                  <form action={removeReportActionAction} className="inline-form">
                    <input type="hidden" name="id" value={appointment.id} />
                    <input type="hidden" name="actionId" value={action.id} />
                    <button type="submit" className="link-button" aria-label={t("removeActionLabel", { label: action.label })}>
                      {t("remove")}
                    </button>
                  </form>
                ) : null}
              </li>
            ))}
          </ul>
        ) : (
          <p>{t("actionsEmpty")}</p>
        )}
        <form action={addReportActionAction} className="row-wrap">
          <input type="hidden" name="id" value={appointment.id} />
          <label>
            {t("actionLabel")}
            <input type="text" name="label" required maxLength={200} />
          </label>
          <label>
            {t("actionDue")}
            <input type="date" name="dueOn" />
          </label>
          <label>
            {t("actionWho")}
            <select name="responsible" defaultValue="planner">
              <option value="planner">{t("responsible.planner")}</option>
              <option value="clients">{t("responsible.clients")}</option>
            </select>
          </label>
          <button type="submit">{t("actionAdd")}</button>
        </form>
      </section>

      <form action={trashAppointmentAction}>
        <input type="hidden" name="id" value={appointment.id} />
        <button type="submit" className="link-button">
          {t("trash")}
        </button>
      </form>
    </main>
  );
}
