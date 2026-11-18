// Lot 53 (GC-02 ; D7 ; ADR 0095) — « Risques » dans « Aujourd'hui » : les alertes du radar, chacune avec
// sa règle expliquée et l'écran où agir. Radar coupé : la section le dit ; lent ou en panne : elle ne
// s'affiche pas, le reste de l'écran reste (ARC-07).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { RiskAlert } from "@symbola/contracts";
import { getAutomationGate } from "@/modules/hub/service";
import { loadRiskRadar } from "@/lib/risk-radar/load";
import { settleWithin } from "@/lib/today/settle";

export function riskParams(alert: RiskAlert): Record<string, string | number> {
  return { ...alert.facts, threshold: alert.thresholdDays };
}

export async function RiskSection({ organizationId, now }: { organizationId: string; now: Date }) {
  const t = await getTranslations("RiskRadar");
  const gate = await getAutomationGate(organizationId, "risk_radar").catch(() => null);
  if (!gate) return null;
  if (!gate.enabled) {
    return (
      <section className="card today-risks" aria-labelledby="today-risks-title">
        <h2 id="today-risks-title">{t("today.title")}</h2>
        <p>
          {t("today.off")} <Link href="/parametres/automatisations">{t("settings.title")}</Link>
        </p>
      </section>
    );
  }
  const radar = await settleWithin(() => loadRiskRadar(organizationId, now), undefined, "radar");
  if (!radar.ok) return null;
  return (
    <section className="card today-risks" aria-labelledby="today-risks-title">
      <h2 id="today-risks-title">{t("today.title")}</h2>
      <p className="field-hint">{t("today.intro")}</p>
      {radar.value.alerts.length === 0 ? (
        <p>{t("today.empty")}</p>
      ) : (
        <ul className="today-risk-list">
          {radar.value.alerts.map((alert) => (
            <li key={alert.key} className="today-item">
              <div className="today-item-body">
                <p className="today-item-title">{t(`rules.${alert.rule}.label`)}</p>
                <p>{t(`rules.${alert.rule}.alert`, riskParams(alert))}</p>
                {alert.eventNames ? <p className="today-item-meta">{alert.eventNames}</p> : null}
              </div>
              <div className="today-action">
                <Link href={alert.href} className="button-link" aria-label={t("today.openLabel", { label: alert.label })}>
                  {t("today.open")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
