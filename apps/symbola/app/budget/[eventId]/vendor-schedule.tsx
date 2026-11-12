// Lot 28b (BUD-03) — l'échéancier regroupé par prestataire : engagé, payé et
// reste, puis ses échéances dans l'ordre des dates. Les lignes sans prestataire
// (la robe payée en direct) ont leur groupe.
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, type Locale } from "@symbola/i18n";
import type { BudgetLinesView } from "@/modules/budget/service";

type Group = { key: string; title: string; committedCents: number; paidCents: number; payments: (BudgetLinesView["lines"][number]["payments"][number] & { lineLabel: string })[] };

export async function VendorSchedule({ view, locale }: { view: BudgetLinesView; locale: Locale }) {
  const t = await getTranslations("Budget");
  // Un groupe par prestataire (toutes ses lignes, D12), ou par ligne sans prestataire ;
  // seuls les groupes qui ont des échéances s'affichent.
  const keyOf = (line: BudgetLinesView["lines"][number]) => (line.vendorCandidateId ? `${line.eventVendorSlotId}:${line.vendorCandidateId}` : `ligne-${line.id}`);
  const withPayments = new Set(view.lines.filter((line) => line.payments.length > 0).map(keyOf));
  const groups = new Map<string, Group>();
  for (const line of view.lines) {
    const key = keyOf(line);
    if (!withPayments.has(key)) continue;
    const group = groups.get(key) ?? { key, title: line.vendorName ?? line.label, committedCents: 0, paidCents: 0, payments: [] };
    group.committedCents += line.committedAmountCents ?? 0;
    group.paidCents += line.paidAmountCents ?? 0;
    group.payments.push(...line.payments.map((payment) => ({ ...payment, lineLabel: line.label })));
    groups.set(key, group);
  }
  return (
    <section aria-labelledby="vendor-schedule-title" className="card">
      <h2 id="vendor-schedule-title">{t("scheduleTitle")}</h2>
      {groups.size === 0 ? <p>{t("scheduleEmpty")}</p> : null}
      {[...groups.values()].map((group) => (
        <section key={group.key} aria-label={group.title}>
          <h3>{group.title}</h3>
          <p className="meta">
            {t("scheduleTotals", {
              committed: formatAmount(group.committedCents, locale),
              paid: formatAmount(group.paidCents, locale),
              remaining: formatAmount(group.committedCents - group.paidCents, locale),
            })}
          </p>
          <ul>
            {[...group.payments]
              .sort((a, b) => a.dueOn.localeCompare(b.dueOn))
              .map((payment) => (
                <li key={payment.id}>
                  {payment.label} ({payment.lineLabel}) — {formatAmount(payment.amountCents, locale)} —{" "}
                  <span className={payment.status === "overdue" ? "text-overdue" : undefined}>
                    {payment.status === "paid"
                      ? t("paymentPaid", { date: formatCalendarDate(payment.paidOn!, locale) })
                      : t(payment.status === "overdue" ? "paymentOverdue" : "paymentDue", { date: formatCalendarDate(payment.dueOn, locale) })}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
