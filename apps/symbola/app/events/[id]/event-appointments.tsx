// Lot 46 (EVT-10 ; D8 ; ADR 0083) — section « Rendez-vous et comptes rendus » de l'onglet Synthèse :
// les rendez-vous rattachés à l'évènement, leur compte rendu et leurs actions (celles devenues
// tâches le disent). Elle n'existe que si le module Rendez-vous est ouvert (ARC-07) ; elle charge
// elle-même ses données, par le service du module.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import { isAppointmentsModuleEnabled, listEventAppointments } from "@/modules/appointments/service";

export async function EventAppointments({ organizationId, eventId, locale }: { organizationId: string; eventId: string; locale: Locale }) {
  if (!(await isAppointmentsModuleEnabled(organizationId))) return null;
  const t = await getTranslations("Appointments.event");
  const entries = await listEventAppointments(organizationId, eventId);
  return (
    <section className="card" aria-labelledby="event-appointments-title">
      <div className="section-head">
        <h2 id="event-appointments-title">{t("title")}</h2>
        <Link className="button-link" href={`/rendez-vous/nouveau?evenement=${eventId}`}>
          {t("add")}
        </Link>
      </div>
      {entries.length === 0 ? <p>{t("empty")}</p> : null}
      <ul className="event-appointments">
        {entries.map(({ appointment, report }) => (
          <li key={appointment.id}>
            <Link href={`/rendez-vous/${appointment.id}`}>
              {formatDateTime(new Date(appointment.startsAt), locale)} — {appointment.typeName}
            </Link>
            <span className="meta">
              {" "}
              · {appointment.personName}
              {appointment.status === "cancelled" ? ` · ${t("cancelled")}` : ""}
            </span>
            {report?.notes ? <p className="task-comment-body">{report.notes}</p> : null}
            {report && report.actions.length > 0 ? (
              <ul aria-label={t("actionsLabel")}>
                {report.actions.map((action) => (
                  <li key={action.id}>
                    {action.label}
                    {action.dueOn ? ` · ${formatCalendarDate(action.dueOn, locale)}` : ""}
                    {action.taskId ? ` · ${t("isTask")}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}
