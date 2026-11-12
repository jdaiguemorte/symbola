import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { LinkBudgetView, LinkVendorPayment } from "@/modules/budget/service";
import { cancelPaymentDeclarationAction } from "./actions";
import { PaymentDeclarationForm } from "./payment-declaration-form";

// PRD-BUD-04, lot 27a (POR-05, BUD-07, décision D5) — budget de l'événement vu
// par un lien personnel, en trois chiffres : prévu, engagé, reste à payer. En
// budget entier, les trois totaux, puis une carte par catégorie ; en
// « catégories choisies » (payeur), ses seules cartes, sans total général
// (lot 26a). Ni lignes ni écart : le détail reste à la planner (ADR 0054).
// Lot 28c (BUD-09) : HT sous le TTC pour un client professionnel. Puis les
// échéances de ses catégories, et « Je l'ai réglée » (SC-06 étape 5, D6).
export async function ClientBudget({
  view,
  locale,
  methods,
  today,
  preview = false,
}: {
  view: LinkBudgetView;
  locale: Locale;
  methods: string[];
  today: string;
  preview?: boolean;
}) {
  const t = await getTranslations("LinkPortal");
  const tBudget = await getTranslations("Budget");
  const tClient = await getTranslations("ClientSpace");
  const professional = view.clientKind === "professional";
  const figures = (amounts: { planned: number; committed: number; remaining: number; ht?: { planned: number | null; committed: number | null; remaining: number | null } }) => (
    <dl className="budget-figures">
      {(
        [
          ["planned", t("plannedLabel"), amounts.planned, amounts.ht?.planned],
          ["committed", t("committedLabel"), amounts.committed, amounts.ht?.committed],
          ["remaining", t("remainingLabel"), Math.max(0, amounts.remaining), amounts.ht?.remaining],
        ] as const
      ).map(([key, label, cents, htCents]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd>
            {formatAmount(cents, locale)}
            {professional && htCents !== undefined && htCents !== null ? <span className="budget-ht">{tBudget("htAmount", { amount: formatAmount(htCents, locale) })}</span> : null}
          </dd>
        </div>
      ))}
    </dl>
  );

  if (view.categories.length === 0) return <p>{tClient("noBudgetYet")}</p>;
  const upcoming = view.payments.filter((payment) => payment.status !== "paid");
  const paid = view.payments.filter((payment) => payment.status === "paid");

  return (
    <>
      {view.scope === "selected" ? (
        <p>{t("budgetSelectedIntro")}</p>
      ) : (
        figures({
          planned: view.totalEstimatedCents,
          committed: view.totalCommittedCents,
          remaining: view.totalRemainingCents,
          ht: { planned: view.totalHt.estimatedCents, committed: view.totalHt.committedCents, remaining: view.totalHt.remainingCents },
        })
      )}
      <ul className="budget-cards" aria-label={t("budgetCategoriesTitle")}>
        {view.categories.map((category) => (
          <li key={category.eventVendorSlotId} className="card">
            <h3>{category.label}</h3>
            {figures({
              planned: category.estimatedCents,
              committed: category.committedCents,
              remaining: category.remainingCents,
              ht: { planned: category.ht.estimatedCents, committed: category.ht.committedCents, remaining: category.ht.remainingCents },
            })}
          </li>
        ))}
      </ul>

      <section aria-labelledby="client-payments-title" id="echeances">
        <h3 id="client-payments-title">{t("paymentsTitle")}</h3>
        {upcoming.length === 0 ? <p>{t("noPayments")}</p> : null}
        <ul className="item-list">
          {upcoming.map((payment) => (
            <li key={payment.id}>
              <p>
                <strong>{paymentTitle(payment)}</strong> — {formatAmount(payment.amountCents, locale)}
              </p>
              <p className={payment.status === "overdue" ? "text-overdue" : "muted"}>
                {payment.status === "declared"
                  ? t("paymentDeclared", { date: formatCalendarDate(payment.declaredPaidOn!, locale), method: payment.declaredMethod ?? "" })
                  : payment.status === "overdue"
                    ? t("paymentOverdue", { date: formatCalendarDate(payment.dueOn, locale) })
                    : t("paymentDue", { date: formatCalendarDate(payment.dueOn, locale) })}
              </p>
              {payment.refusalReason ? <p className="badge-warning">{t("paymentRefused", { reason: payment.refusalReason })}</p> : null}
              {payment.status === "declared" && payment.declaredByThisLink ? (
                <form action={preview ? undefined : cancelPaymentDeclarationAction}>
                  <input type="hidden" name="paymentId" value={payment.id} />
                  <button type="submit" disabled={preview}>
                    {t("cancelDeclaration", { label: paymentTitle(payment) })}
                  </button>
                </form>
              ) : null}
              {payment.status === "due" || payment.status === "overdue" ? (
                <details>
                  <summary>{t("declarePayment", { label: paymentTitle(payment) })}</summary>
                  <PaymentDeclarationForm paymentId={payment.id} label={paymentTitle(payment)} methods={methods} today={today} preview={preview} />
                </details>
              ) : null}
            </li>
          ))}
        </ul>
        {paid.length > 0 ? (
          <details>
            <summary>{t("paidPaymentsTitle", { count: paid.length })}</summary>
            <ul>
              {paid.map((payment) => (
                <li key={payment.id}>
                  {paymentTitle(payment)} — {formatAmount(payment.amountCents, locale)} — {t("paymentPaid", { date: formatCalendarDate(payment.paidOn!, locale) })}
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>
    </>
  );
}

// « Traiteur — Maison Haddad — Acompte » : le poste, le prestataire s'il y en a un, l'échéance.
function paymentTitle(payment: LinkVendorPayment): string {
  return [payment.slotLabel, payment.vendorName, payment.label].filter(Boolean).join(" — ");
}
