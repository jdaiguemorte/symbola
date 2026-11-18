import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { LinkBudgetView, LinkVendorPayment } from "@/modules/budget/service";
import type { PayerShareView } from "@symbola/contracts";
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
  share = null,
}: {
  view: LinkBudgetView;
  locale: Locale;
  methods: string[];
  today: string;
  preview?: boolean;
  // Lot 43 (BUD-06, D8) : un payeur à qui le client ne montre que sa part : elle seule, ligne par ligne.
  share?: PayerShareView | null;
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

  if (view.categories.length === 0 && view.scope !== "share") return <p>{tClient("noBudgetYet")}</p>;
  const upcoming = view.payments.filter((payment) => payment.status !== "paid");
  const paid = view.payments.filter((payment) => payment.status === "paid");
  const tPayers = await getTranslations("Payers");

  return (
    <>
      {view.scope === "share" ? (
        <section aria-labelledby="client-share-title" className="card payer-share">
          <h3 id="client-share-title">{tPayers("shareTitle")}</h3>
          <p className="meta">{tPayers("shareIntro")}</p>
          {share && share.lines.length > 0 ? (
            <ul>
              {share.lines.map((line) => (
                <li key={line.lineId}>
                  {[line.slotLabel, line.label].filter(Boolean).join(" — ")} : <strong>{formatAmount(line.amountCents, locale)}</strong>
                </li>
              ))}
            </ul>
          ) : (
            <p>{tPayers("shareEmpty")}</p>
          )}
          {share ? <p>{tPayers("shareTotal", { amount: formatAmount(share.totalCents, locale) })}</p> : null}
        </section>
      ) : view.scope === "selected" ? (
        <p>{t("budgetSelectedIntro")}</p>
      ) : (
        figures({
          planned: view.totalEstimatedCents,
          committed: view.totalCommittedCents,
          remaining: view.totalRemainingCents,
          ht: { planned: view.totalHt.estimatedCents, committed: view.totalHt.committedCents, remaining: view.totalHt.remainingCents },
        })
      )}
      <ul className="budget-cards" aria-label={t("budgetCategoriesTitle")} hidden={view.categories.length === 0}>
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
                    <span aria-hidden="true">{t("cancelDeclarationShort")}</span>
                    <span className="sr-only">{t("cancelDeclaration", { label: paymentTitle(payment) })}</span>
                  </button>
                </form>
              ) : null}
              {payment.status === "due" || payment.status === "overdue" ? (
                <details>
                  {/* Libellé visible court (le nom de l'échéance est juste au-dessus) ; nom complet pour les lecteurs d'écran. */}
                  <summary>
                    <span aria-hidden="true">{t("declarePaymentShort")}</span>
                    <span className="sr-only">{t("declarePayment", { label: paymentTitle(payment) })}</span>
                  </summary>
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
