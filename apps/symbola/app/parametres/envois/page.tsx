// Lot 55 (MSG-05 ; D2 ; ADR 0101) — « Journal des envois » : chaque e-mail de l'organisation, son objet
// et son statut (envoyé, remis, rejeté, plainte), filtrable par évènement (?evenement=) et par contact
// (?contact=). Gardé 13 mois, jamais le contenu.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { EMAIL_DELIVERY_STATUSES, type EmailDeliveryStatus } from "@symbola/contracts";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { canSeeEvent } from "@/lib/event-visibility";
import { isValidId } from "@/app/events/module-access";
import { getContact, listEmailDeliveries } from "@/modules/hub/service";

type Query = { evenement?: string; contact?: string; statut?: string };

export default async function EmailDeliveriesPage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("EmailDeliveries");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const eventId = query.evenement && isValidId(query.evenement) && (await canSeeEvent(auth, query.evenement)) ? query.evenement : null;
  const contact = query.contact && isValidId(query.contact) ? await getContact(organizationId, query.contact) : null;
  const status = (EMAIL_DELIVERY_STATUSES as readonly string[]).includes(query.statut ?? "") ? (query.statut as EmailDeliveryStatus) : null;
  const deliveries = await listEmailDeliveries(organizationId, { eventId, email: contact?.email ?? null, status });
  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("emailDeliveries.title")} body={tHelp("emailDeliveries.body")} />
      <p>{t("intro")}</p>
      <form method="get" className="form-inline" aria-label={t("filterLabel")}>
        {eventId ? <input type="hidden" name="evenement" value={eventId} /> : null}
        {contact ? <input type="hidden" name="contact" value={contact.id} /> : null}
        <label htmlFor="delivery-status">{t("statusFilter")}</label>
        <select id="delivery-status" name="statut" defaultValue={status ?? ""}>
          <option value="">{t("allStatuses")}</option>
          {EMAIL_DELIVERY_STATUSES.map((value) => (
            <option key={value} value={value}>
              {t(`status.${value}`)}
            </option>
          ))}
        </select>
        <button type="submit" className="button-ghost">
          {t("filter")}
        </button>
      </form>
      {eventId || contact ? (
        <p className="meta">
          {contact ? t("filteredContact", { name: contact.displayName }) : t("filteredEvent")} <Link href="/parametres/envois">{t("clearFilter")}</Link>
        </p>
      ) : null}
      {deliveries.length === 0 ? (
        <p>{t("none")}</p>
      ) : (
        <div className="table-scroll" role="region" aria-label={t("title")} tabIndex={0}>
          <table>
            <caption className="sr-only">{t("title")}</caption>
            <thead>
              <tr>
                <th scope="col">{t("columnDate")}</th>
                <th scope="col">{t("columnTo")}</th>
                <th scope="col">{t("columnSubject")}</th>
                <th scope="col">{t("columnStatus")}</th>
              </tr>
            </thead>
            <tbody>
              {deliveries.map((delivery) => (
                <tr key={delivery.id}>
                  <td>{formatDateTime(new Date(delivery.sentAt), locale)}</td>
                  <td className="wrap-anywhere">{delivery.recipient ?? "—"}</td>
                  <td>{delivery.subject}</td>
                  <td className={`delivery-status delivery-status-${delivery.status}`}>
                    {t(`status.${delivery.status}`)}
                    {delivery.reason ? ` — ${t(`reason.${delivery.reason}`)}` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="meta">{t("retention")}</p>
    </main>
  );
}
