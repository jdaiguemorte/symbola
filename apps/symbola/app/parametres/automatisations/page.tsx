// Lot 53 (HUB-28 ; D5 ; ADR 0095) — « Automatisations » : une ligne par automatisme, avec ce qu'il fait,
// son interrupteur, son délai s'il en a un et son journal (quand, sur quoi, résultat). Un automatisme
// d'un module fermé est « indisponible » (ARC-06). La purge RGPD et le contrôle des pièces sont
// « toujours actifs », avec leur raison.
// Lot 74h (D7, G8, G10 ; page 30) : au patron d'un écran de réglage. L'en-tête commun ; chaque automatisme a
// son état en mots (« En marche », « Coupé », point plein ou vide, sans vert), son interrupteur (titulaire
// seulement, enregistré seul), son heure et son journal ; coupé, il dit depuis quand et par qui (0246), et
// le radar dit ce que cela change. Un membre lit la liste et les états, sans aucune commande.
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ALWAYS_ON_AUTOMATIONS, SEND_TIME_AUTOMATIONS, type AutomationKey } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { getDefaultSendTime, isModuleEnabled, listAutomationGates, listAutomationRuns, teamMemberFirstName } from "@/modules/hub/service";
import { SettingsHeader } from "@/app/ui/settings-header";
import { savedIndicatorLabels, settingsScopeLine } from "@/lib/settings/settings-header-texts";
import { AutomationRunningSwitch } from "./running-switch";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
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
  const tMenu = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  const format = await getFormatter();
  const db = appDatabase();
  const [gates, defaultSendTime] = await Promise.all([listAutomationGates(organizationId), getDefaultSendTime(organizationId)]);
  const sendsAtTime = (key: AutomationKey) => (SEND_TIME_AUTOMATIONS as readonly string[]).includes(key);
  const modules = new Map<string, boolean>();
  for (const name of new Set(Object.values(AUTOMATION_MODULES))) modules.set(name, await isModuleEnabled(db, organizationId, name));
  const runs = new Map(await Promise.all(gates.map(async (gate) => [gate.key, await listAutomationRuns(organizationId, gate.key)] as const)));
  const when = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Paris" });
  const day = (date: Date) => format.dateTime(date, { day: "numeric", month: "long", timeZone: "Europe/Paris" });
  const [tPattern, saved, scope] = await Promise.all([getTranslations("SettingsPattern"), savedIndicatorLabels(), settingsScopeLine({ scope: "agency", editors: "owner", saving: "auto", isOwner })]);
  // « Coupé le 20 nov. par Camille. » : la date et la personne de la coupure (0246) ; sans elles, « Coupé. »
  const pausedWords = async (gate: (typeof gates)[number]) => {
    if (!gate.pausedAt) return tPattern("automations.paused");
    const name = await teamMemberFirstName(db, organizationId, gate.pausedBy);
    return name ? tPattern("automations.pausedBy", { date: day(gate.pausedAt), name }) : tPattern("automations.pausedOn", { date: day(gate.pausedAt) });
  };
  const paused = new Map(await Promise.all(gates.filter((gate) => !gate.enabled).map(async (gate) => [gate.key, await pausedWords(gate)] as const)));
  return (
    <main className="stack">
      <SettingsHeader title={tMenu("rubrics.automations.label")} hint={tPattern("headers.automations")} scope={scope} />
      <ScreenHelp title={tHelp("automations.title")} body={tHelp("automations.body")} />
      {/* Lot 66a (D1 ; M17) : l'heure d'envoi par défaut, reprise par chaque automatisme sans la sienne. */}
      <section className="card" aria-labelledby="default-send-time-title">
        <div className="setting-line">
          <div className="setting-line-text">
            <h2 id="default-send-time-title">{t("defaultTimeTitle")}</h2>
            <p>{t("defaultTimeHint")}</p>
          </div>
          <DefaultSendTimeForm time={defaultSendTime} disabled={!isOwner} saved={saved} />
        </div>
      </section>
      <ul className="setting-list">
        {gates.map((gate) => {
          const title = t(`keys.${gate.key}.title`);
          const available = modules.get(AUTOMATION_MODULES[gate.key]) ?? false;
          const journal = runs.get(gate.key) ?? [];
          const running = gate.enabled && available;
          return (
            <li key={gate.key} className="setting-row" data-enabled={gate.enabled ? "true" : "false"} id={`automatisme-${gate.key}`}>
              <div className="setting-row-text">
                <div className="setting-row-head">
                  <h2>{title}</h2>
                  {available ? (
                    <span className="setting-state" data-on={gate.enabled ? "true" : "false"}>
                      {gate.enabled ? tPattern("automations.on") : tPattern("automations.off")}
                    </span>
                  ) : (
                    <span className="badge badge-wrap">{tPattern("automations.unavailable")}</span>
                  )}
                </div>
                <p>{t(`keys.${gate.key}.description`)}</p>
                {available && !gate.enabled ? (
                  <p>
                    {paused.get(gate.key)}
                    {gate.key === "risk_radar" ? <> {tPattern("automations.radarConsequence")}</> : null}
                  </p>
                ) : null}
                {running && gate.resumedAt ? <p className="field-hint">{t("resumedAt", { date: when(gate.resumedAt.toISOString()) })}</p> : null}
              </div>
              <div className="setting-row-controls">
                {isOwner && available ? <AutomationRunningSwitch automationKey={gate.key} label={tPattern("automations.toggle", { title })} enabled={gate.enabled} saved={saved} /> : null}
                {gate.days !== null ? <AutomationDaysForm automationKey={gate.key} title={title} days={gate.days} disabled={!isOwner || !available} saved={saved} /> : null}
                {sendsAtTime(gate.key) ? <AutomationSendTimeForm automationKey={gate.key} title={title} time={gate.sendTime} defaultTime={defaultSendTime} disabled={!isOwner || !available} saved={saved} /> : null}
                {gate.key === "day_reminder" ? <Link href="/parametres/automatisations/rappel-jour-j">{t("dayReminderLink")}</Link> : null}
                {gate.key === "risk_radar" ? <Link href="/parametres/radar">{tPattern("automations.rulesLink")}</Link> : null}
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
