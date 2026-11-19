// Lot 48b (PRE-07, JUR-10 ; D6, réponse 4 de l'avocat) — dans le portail du client, les commissions que
// sa planner perçoit des prestataires de l'évènement : toutes pour un particulier (sans case pour les
// masquer), celles choisies pour un professionnel.
import { getTranslations } from "next-intl/server";
import { formatAmount, type Locale } from "@symbola/i18n";
import { eventClientKind, listClientCommissions } from "@/modules/quotes/service";

export async function ClientCommissions({ organizationId, eventId, locale }: { organizationId: string; eventId: string; locale: Locale }) {
  const commissions = await listClientCommissions(organizationId, eventId, await eventClientKind(organizationId, eventId));
  if (commissions.length === 0) return null;
  const t = await getTranslations("PlannerMoney");
  return (
    <section aria-labelledby="client-commissions-title">
      <h2 id="client-commissions-title">{t("portalTitle")}</h2>
      <p>{t("portalIntro")}</p>
      <ul>
        {commissions.map((commission) => (
          <li key={commission.id}>
            {t("commissionLine", { vendor: commission.vendorName, amount: formatAmount(commission.amountCents, locale), nature: t(commission.nature === "referral" ? "natureReferral" : "natureCommission") })}
          </li>
        ))}
      </ul>
    </section>
  );
}
