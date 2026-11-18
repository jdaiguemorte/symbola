// Lot 46 (CRM-03, RDV-04 ; ADR 0083) — dans l'historique d'un contact : ses rendez-vous et la note de
// leur compte rendu. Seulement si le module Rendez-vous est ouvert (ARC-07).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { isAppointmentsModuleEnabled, listContactAppointments } from "@/modules/appointments/service";

export async function ContactAppointments({ organizationId, contactId, locale }: { organizationId: string; contactId: string; locale: Locale }) {
  if (!(await isAppointmentsModuleEnabled(organizationId))) return null;
  const t = await getTranslations("Appointments.contact");
  const appointments = await listContactAppointments(organizationId, contactId);
  return (
    <>
      <h3>{t("title")}</h3>
      {appointments.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul>
          {appointments.map((appointment) => (
            <li key={appointment.id}>
              <Link href={`/rendez-vous/${appointment.id}`}>{formatDateTime(new Date(appointment.startsAt), locale)}</Link> · {appointment.typeName}
              {appointment.status === "cancelled" ? ` · ${t("cancelled")}` : ""}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
