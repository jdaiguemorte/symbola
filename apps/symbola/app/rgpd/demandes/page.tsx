import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { parisDate } from "@symbola/privacy";
import { ScreenHelp } from "@/app/screen-help";
import { listPrivacyRequests, PRIVACY_REQUEST_TYPES, type PrivacyRequestView } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { closeRequestAction } from "./actions";
import { ExtendRequestForm, NewRequestForm } from "./request-forms";

// RGPD-04 — suivi des demandes d'exercice de droits : type, réception,
// échéance légale, statut ; prolongation motivée, clôture.
export default async function PrivacyRequestsPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const t = await getTranslations("Privacy");
  const tHelp = await getTranslations("Help");
  if (auth.user.role !== "owner") {
    return (
      <main>
        <h1>{t("requestsTitle")}</h1>
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }
  const locale = (await getLocale()) as Locale;
  const { sql, db } = createAppConnection();
  let requests: PrivacyRequestView[];
  try {
    requests = await listPrivacyRequests(db, auth.user.organizationId);
  } finally {
    await sql.end();
  }
  const deadline = (request: PrivacyRequestView) => {
    if (request.daysLeft === null) return t("requestClosed");
    if (request.daysLeft < 0) return t("requestOverdue", { days: -request.daysLeft });
    return t("requestDaysLeft", { days: request.daysLeft });
  };

  return (
    <main>
      <h1>{t("requestsTitle")}</h1>
      <ScreenHelp title={tHelp("privacyRequests.title")} body={tHelp("privacyRequests.body")} />
      <p>
        <Link href="/rgpd">{t("backToSearch")}</Link> · <Link href="/rgpd/reglages">{t("settingsLink")}</Link>
      </p>
      <section aria-labelledby="new-request">
        <h2 id="new-request">{t("newRequestTitle")}</h2>
        <NewRequestForm types={PRIVACY_REQUEST_TYPES} today={parisDate(new Date())} />
      </section>
      <section aria-labelledby="requests-list">
        <h2 id="requests-list">{t("requestsListTitle")}</h2>
        {requests.length === 0 ? <p>{t("noRequests")}</p> : null}
        <ul>
          {requests.map((request) => (
            <li key={request.id}>
              <h3>
                {t(`requestType.${request.type}`)} — {request.personLabel}
              </h3>
              <p>
                {t("requestDates", { received: formatCalendarDate(request.receivedOn, locale), due: formatCalendarDate(request.dueOn, locale) })} —{" "}
                {t(`requestStatus.${request.status}`)} —{" "}
                {request.dueSoon ? <strong>{t("requestAlert", { deadline: deadline(request) })}</strong> : deadline(request)}
              </p>
              {request.extensionReason ? <p>{t("extensionReasonValue", { reason: request.extensionReason })}</p> : null}
              {request.status === "open" ? <ExtendRequestForm requestId={request.id} personLabel={request.personLabel} /> : null}
              {request.status !== "closed" ? (
                <form action={closeRequestAction}>
                  <input type="hidden" name="requestId" value={request.id} />
                  <button type="submit">{t("closeRequest", { person: request.personLabel })}</button>
                </form>
              ) : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
