// Lot 48a (PRE-06 ; D4, ADR 0093) — ce que les contraintes du lieu disent du chrono : signalé, jamais
// bloquant, chaque fois avec la règle (« Le château demande la fin de la musique à 01:00 »). Sert le
// programme et le mode Jour J ; la capacité, la fiche de l'évènement.
import { getTranslations } from "next-intl/server";
import type { VenueCapacityFinding, VenueProgramFinding } from "@symbola/contracts";

const RULE_KEYS = ["music_end", "volume_down", "guests_departure", "vendor_access_start", "vendor_access_end"] as const;
type RuleKey = (typeof RULE_KEYS)[number];

function isRuleKey(value: string): value is RuleKey {
  return (RULE_KEYS as readonly string[]).includes(value);
}

export async function VenueFindings({ findings, labels, headingId }: { findings: VenueProgramFinding[]; labels: Map<string, string>; headingId: string }) {
  if (findings.length === 0) return null;
  const t = await getTranslations("VenueChecks");
  return (
    <section aria-labelledby={headingId}>
      <h3 id={headingId}>{t("title")}</h3>
      <ul className="venue-findings">
        {findings.map((finding) => (
          <li key={`${finding.itemId}-${finding.ruleKey}-${finding.vendorId}`}>
            {isRuleKey(finding.ruleKey)
              ? t(`rule.${finding.ruleKey}`, { venue: finding.venueName, time: finding.limit, item: labels.get(finding.itemId) ?? "" })
              : t("ruleOther", { venue: finding.venueName, item: labels.get(finding.itemId) ?? "" })}
          </li>
        ))}
      </ul>
      <p className="muted">{t("notBlocking")}</p>
    </section>
  );
}

export async function VenueCapacityNotice({ finding }: { finding: VenueCapacityFinding | null }) {
  if (!finding) return null;
  const t = await getTranslations("VenueChecks");
  return (
    <span className="venue-finding" role="status">
      {" "}
      {t(finding.ruleKey === "capacity_standing" ? "capacityStanding" : "capacitySeated", { venue: finding.venueName, limit: finding.limit, guests: finding.guests })}
    </span>
  );
}
