// Lot 53 (GC-02, CHR-05 ; D7 ; ADR 0095) — « Radar des risques » des Paramètres : chaque règle, ce qu'elle
// surveille, son seuil ; une règle dont le module ne donne pas encore les faits est « indisponible »
// (ARC-06, lot 48). Les seuils de la santé du planning se règlent ici aussi.
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { getPlanningHealthThresholds } from "@/modules/events/service";
import { isModuleEnabled } from "@/modules/hub/service";
import { loadRiskRadar } from "@/lib/risk-radar/load";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { HealthThresholdsForm, RiskRuleForm } from "./radar-forms";

export default async function RiskRadarSettingsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const isOwner = auth.user.role === "owner";
  const t = await getTranslations("RiskRadar");
  const tHelp = await getTranslations("Help");
  const radar = await loadRiskRadar(organizationId);
  const eventsOpen = await isModuleEnabled(appDatabase(), organizationId, "events");
  const health = eventsOpen ? await getPlanningHealthThresholds(organizationId) : null;
  return (
    <main>
      <h1>{t("settings.title")}</h1>
      <ScreenHelp title={tHelp("riskRadar.title")} body={tHelp("riskRadar.body")} />
      <p>{t("settings.intro")}</p>
      {isOwner ? null : <p role="status">{t("settings.ownerOnly")}</p>}
      <ul className="automation-list">
        {radar.rules.map((rule) => {
          const label = t(`rules.${rule.rule}.label`);
          return (
            <li key={rule.rule} className="card automation-item">
              <h2>{label}</h2>
              <p>{t(`rules.${rule.rule}.description`)}</p>
              {rule.available ? null : <p className="field-hint">{t("settings.unavailable")}</p>}
              <RiskRuleForm rule={rule.rule} label={label} enabled={rule.enabled} thresholdDays={rule.thresholdDays} disabled={!isOwner || !rule.available} />
            </li>
          );
        })}
      </ul>
      {health ? (
        <section className="card" aria-labelledby="health-title">
          <h2 id="health-title">{t("health.title")}</h2>
          <p>{t("health.intro")}</p>
          <HealthThresholdsForm {...health} disabled={!isOwner} />
        </section>
      ) : null}
    </main>
  );
}
