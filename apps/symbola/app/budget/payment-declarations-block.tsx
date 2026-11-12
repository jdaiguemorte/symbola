// Lot 27a (SC-06 étape 5, décision D6) — sur l'accueil, les règlements
// d'échéances déclarés par un client et que la planner n'a pas encore confirmés ;
// chaque ligne mène à l'échéancier de l'événement. Rien quand il n'y en a pas.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import { listPendingPaymentDeclarations } from "@/modules/budget/service";
import { getEventNamesByIds, getLinkNamesByIds } from "@/modules/events/service";

export async function PaymentDeclarationsBlock({ organizationId }: { organizationId: string }) {
  const declarations = await listPendingPaymentDeclarations(organizationId);
  if (declarations.length === 0) return null;
  const t = await getTranslations("Budget");
  const locale = (await getLocale()) as Locale;
  const [events, people] = await Promise.all([
    getEventNamesByIds(organizationId, [...new Set(declarations.map((declaration) => declaration.eventId))]),
    getLinkNamesByIds(organizationId, [...new Set(declarations.map((declaration) => declaration.declaredByLinkId))]),
  ]);
  return (
    <section className="notice" aria-labelledby="payment-declarations-title">
      <h2 id="payment-declarations-title">{t("declarationsTitle")}</h2>
      <ul>
        {declarations.map((declaration) => (
          <li key={declaration.paymentId}>
            <Link href={`/budget/${declaration.eventId}#vendor-schedule-title`}>
              {t("declarationLine", {
                name: people[declaration.declaredByLinkId] ?? t("declarationSomeone"),
                label: [declaration.vendorName, declaration.label].filter(Boolean).join(" — "),
                amount: formatAmount(declaration.amountCents, locale),
                event: events[declaration.eventId] ?? "",
              })}
            </Link>{" "}
            <span className="meta">{t("declarationLineMeta", { date: formatCalendarDate(declaration.declaredPaidOn, locale), method: declaration.declaredMethod })}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
