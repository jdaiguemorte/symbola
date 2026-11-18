// Lot 41 (GC-03, D12) — panneau « Vérifications avant envoi » : des points d'attention qui ne
// bloquent pas (le blocage reste celui des mentions exigées, FAC-07). Chaque point dit le constat,
// pourquoi il compte, et mène au réglage ou au champ concerné ; la mention « ne remplace pas un
// conseil » est fixe, sous le panneau. Les points et leurs textes viennent des données.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { ComplianceDocument, ComplianceFinding } from "@/modules/quotes/service";

export async function CompliancePanel({ document, findings, disclaimer }: { document: ComplianceDocument; findings: ComplianceFinding[]; disclaimer: string }) {
  const t = await getTranslations("Compliance");
  const titleId = `compliance-${document}-title`;
  return (
    <section aria-labelledby={titleId} className="compliance-panel">
      <h3 id={titleId}>{t("title")}</h3>
      {findings.length === 0 ? (
        <p>{t("nothing")}</p>
      ) : (
        <>
          <p>{t("intro", { count: findings.length })}</p>
          <ul>
            {findings.map((finding) => (
              <li key={finding.key}>
                <strong>{finding.title}</strong>
                <br />
                {finding.why}{" "}
                {finding.target.startsWith("#") ? <a href={finding.target}>{t("goTo")}</a> : <Link href={finding.target}>{t("goTo")}</Link>}
              </li>
            ))}
          </ul>
        </>
      )}
      <p className="meta">{disclaimer}</p>
    </section>
  );
}
