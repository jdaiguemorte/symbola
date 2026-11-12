// Lot 28b (BUD-03) — l'échéancier regroupé par prestataire : engagé, payé et
// reste, puis ses échéances dans l'ordre des dates. Les lignes sans prestataire
// (la robe payée en direct) ont leur groupe.
import { getTranslations } from "next-intl/server";
import { formatAmount, formatCalendarDate, formatDateTime, type Locale } from "@symbola/i18n";
import type { BudgetLinesView } from "@/modules/budget/service";
import { getLinkNamesByIds } from "@/modules/events/service";
import { confirmPaymentDeclarationAction } from "./actions";
import { DeclarationRefusalForm } from "./declaration-refusal-form";

type Group = { key: string; title: string; committedCents: number; paidCents: number; payments: (BudgetLinesView["lines"][number]["payments"][number] & { lineLabel: string })[] };

// Lot 27a (SC-06 étape 5, D6) : un règlement déclaré par un client se confirme
// (payé à la date déclarée) ou se refuse, avec un motif montré au client.
export async function VendorSchedule({ view, locale, organizationId }: { view: BudgetLinesView; locale: Locale; organizationId: string }) {
  const t = await getTranslations("Budget");
  const declarerIds = [...new Set(view.lines.flatMap((line) => line.payments.flatMap((payment) => (payment.declaration ? [payment.declaration.linkId] : []))))];
  const declarers = declarerIds.length > 0 ? await getLinkNamesByIds(organizationId, declarerIds) : {};
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
                  {payment.declaration ? (
                    <p className={payment.status === "paid" ? "meta" : "badge-warning"}>
                      {t(payment.status === "paid" ? "declarationConfirmed" : "declarationPending", {
                        name: declarers[payment.declaration.linkId] ?? t("declarationSomeone"),
                        date: formatCalendarDate(payment.declaration.paidOn, locale),
                        method: payment.declaration.method,
                        at: formatDateTime(new Date(payment.declaration.declaredAt), locale),
                      })}
                    </p>
                  ) : null}
                  {payment.declaration && payment.status !== "paid" ? (
                    <div className="link-actions">
                      <form action={confirmPaymentDeclarationAction}>
                        <input type="hidden" name="eventId" value={view.eventId} />
                        <input type="hidden" name="paymentId" value={payment.id} />
                        <button type="submit" className="primary">
                          {t("confirmDeclaration", { label: payment.label })}
                        </button>
                      </form>
                      <details>
                        <summary>{t("refuseDeclarationOpen", { label: payment.label })}</summary>
                        <DeclarationRefusalForm eventId={view.eventId} paymentId={payment.id} label={payment.label} />
                      </details>
                    </div>
                  ) : null}
                  {!payment.declaration && payment.refusalReason && payment.status !== "paid" ? <p className="meta">{t("declarationRefusedNote", { reason: payment.refusalReason })}</p> : null}
                </li>
              ))}
          </ul>
        </section>
      ))}
    </section>
  );
}
