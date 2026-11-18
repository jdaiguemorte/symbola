// Lot 33 (D4, ADR 0067) — la Propriétaire et l'Exploitation se connectent avec une double
// authentification. Sans elle, cette page : l'installer dans le centre de compte du fournisseur
// d'identité (application d'authentification ou clé d'accès), puis se reconnecter.
// Lot 52 (HUB-05, D4 ; ADR 0094) — connecté, « Mes sessions » : chaque session ouverte du compte, son
// appareil (sans adresse IP ni ville), sa dernière activité, « cet appareil » ; « Fermer » sur chacune
// et « Fermer toutes les autres ».
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { listAccountSessions } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { formatDateTime, type Locale } from "@symbola/i18n";
import { getAuthContext, getSessionToken } from "@/lib/auth-context";
import { deviceText } from "@/lib/device";
import { accountCenterUrl } from "@/lib/identity";
import { logoutAction } from "@/app/logout-action";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { closeOtherSessionsAction, closeSessionAction } from "./actions";
import { SecurityLinkForm } from "./security-link-form";

type Query = { ferme?: string; fermees?: string };

export default async function SecurityPage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  const t = await getTranslations("Security");
  if (auth.status === "mfa_required") {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t(auth.role === "admin" ? "operatorBody" : auth.role === "accountant" ? "accountantBody" : "ownerBody")}</p>
        <p>
          <a className="button" href={accountCenterUrl()}>
            {t("setUp")}
          </a>
        </p>
        <SecurityLinkForm />
        <form action={logoutAction}>
          <button type="submit" className="button-ghost">
            {t("signOut")}
          </button>
        </form>
      </main>
    );
  }

  const query = await searchParams;
  const locale = (await getLocale()) as Locale;
  const tDevices = await getTranslations("Devices");
  const tHelp = await getTranslations("Help");
  const sessions = await listAccountSessions(appDatabase(), { userId: auth.user.id, currentSessionToken: await getSessionToken() });
  const others = sessions.filter((session) => !session.current).length;
  const closedCount = Number(query.fermees);
  return (
    <main>
      <PageHeader title={t("sessionsTitle")} subtitle={t("sessionsSubtitle")} />
      <ScreenHelp title={tHelp("sessions.title")} body={tHelp("sessions.body")} />
      {query.ferme === "1" ? <p role="status">{t("sessionClosed")}</p> : null}
      {Number.isInteger(closedCount) && query.fermees !== undefined ? <p role="status">{t("sessionsClosed", { count: closedCount })}</p> : null}
      <ul className="session-list">
        {sessions.map((session) => (
          <li key={session.id} className="session-row">
            <div>
              <p className="session-device">
                {deviceText(session.device, tDevices as never)}
                {session.current ? <span className="badge">{t("thisDevice")}</span> : null}
              </p>
              <p className="muted">{t("lastSeen", { date: formatDateTime(session.lastSeenAt, locale) })}</p>
            </div>
            {session.current ? null : (
              <form action={closeSessionAction}>
                <input type="hidden" name="sessionId" value={session.id} />
                <button type="submit" className="button-ghost" aria-label={t("closeOneLabel", { device: deviceText(session.device, tDevices as never) })}>
                  {t("closeOne")}
                </button>
              </form>
            )}
          </li>
        ))}
      </ul>
      {others > 0 ? (
        <form action={closeOtherSessionsAction}>
          <button type="submit">{t("closeOthers", { count: others })}</button>
        </form>
      ) : (
        <p className="muted">{t("onlyThisOne")}</p>
      )}
      <p className="muted">{t("noLocation")}</p>
      <p>
        <a href={accountCenterUrl()}>{t("manageFactors")}</a>
      </p>
    </main>
  );
}
