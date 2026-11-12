// Lot 26a (SEC-15, décision D5) — sur l'accueil, les personnes dont le lien a
// expiré et qui en demandent un nouveau ; chaque ligne mène à la fiche de
// l'événement, où la planner le renouvelle d'un clic. Rien quand personne
// n'attend (absent sans module Événements, comme le reste du module).
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { getEventNamesByIds, listPendingLinkRenewals } from "@/modules/events/service";

export async function LinkRenewalsBlock({ organizationId }: { organizationId: string }) {
  const renewals = await listPendingLinkRenewals(organizationId);
  if (renewals.length === 0) return null;
  const t = await getTranslations("Events");
  const locale = (await getLocale()) as Locale;
  const names = await getEventNamesByIds(organizationId, [...new Set(renewals.map((renewal) => renewal.eventId))]);
  return (
    <section className="notice" aria-labelledby="link-renewals-title">
      <h2 id="link-renewals-title">{t("linkRenewalsTitle")}</h2>
      <ul>
        {renewals.map((renewal) => (
          <li key={renewal.linkId}>
            <Link href={`/events/${renewal.eventId}?onglet=maries`}>{t("linkRenewalLine", { name: renewal.personName, event: names[renewal.eventId] ?? "" })}</Link>{" "}
            <span className="meta">{formatDateTime(new Date(renewal.requestedAt), locale)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
