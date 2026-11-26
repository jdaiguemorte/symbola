import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatAmount, formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { starterAppCatalog } from "@symbola/starter-templates";
import { ScreenHelp } from "@/app/screen-help";
import { ConfirmDialog } from "@/app/ui/confirm-dialog";
import { ErrorNotice } from "@/app/ui/notices";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import { appOffer, getPlanCatalog, getSubscription, isModuleEnabled, isModuleKey, listModuleRequests, moduleActivationPath, type AppOffer } from "@/modules/hub/service";
import { addAppToSubscriptionAction, cancelAppRequestAction, requestAppAction } from "./actions";

// Lot 63g (HUB-06, HUB-27, ARC-06, ARC-07, SEC-09 ; ADR 0108) — « Apps » : chaque module du catalogue
// (plans.json), son état (« Activée », « Non activée », « Demandée le … »), ce qu'il apporte et où le
// trouver une fois activé. Le seul écran qui nomme une app non activée (ARC-07 : ailleurs, rien ne
// change). Pendant le pilote (libre-service fermé, ADR 0101), « Demander l'activation » ouvre une
// fenêtre sans champ libre ; la demande s'annule tant qu'elle attend. Libre-service ouvert,
// « Ajouter à mon abonnement » annonce le prix, le prorata et le nouveau total, puis passe par
// « Mon abonnement ». La Propriétaire seulement.
const ERRORS = ["forbidden", "unknown_module", "already_enabled", "self_service", "not_found", "managed"] as const;

type Query = { ok?: string; erreur?: string; app?: string };

export default async function AppsPage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await requirePlanner();
  const t = await getTranslations("Apps");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;

  const header = (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("apps.title")} body={tHelp("apps.body")} />
    </>
  );
  if (auth.user.role !== "owner") {
    return (
      <main>
        {header}
        <p>{t("ownerOnly")}</p>
      </main>
    );
  }

  const db = appDatabase();
  const organizationId = auth.user.organizationId;
  const now = new Date();
  const apps = starterAppCatalog().filter((app) => isModuleKey(app.key));
  const [path, requests, catalog, subscription, enabled] = await Promise.all([
    moduleActivationPath(db, organizationId),
    listModuleRequests(db, organizationId),
    getPlanCatalog(db),
    getSubscription(db, organizationId),
    Promise.all(apps.map(async (app) => [app.key, isModuleKey(app.key) && (await isModuleEnabled(db, organizationId, app.key))] as const)).then((entries) => new Map(entries)),
  ]);
  const day = (date: Date) => formatCalendarDate(parisToday(date), locale);
  const error = ERRORS.find((code) => code === query.erreur);
  const requestedApp = apps.find((app) => app.key === query.app);

  const offerDetails = (offer: Extract<AppOffer, { kind: "option" }>, label: string) => (
    <table className="app-offer">
      <caption className="sr-only">{t("offerCaption")}</caption>
      <tbody>
        <tr>
          <td>{label}</td>
          <td className="num">{t(offer.period === "yearly" ? "pricePerYear" : "pricePerMonth", { amount: formatAmount(offer.priceCents, locale) })}</td>
        </tr>
        {offer.prorataCents !== 0 && offer.periodEnd ? (
          <tr>
            <td className="muted">{t("prorata", { date: day(offer.periodEnd) })}</td>
            <td className="num muted">{formatAmount(offer.prorataCents, locale)}</td>
          </tr>
        ) : null}
        <tr>
          <th scope="row">{t(offer.period === "yearly" ? "newTotalYearly" : "newTotalMonthly")}</th>
          <td className="num">
            <strong>{formatAmount(offer.newTotalCents, locale)}</strong>
          </td>
        </tr>
      </tbody>
    </table>
  );

  return (
    <main>
      {header}
      {error ? <ErrorNotice>{t(`errors.${error}`)}</ErrorNotice> : null}
      {query.ok === "requested" ? (
        <p className="notice" role="status">
          {t("requested", { app: requestedApp?.labels[locale] ?? "" })}
        </p>
      ) : null}
      {query.ok === "cancelled" ? (
        <p className="notice" role="status">
          {t("requestCancelled")}
        </p>
      ) : null}
      <p className="notice">{t.rich(path === "request" ? "pilotIntro" : "selfServiceIntro", { strong: (chunks) => <strong>{chunks}</strong> })}</p>

      <ul className="app-grid" aria-label={t("listLabel")}>
        {apps.map((app) => {
          const label = app.labels[locale];
          const headingId = `app-${app.key}`;
          const open = enabled.get(app.key) ?? false;
          const request = requests.find((entry) => entry.moduleKey === app.key);
          const pending = !open && request?.status === "pending" ? request : null;
          const offer = !open && path === "subscription" ? appOffer(catalog, subscription, app.key, now) : null;
          return (
            <li key={app.key}>
              <section className="card app-card" aria-labelledby={headingId}>
                <div className="app-card-head">
                  <h2 id={headingId}>{label}</h2>
                  {open ? (
                    <span className="badge badge-sauge">{t("status.enabled")}</span>
                  ) : pending ? (
                    <span className="badge badge-ambre">{t("status.requested", { date: day(pending.requestedAt) })}</span>
                  ) : (
                    <span className="badge">{t("status.disabled")}</span>
                  )}
                </div>
                <p>{app.benefits[locale]}</p>
                <p className="muted">{t(open ? "whereToFind" : "whereOnceEnabled", { place: app.whereToFind[locale] })}</p>
                {!open && request?.status === "declined" && request.handledAt ? <p className="muted">{t("declined", { date: day(request.handledAt) })}</p> : null}
                <div className="app-card-actions">
                  {open ? (
                    <Link href={app.href} className="button-link" aria-label={t("openLabel", { app: label })}>
                      {t("open")}
                    </Link>
                  ) : pending ? (
                    <form action={cancelAppRequestAction}>
                      <input type="hidden" name="requestId" value={pending.id} />
                      <button type="submit" className="button-ghost">
                        {t("cancelRequest")}
                      </button>
                    </form>
                  ) : path === "request" ? (
                    <ConfirmDialog
                      trigger={t("request")}
                      triggerLabel={t("requestLabel", { app: label })}
                      title={t("requestTitle", { app: label })}
                      body={t("requestBody")}
                      confirmLabel={t("requestConfirm")}
                      keepLabel={t("cancel")}
                      action={requestAppAction}
                      fields={{ moduleKey: app.key }}
                      tone="primary"
                    >
                      <p className="muted">{t("requestPrivacy")}</p>
                    </ConfirmDialog>
                  ) : offer?.kind === "option" ? (
                    <ConfirmDialog
                      trigger={t("add")}
                      triggerLabel={t("addLabel", { app: label })}
                      title={t("addTitle", { app: label })}
                      body={t("addBody")}
                      confirmLabel={t(offer.period === "yearly" ? "addConfirmYearly" : "addConfirmMonthly", { amount: formatAmount(offer.priceCents, locale) })}
                      keepLabel={t("cancel")}
                      action={addAppToSubscriptionAction}
                      fields={{ moduleKey: app.key }}
                      tone="primary"
                    >
                      {offerDetails(offer, label)}
                    </ConfirmDialog>
                  ) : offer?.kind === "change_plan" ? (
                    <Link href="/parametres/abonnement" className="button-link" aria-label={t("changePlanLabel", { app: label })}>
                      {t("changePlan")}
                    </Link>
                  ) : (
                    <p className="muted">{t("managed")}</p>
                  )}
                </div>
              </section>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
