import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { formatAmount, formatDateTime, formatStorageSize, type Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { PageHeader } from "@/app/ui/page-header";
import { requirePlanner } from "@/lib/guards";
import {
  entitledModules,
  findOption,
  findPlan,
  getPlanCatalog,
  getStorageQuota,
  getSubscription,
  isFeatureEnabled,
  isSubscriptionBillingEnabled,
  MODULE_KEYS,
  storageOption,
  subscriptionPrice,
  type SubscriptionView,
} from "@/modules/hub/service";
import { cancelSubscriptionAction, changeSubscriptionAction, resumeSubscriptionAction } from "./actions";

// Lot 54 (HUB-27, ARC-06, DOC-06 ; décisions D1 à D3 ; ADR 0101) — « Mon abonnement » : l'offre, ses
// apps et options, le total, le stockage face au quota (jauge, détail par module), le choix d'une
// autre offre (effet immédiat), les factures de l'éditeur (facturation éteinte tant que la société
// n'est pas créée) et la résiliation en moins de trois clics : « Mon abonnement » → « Résilier » →
// « Confirmer la résiliation ». Fermé tant que l'interrupteur du libre-service ne l'ouvre pas à
// l'organisation (NFR-26) : l'écran le dit, sans erreur (ARC-07). Lecture seule (fin d'essai) : seul
// écran, avec l'export et la fermeture, qui accepte encore des gestes.
const ERRORS = [
  "unknown_plan",
  "not_self_service",
  "module_choice_required",
  "invalid_module_choice",
  "options_not_allowed",
  "unknown_option",
  "invalid_storage_units",
  "yearly_unavailable",
  "seats",
  "managed",
  "forbidden",
  "not_cancellable",
  "not_resumable",
  "read_only",
] as const;

type Query = { erreur?: string; ok?: string; prorata?: string; places?: string; resilier?: string };

function statusDate(subscription: SubscriptionView): Date | null {
  if (subscription.status === "trial") return subscription.trialEndsAt;
  if (subscription.status === "read_only") return subscription.readOnlySince;
  if (subscription.status === "cancelled") return subscription.cancelEffectiveAt;
  return subscription.currentPeriodEnd;
}

export default async function SubscriptionPage({ searchParams }: { searchParams: Promise<Query> }) {
  const auth = await requirePlanner({ allowReadOnly: true });
  const t = await getTranslations("Subscription");
  const tPlans = await getTranslations("AdminPlans");
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const query = await searchParams;
  const db = appDatabase();
  const organizationId = auth.user.organizationId;
  const now = new Date();

  const header = (
    <>
      <PageHeader title={t("title")} subtitle={t("subtitle")} />
      <ScreenHelp title={tHelp("subscription.title")} body={tHelp("subscription.body")} />
    </>
  );
  if (!(await isFeatureEnabled(db, organizationId, "subscription_self_service"))) {
    return (
      <main>
        {header}
        <p className="notice">{t("unavailable")}</p>
      </main>
    );
  }

  const [catalog, subscription, quota, billing] = await Promise.all([getPlanCatalog(db), getSubscription(db, organizationId), getStorageQuota(db, organizationId, now), isSubscriptionBillingEnabled(db)]);
  const owner = auth.user.role === "owner";
  const plan = subscription ? findPlan(catalog, subscription.planKey) : null;
  const managed = plan?.kind === "pilot";
  const date = (value: Date | null) => (value ? formatDateTime(value, locale) : "");
  const error = ERRORS.find((code) => code === query.erreur);
  const moduleName = (moduleKey: string) => tPlans(`moduleNames.${moduleKey}` as never);

  const messages = (
    <>
      {error ? (
        <p className="notice notice-error" role="alert">
          {error === "seats" ? t("errors.seats", { count: Number(query.places) || 0 }) : t(`errors.${error}`)}
        </p>
      ) : null}
      {query.ok === "changed" ? (
        <p className="notice" role="status">
          {Number(query.prorata) ? t("changedProrata", { amount: formatAmount(Number(query.prorata), locale) }) : t("changed")}
        </p>
      ) : null}
      {query.ok === "cancelled" && subscription?.cancelEffectiveAt ? (
        <p className="notice" role="status">
          {t("cancelled", { date: date(subscription.cancelEffectiveAt) })}
        </p>
      ) : null}
      {query.ok === "resumed" ? (
        <p className="notice" role="status">
          {t("resumed")}
        </p>
      ) : null}
    </>
  );

  // L'offre en cours.
  const price = subscription ? subscriptionPrice(catalog, subscription) : null;
  const modules = subscription ? [...entitledModules(catalog, subscription, MODULE_KEYS)] : [];
  const current = (
    <section className="card" aria-labelledby="subscription-current">
      <h2 id="subscription-current">{t("currentTitle")}</h2>
      {subscription && plan ? (
        <>
          <p>
            <strong>{plan.labels[locale]}</strong> —{" "}
            {subscription.status === "active" && !subscription.currentPeriodEnd
              ? t("status.active")
              : subscription.status === "active"
                ? t("status.activeUntil", { date: date(subscription.currentPeriodEnd) })
                : t(`status.${subscription.status}`, { date: date(statusDate(subscription)) })}
          </p>
          <p>
            {t("modulesLabel")} : {modules.length > 0 ? modules.map(moduleName).join(", ") : t("noModule")}
          </p>
          {plan.optionsAllowed ? (
            <p>
              {t("optionsLabel")} :{" "}
              {[
                ...subscription.options.map((key) => findOption(catalog, key)?.labels[locale] ?? key),
                ...(subscription.storageUnits > 0 ? [t("storageUnits", { count: subscription.storageUnits })] : []),
              ].join(", ") || t("noOption")}
            </p>
          ) : null}
          {price ? <p>{price.totalCents === 0 ? t("free") : t("total", { amount: formatAmount(price.totalCents, locale), period: price.period })}</p> : null}
          {managed ? <p className="muted">{t("managed")}</p> : null}
        </>
      ) : (
        <p>{t("noSubscription")}</p>
      )}
      <p className="muted">{billing ? t("billingOn") : t("billingOff")}</p>
      {subscription?.status === "read_only" ? (
        <>
          <p role="note">{t("readOnlyNotice")}</p>
          <p>
            <Link className="button-link" href="/parametres/export">
              {t("exportLink")}
            </Link>
          </p>
        </>
      ) : null}
    </section>
  );

  // Le stockage face au quota (DOC-06).
  const storage = (
    <section className="card" aria-labelledby="subscription-storage">
      <h2 id="subscription-storage">{t("storageTitle")}</h2>
      {!quota ? (
        <p>{t("storageNotMeasured")}</p>
      ) : (
        <>
          {quota.quotaBytes !== null && quota.percent !== null ? (
            <>
              <meter className="quota-meter" min={0} max={100} low={80} high={95} optimum={0} value={Math.min(quota.percent, 100)} aria-label={t("storageGauge")} />
              <p>{t("storageUsed", { used: formatStorageSize(quota.usedBytes, locale), quota: formatStorageSize(quota.quotaBytes, locale), percent: quota.percent })}</p>
            </>
          ) : (
            <p>{t("storageUnlimited", { used: formatStorageSize(quota.usedBytes, locale) })}</p>
          )}
          {quota.blocked ? (
            <p className="notice" role="note">
              {t("storageBlocked", { date: date(quota.uploadsBlockedFrom) })}
            </p>
          ) : quota.uploadsBlockedFrom ? (
            <p className="notice" role="note">
              {t("storageFull", { date: date(quota.uploadsBlockedFrom) })}
            </p>
          ) : quota.alertedPercents.length > 0 ? (
            <p className="notice" role="note">
              {t("storageWarning")}
            </p>
          ) : null}
          <p className="muted">{t("storageMeasuredAt", { date: date(quota.measuredAt) })}</p>
          <div role="region" aria-label={t("storageByModule")} tabIndex={0}>
            <table className="data-table">
              <caption>{t("storageByModule")}</caption>
              <thead>
                <tr>
                  <th scope="col">{t("storageModule")}</th>
                  <th scope="col" className="num">
                    {t("storageVolume")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {Object.entries(quota.usedByModule).map(([moduleKey, bytes]) => (
                  <tr key={moduleKey}>
                    <th scope="row">{t(`storageModules.${moduleKey}` as never)}</th>
                    <td className="num">{formatStorageSize(bytes, locale)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );

  if (!owner) {
    return (
      <main>
        {header}
        <p>{t("ownerOnly")}</p>
        {current}
        {storage}
      </main>
    );
  }

  const selfService = catalog.plans.filter((entry) => entry.kind === "plan" && entry.selfService);
  const moduleOptions = catalog.options.filter((option) => option.kind === "module" && option.selfService);
  const storageExtra = storageOption(catalog);
  const choiceModules = [...new Set(selfService.flatMap((entry) => entry.moduleChoice))];
  const cancellable = subscription && !managed && subscription.status !== "cancelled";
  const confirming = query.resilier === "1" && cancellable;
  const effectiveAt = subscription?.status === "trial" ? subscription.trialEndsAt : subscription?.status === "active" ? subscription.currentPeriodEnd : null;

  return (
    <main>
      {header}
      {messages}
      {current}
      {storage}

      {!managed && subscription?.status !== "cancelled" ? (
        <section aria-labelledby="subscription-change">
          <h2 id="subscription-change">{t("changeTitle")}</h2>
          <p>{t("changeIntro")}</p>
          <form action={changeSubscriptionAction} className="stack">
            <fieldset className="choice-cards">
              <legend>{t("planLegend")}</legend>
              {selfService.map((entry) => (
                <label key={entry.key} className="choice-card">
                  <input type="radio" name="planKey" value={entry.key} defaultChecked={subscription?.planKey === entry.key} required />
                  <span>
                    <strong>{entry.labels[locale]}</strong>
                    <span>{entry.descriptions[locale]}</span>
                    <span>{t("perMonth", { amount: formatAmount(entry.monthlyPriceCents, locale) })}</span>
                    {entry.yearlyPriceCents !== null ? <span>{t("perYear", { amount: formatAmount(entry.yearlyPriceCents, locale) })}</span> : null}
                    <span className="muted">
                      {entry.maxUsers === null ? t("usersUnlimited") : t("users", { count: entry.maxUsers })}
                      {entry.storageQuotaBytes !== null ? ` · ${t("quota", { size: formatStorageSize(entry.storageQuotaBytes, locale) })}` : ""}
                    </span>
                  </span>
                </label>
              ))}
            </fieldset>
            {choiceModules.length > 0 ? (
              <label>
                {t("chosenModule")}
                <select name="chosenModule" defaultValue={subscription?.chosenModule ?? ""}>
                  <option value="">{t("chosenModuleNone")}</option>
                  {choiceModules.map((moduleKey) => (
                    <option key={moduleKey} value={moduleKey}>
                      {moduleName(moduleKey)}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            {moduleOptions.length > 0 ? (
              <fieldset>
                <legend>{t("optionsLegend")}</legend>
                {moduleOptions.map((option) => (
                  <label key={option.key} className="checkbox">
                    <input type="checkbox" name="options" value={option.key} defaultChecked={subscription?.options.includes(option.key) ?? false} />
                    {option.labels[locale]} — {t("perMonth", { amount: formatAmount(option.monthlyPriceCents, locale) })}
                  </label>
                ))}
              </fieldset>
            ) : null}
            {storageExtra?.selfService && storageExtra.storageUnitBytes ? (
              <label>
                {t("storageUnitsLabel", { size: formatStorageSize(storageExtra.storageUnitBytes, locale), amount: formatAmount(storageExtra.monthlyPriceCents, locale) })}
                <input type="number" name="storageUnits" min={0} max={1000} step={1} defaultValue={subscription?.storageUnits ?? 0} />
              </label>
            ) : null}
            <fieldset>
              <legend>{t("periodLegend")}</legend>
              <label className="checkbox">
                <input type="radio" name="billingPeriod" value="monthly" defaultChecked={subscription?.billingPeriod !== "yearly"} />
                {t("periodMonthly")}
              </label>
              <label className="checkbox">
                <input type="radio" name="billingPeriod" value="yearly" defaultChecked={subscription?.billingPeriod === "yearly"} />
                {t("periodYearly")}
              </label>
            </fieldset>
            <p>
              <button type="submit">{t("submitChange")}</button>
            </p>
          </form>
        </section>
      ) : null}

      <section aria-labelledby="subscription-invoices">
        <h2 id="subscription-invoices">{t("invoicesTitle")}</h2>
        <p>{t("noInvoice")}</p>
      </section>

      {subscription?.status === "cancelled" && subscription.cancelEffectiveAt && !subscription.endedAt ? (
        <section aria-labelledby="subscription-cancel">
          <h2 id="subscription-cancel">{t("cancelTitle")}</h2>
          <p role="note">{t("cancelledNotice", { date: date(subscription.cancelEffectiveAt) })}</p>
          <form action={resumeSubscriptionAction}>
            <button type="submit">{t("resume")}</button>
          </form>
        </section>
      ) : cancellable ? (
        <section aria-labelledby="subscription-cancel">
          <h2 id="subscription-cancel">{t("cancelTitle")}</h2>
          {confirming ? (
            <div className="card" role="group" aria-labelledby="subscription-confirm">
              <h3 id="subscription-confirm">{t("confirmTitle")}</h3>
              <p>{effectiveAt && effectiveAt > now ? t("confirmBody", { date: date(effectiveAt) }) : t("confirmBodyNow")}</p>
              <form action={cancelSubscriptionAction} className="inline-form">
                <button type="submit" className="danger">
                  {t("confirm")}
                </button>
                <Link href="/parametres/abonnement" className="button-link">
                  {t("keep")}
                </Link>
              </form>
            </div>
          ) : (
            <>
              <p>{t("cancelIntro")}</p>
              <Link href="/parametres/abonnement?resilier=1" className="button-link" scroll={false}>
                {t("cancel")}
              </Link>
            </>
          )}
        </section>
      ) : null}
    </main>
  );
}
