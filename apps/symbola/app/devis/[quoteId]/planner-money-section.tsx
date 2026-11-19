// Lot 48b (BUD-08, PRE-07, JUR-10 ; D6, D7 ; ADR 0093) — sur le devis : prestations facturées par les
// prestataires (mode intermédiaire, pour information, hors du total), commissions que voit le client
// (toutes pour un particulier), honoraires réglés à ajouter au devis, alerte du forfait touristique et
// alerte à l'approche du seuil de franchise. Tout se signale ; seul le forfait touristique bloque le
// contrat standard (au moment de le générer).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import type { QuoteDetail } from "@/modules/quotes/service";
import { getPlannerFeeTerms, listClientCommissions, quoteFranchiseAlert, quotePackageTravel, splitBySupplyMode } from "@/modules/quotes/service";
import { plannerFeeAmount } from "@/lib/money/planner-fees";
import { addPlannerFeeLineAction } from "./money-actions";

export async function PlannerMoneySection({ organizationId, quote, locale }: { organizationId: string; quote: QuoteDetail; locale: Locale }) {
  const t = await getTranslations("PlannerMoney");
  const current = quote.current;
  const split = splitBySupplyMode(current.lines);
  const [packageTravel, franchise, commissions, terms] = await Promise.all([
    quotePackageTravel(organizationId, quote.id),
    quoteFranchiseAlert(organizationId, quote.id),
    listClientCommissions(organizationId, quote.eventId, quote.clientKind),
    getPlannerFeeTerms(organizationId, quote.eventId),
  ]);
  const fee = terms ? await plannerFeeAmount(organizationId, quote.eventId, terms) : null;
  const isDraft = current.sentAt === null;
  return (
    <section id="argent" aria-labelledby="planner-money-title">
      <h2 id="planner-money-title">{t("quoteTitle")}</h2>
      {packageTravel ? (
        <div className="bank-check-banner" role="alert">
          <p>
            <strong>{t("packageTravelTitle")}</strong>
          </p>
          <p>{t("packageTravelBody")}</p>
        </div>
      ) : null}
      {franchise.alert !== "none" && franchise.thresholdCents !== null ? (
        <p className="venue-finding" role="status">
          {t(franchise.alert === "exceeded" ? "franchiseExceeded" : "franchiseApproaching", {
            total: formatAmount(franchise.yearCents + franchise.quoteCents, locale),
            threshold: formatAmount(franchise.thresholdCents, locale),
          })}
        </p>
      ) : null}
      <dl className="vendor-summary">
        <div>
          <dt>{t("resaleTotal")}</dt>
          <dd>{formatAmount(split.resaleNetCents, locale)}</dd>
        </div>
        <div>
          <dt>{t("intermediaryTotal")}</dt>
          <dd>{formatAmount(split.intermediaryNetCents, locale)}</dd>
        </div>
      </dl>
      <p className="muted">{t("modesHint")}</p>
      <h3>{t("commissionsTitle")}</h3>
      {commissions.length === 0 ? (
        <p>{t("commissionsNone")}</p>
      ) : (
        <ul>
          {commissions.map((commission) => (
            <li key={commission.id}>
              {t("commissionLine", { vendor: commission.vendorName, amount: formatAmount(commission.amountCents, locale), nature: t(commission.nature === "referral" ? "natureReferral" : "natureCommission") })}
            </li>
          ))}
        </ul>
      )}
      <p className="muted">{quote.clientKind === "professional" ? t("commissionsProfessional") : t("commissionsIndividual")}</p>
      <p>
        <Link href={`/devis/argent/${quote.eventId}`}>{t("manageLink")}</Link>
      </p>
      {terms && fee !== null && isDraft ? (
        <form action={addPlannerFeeLineAction}>
          <input type="hidden" name="quoteId" value={quote.id} />
          <button type="submit">{t("addFeeLine", { amount: formatAmount(fee, locale) })}</button>
        </form>
      ) : null}
    </section>
  );
}
