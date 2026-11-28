// Lot 53 (GC-02, CHR-05 ; D7 ; ADR 0095) — « Radar des risques » des Paramètres : chaque règle, ce qu'elle
// surveille, son seuil ; une règle dont le module ne donne pas encore les faits est « indisponible »
// (ARC-06, lot 48). Les seuils de la santé du planning se règlent ici aussi.
// Lot 74h (D7, G8, G10 ; A6 ; page 30) : au patron d'un écran de réglage. L'en-tête commun ; si le radar est
// coupé, il le dit en tête (« À vérifier : le radar est coupé depuis le 20 nov. ») avec « Remettre le radar
// en marche » en bouton secondaire (titulaire) ; chaque règle s'enregistre seule. Un membre lit tout, sans
// commande.
import { getFormatter, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { getPlanningHealthThresholds } from "@/modules/events/service";
import { getAutomationGate, isModuleEnabled } from "@/modules/hub/service";
import { loadRiskRadar } from "@/lib/risk-radar/load";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { SettingsHeader } from "@/app/ui/settings-header";
import { savedIndicatorLabels, settingsScopeLine } from "@/lib/settings/settings-header-texts";
import { resumeRiskRadarAction } from "./actions";
import { HealthThresholdsForm, RiskRuleForm } from "./radar-forms";

export default async function RiskRadarSettingsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const isOwner = auth.user.role === "owner";
  const t = await getTranslations("RiskRadar");
  const tMenu = await getTranslations("SettingsMenu");
  const tHelp = await getTranslations("Help");
  const tPattern = await getTranslations("SettingsPattern");
  const format = await getFormatter();
  const [radar, eventsOpen, gate, saved, scope] = await Promise.all([
    loadRiskRadar(organizationId),
    isModuleEnabled(appDatabase(), organizationId, "events"),
    getAutomationGate(organizationId, "risk_radar"),
    savedIndicatorLabels(),
    settingsScopeLine({ scope: "agency", editors: "owner", saving: "auto", isOwner }),
  ]);
  const health = eventsOpen ? await getPlanningHealthThresholds(organizationId) : null;
  // Le radar ne tourne qu'avec le module Évènements (ARC-06) : coupé, il le dit ; indisponible, la page des
  // automatismes le dit déjà.
  const paused = eventsOpen && !gate.enabled;
  const notice = paused ? (
    <div className="notice" role="note">
      <p>{gate.pausedAt ? tPattern("radar.pausedSince", { date: format.dateTime(gate.pausedAt, { day: "numeric", month: "short", timeZone: "Europe/Paris" }) }) : tPattern("radar.pausedNoDate")}</p>
      {isOwner ? (
        <form action={resumeRiskRadarAction}>
          <button type="submit" className="button-secondary">
            {tPattern("radar.resume")}
          </button>
        </form>
      ) : null}
    </div>
  ) : undefined;
  return (
    <main className="stack">
      <SettingsHeader title={tMenu("rubrics.riskRadar.label")} hint={tPattern("headers.riskRadar")} scope={scope} notice={notice} />
      <ScreenHelp title={tHelp("riskRadar.title")} body={tHelp("riskRadar.body")} />
      <ul className="setting-list">
        {radar.rules.map((rule) => {
          const label = t(`rules.${rule.rule}.label`);
          return (
            <li key={rule.rule} className="setting-row" id={`reglage-${rule.rule}`}>
              <div className="setting-row-text">
                <h2>{label}</h2>
                <p>{t(`rules.${rule.rule}.description`)}</p>
                {rule.available ? null : <p className="field-hint">{t("settings.unavailable")}</p>}
              </div>
              <RiskRuleForm rule={rule.rule} label={label} enabled={rule.enabled} thresholdDays={rule.thresholdDays} disabled={!isOwner || !rule.available} saved={saved} invalid={tPattern("radar.thresholdInvalid")} />
            </li>
          );
        })}
      </ul>
      {health ? (
        <section className="card" aria-labelledby="health-title">
          <h2 id="health-title">{t("health.title")}</h2>
          <p>{t("health.intro")}</p>
          <HealthThresholdsForm {...health} disabled={!isOwner} saved={saved} invalid={tPattern("radar.healthInvalid")} />
        </section>
      ) : null}
    </main>
  );
}
