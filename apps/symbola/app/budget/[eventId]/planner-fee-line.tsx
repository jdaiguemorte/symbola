// Lot 48b (BUD-08 ; D6, ADR 0093) — les honoraires de la planner, une ligne à part du budget : jamais
// dans un total de catégorie ni dans les dépenses de l'évènement, jamais confondus avec un prestataire.
// Sans le module des devis (où ils se règlent) : rien (ARC-06).
import { getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import { getPlannerFeeTerms } from "@/modules/quotes/service";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";
import { plannerFeeAmount } from "@/lib/money/planner-fees";

export async function PlannerFeeLine({ organizationId, eventId, locale }: { organizationId: string; eventId: string; locale: Locale }) {
  if (!(await isQuotesModuleEnabled(organizationId))) return null;
  const terms = await getPlannerFeeTerms(organizationId, eventId);
  if (!terms) return null;
  const t = await getTranslations("PlannerMoney");
  const amount = await plannerFeeAmount(organizationId, eventId, terms);
  return (
    <section className="card" aria-labelledby="planner-fee-title">
      <h2 id="planner-fee-title">{t("budgetFeeTitle")}</h2>
      <p>
        <strong>{formatAmount(amount, locale)}</strong> {t("budgetFeeHt")}
      </p>
      <p className="muted">{t("budgetFeeHint")}</p>
    </section>
  );
}
