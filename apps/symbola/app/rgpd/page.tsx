import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { parisDate } from "@symbola/privacy";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requireOwner } from "@/lib/guards";
import { getPrivacyCase, listPrivacyRequests, PRIVACY_REQUEST_TYPES, type PrivacyCaseView } from "@/modules/hub/service";
import { NewRequestForm } from "./demandes/request-forms";
import { deadlineBadge } from "./deadline";
import { displayPerson } from "./person";
import { PrivacyTabs } from "./privacy-tabs";

// RGPD-04, lot 18 (RGPD-07, ADR 0047) — Données personnelles : les demandes
// d'exercice de droits, chacune ouvrant son dossier, l'échéance et
// l'avancement d'un coup d'œil. Titulaire du compte seulement.
export default async function PrivacyPage() {
  const auth = await requireOwner();
  const t = await getTranslations("Privacy");
  const tHelp = await getTranslations("Help");
  if (!auth) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const db = appDatabase();
  const organizationId = auth.user.organizationId;
  const requests = await listPrivacyRequests(db, organizationId);
  const cases: PrivacyCaseView[] = await Promise.all(requests.map((request) => getPrivacyCase(db, organizationId, request.id)));
  const alerts = requests.filter((request) => request.dueSoon).length;

  return (
    <main>
      <PageHeader title={t("title")} subtitle={t("requestsSubtitle")} />
      <ScreenHelp title={tHelp("privacyRequests.title")} body={tHelp("privacyRequests.body")} />
      <PrivacyTabs alerts={alerts} />

      <section aria-labelledby="requests-list" className="settings-block">
        <h2 id="requests-list">{t("requestsListTitle")}</h2>
        {cases.length === 0 ? (
          <p>{t("noRequests")}</p>
        ) : (
          <div className="list-table-wrap" role="region" aria-labelledby="requests-list" tabIndex={0}>
            <table className="list-table">
              <thead>
                <tr>
                  <th scope="col">{t("columnPerson")}</th>
                  <th scope="col">{t("columnRequest")}</th>
                  <th scope="col">{t("columnDeadline")}</th>
                  <th scope="col">{t("columnProgress")}</th>
                </tr>
              </thead>
              <tbody>
                {cases.map((view) => {
                  const badge = deadlineBadge(view.request, t, locale);
                  return (
                    <tr key={view.request.id}>
                      <td>
                        <Link href={`/rgpd/demandes/${view.request.id}`}>{displayPerson(view.request.personLabel, t("personAnonymized"))}</Link>
                        <br />
                        <small>{t("receivedOn", { date: formatCalendarDate(view.request.receivedOn, locale) })}</small>
                      </td>
                      <td>{t(`requestType.${view.request.type}`)}</td>
                      <td>
                        <span className={badge.className}>{badge.label}</span>
                      </td>
                      <td>{t(`caseProgress.${view.request.status === "closed" ? "closed" : view.current}`)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section aria-labelledby="new-request" className="settings-block">
        <h2 id="new-request">{t("newRequestTitle")}</h2>
        <NewRequestForm types={PRIVACY_REQUEST_TYPES} today={parisDate(new Date())} />
      </section>
    </main>
  );
}
