import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { parisDate } from "@symbola/privacy";
import { listDueSoonPrivacyRequests, listPrivacyPurges, type PrivacyRequestView } from "@/modules/hub/service";
import { listPurgeCandidates, purgePeriod } from "@/lib/privacy/purge";

// RGPD-04 — « Étant donné une échéance à moins de 7 jours (réglage), alors la
// demande apparaît en alerte dans le tableau de bord du hub. » Titulaire
// seulement ; rien n'est affiché sans demande en alerte.
export async function PrivacyRequestsAlertBlock({ organizationId }: { organizationId: string }) {
  const db = appDatabase();
  const requests: PrivacyRequestView[] = await listDueSoonPrivacyRequests(db, organizationId);
  if (requests.length === 0) return null;
  const t = await getTranslations("Privacy");
  const locale = (await getLocale()) as Locale;
  return (
    <section aria-labelledby="privacy-alerts" role="region">
      <h2 id="privacy-alerts">{t("alertTitle", { count: requests.length })}</h2>
      <ul>
        {requests.map((request) => (
          <li key={request.id}>
            {/* Lot 18 (RGPD-07) : chaque alerte ouvre le dossier de sa demande. */}
            <Link href={`/rgpd/demandes/${request.id}`}>
              {t(`requestType.${request.type}`)} — {request.personLabel}
            </Link>{" "}
            —{" "}
            {request.daysLeft !== null && request.daysLeft < 0
              ? t("requestOverdue", { days: -request.daysLeft })
              : t("requestDueOn", { date: formatCalendarDate(request.dueOn, locale), days: request.daysLeft ?? 0 })}
          </li>
        ))}
      </ul>
      <p>
        <Link href="/rgpd">{t("requestsLink")}</Link>
      </p>
    </section>
  );
}

// RGPD-05 — « Chaque mois, le module liste les personnes dont la durée de
// conservation est échue » : rappel au tableau de bord tant que la liste du
// mois n'a pas été validée. Rien n'est purgé sans validation.
export async function PrivacyPurgeAlertBlock({ organizationId }: { organizationId: string }) {
  const today = parisDate(new Date());
  const db = appDatabase();
  const validatedThisMonth: boolean = (await listPrivacyPurges(db, organizationId)).some((purge) => purge.period === purgePeriod(today));
  if (validatedThisMonth) return null;
  const candidates = await listPurgeCandidates(organizationId, today);
  if (candidates.length === 0) return null;
  const t = await getTranslations("Privacy");
  return (
    <section aria-labelledby="privacy-purge-alert" role="region">
      <h2 id="privacy-purge-alert">{t("purgeAlertTitle", { count: candidates.length })}</h2>
      <p>
        <Link href="/rgpd/purge">{t("purgeLink")}</Link>
      </p>
    </section>
  );
}
