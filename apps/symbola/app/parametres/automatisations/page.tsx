// Lot 53 (HUB-28 ; D5 ; ADR 0095) — « Automatisations » : une ligne par automatisme, avec ce qu'il fait,
// son interrupteur, son délai s'il en a un et son journal (quand, sur quoi, résultat). Un automatisme
// d'un module fermé est « indisponible » (ARC-06). La purge RGPD et le contrôle des pièces sont
// « toujours actifs », avec leur raison.
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ALWAYS_ON_AUTOMATIONS, SEND_TIME_AUTOMATIONS, type AutomationKey } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { getDefaultSendTime, isModuleEnabled, listAutomationGates, listAutomationRuns } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { toggleAutomationAction } from "./actions";
import { AutomationDaysForm } from "./days-form";
import { AutomationSendTimeForm, DefaultSendTimeForm } from "./send-time-form";

// Le module dont dépend chaque automatisme (ARC-06).
const AUTOMATION_MODULES: Record<AutomationKey, "quotes" | "events" | "guests"> = {
  quote_signed_confirm_event: "quotes",
  payment_due_reminder: "quotes",
  rsvp_reminder: "guests",
  client_task_reminder: "events",
  invoice_reminder: "quotes",
  proposal_expiry_reminder: "quotes",
  prospect_follow_up: "events",
  vendor_roadmap: "events",
  risk_radar: "events",
  // Lot 66b (JRJ-01) : le rappel du jour J.
  day_reminder: "events",
};

export default async function AutomationsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const isOwner = auth.user.role === "owner";
  const t = await getTranslations("Automations");
  const tHelp = await getTranslations("Help");
  const format = await getFormatter();
  const db = appDatabase();
  const [gates, defaultSendTime] = await Promise.all([listAutomationGates(organizationId), getDefaultSendTime(organizationId)]);
  const sendsAtTime = (key: AutomationKey) => (SEND_TIME_AUTOMATIONS as readonly string[]).includes(key);
  const modules = new Map<string, boolean>();
  for (const name of new Set(Object.values(AUTOMATION_MODULES))) modules.set(name, await isModuleEnabled(db, organizationId, name));
  const runs = new Map(await Promise.all(gates.map(async (gate) => [gate.key, await listAutomationRuns(organizationId, gate.key)] as const)));
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("automations.title")} body={tHelp("automations.body")} />
      <p>{t("intro")}</p>
      <p className="notice" role="note">
        {t("noCatchUp")}
      </p>
      {isOwner ? null : <p role="status">{t("ownerOnly")}</p>}
      {/* Lot 66a (D1 ; M17) : l'heure d'envoi par défaut, reprise par chaque automatisme sans la sienne. */}
      <section className="card stack" aria-labelledby="default-send-time-title">
        <h2 id="default-send-time-title">{t("defaultTimeTitle")}</h2>
        <p className="field-hint">{t("defaultTimeHint")}</p>
        <DefaultSendTimeForm time={defaultSendTime} disabled={!isOwner} />
      </section>
      <ul className="setting-list">
        {gates.map((gate) => {
          const title = t(`keys.${gate.key}.title`);
          const available = modules.get(AUTOMATION_MODULES[gate.key]) ?? false;
          const journal = runs.get(gate.key) ?? [];
          return (
            <li key={gate.key} className="setting-row" data-enabled={gate.enabled ? "true" : "false"}>
              <div className="setting-row-text">
                <div className="setting-row-head">
                  <h2>{title}</h2>
                  <span className={gate.enabled && available ? "badge badge-sauge" : available ? "badge" : "badge badge-wrap"}>{available ? (gate.enabled ? t("on") : t("off")) : t("unavailable")}</span>
                </div>
                <p>{t(`keys.${gate.key}.description`)}</p>
                {gate.resumedAt ? <p className="field-hint">{t("resumedAt", { date: when(gate.resumedAt.toISOString()) })}</p> : null}
              </div>
              <div className="setting-row-controls">
                {isOwner && available ? (
                  <form action={toggleAutomationAction}>
                    <input type="hidden" name="key" value={gate.key} />
                    <input type="hidden" name="enabled" value={gate.enabled ? "false" : "true"} />
                    <button type="submit" className={gate.enabled ? "button-secondary" : undefined} aria-label={t(gate.enabled ? "turnOffLabel" : "turnOnLabel", { title })}>
                      {t(gate.enabled ? "turnOff" : "turnOn")}
                    </button>
                  </form>
                ) : null}
                {gate.days !== null ? <AutomationDaysForm automationKey={gate.key} days={gate.days} disabled={!isOwner || !available} /> : null}
                {gate.key === "day_reminder" ? (
                  <Link href="/parametres/automatisations/rappel-jour-j" className="button-link button-secondary">
                    {t("dayReminderLink")}
                  </Link>
                ) : null}
                {sendsAtTime(gate.key) ? <AutomationSendTimeForm automationKey={gate.key} title={title} time={gate.sendTime} defaultTime={defaultSendTime} disabled={!isOwner || !available} /> : null}
              </div>
              <details className="setting-row-foot">
                <summary>{t("journal")}</summary>
                {journal.length === 0 ? (
                  <p>{t("journalEmpty")}</p>
                ) : (
                  <ul className="automation-journal">
                    {journal.map((run) => (
                      <li key={run.id}>
                        <span>{when(run.ranAt)}</span> · <span>{t(`result.${run.result}`)}</span>
                        {run.objectLabel ? <> · <span>{gate.key === "risk_radar" ? t("radarCount", { count: Number(run.objectLabel) }) : run.objectLabel}</span></> : null}
                        {run.href ? (
                          <>
                            {" "}
                            · <Link href={run.href}>{t("open")}</Link>
                          </>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </details>
            </li>
          );
        })}
      </ul>
      <h2>{t("alwaysOnTitle")}</h2>
      <ul className="setting-list">
        {ALWAYS_ON_AUTOMATIONS.map((key) => (
          <li key={key} className="setting-row">
            <div className="setting-row-text">
              <h3>{t(`alwaysOn.${key}.title`)}</h3>
              <p>{t(`alwaysOn.${key}.reason`)}</p>
            </div>
            <span className="badge badge-sauge">{t("alwaysOnBadge")}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}
