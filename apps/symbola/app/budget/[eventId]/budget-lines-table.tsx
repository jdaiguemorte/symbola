"use client";

// Lot 28a (BUD-01, ADR 0054) — cinq montants par ligne : estimé, devisé, engagé,
// payé, reste à payer (calculé), et l'écart engagé − estimé (PRD-BUD-02). Une
// ligne se complète en un seul envoi ; ses devis joints restent sous la ligne
// (PRD-BUD-03). En 375 px, une carte par ligne (globals.css, .budget-lines).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { formatAmount, formatAmountInput, formatFileSize, type Locale } from "@symbola/i18n";
import { BUDGET_AMOUNT_FIELDS, type BudgetAmountField } from "@symbola/contracts";
import { confirmEventBudgetAction, updateBudgetLineAction, type BudgetFormState } from "./actions";
import { useUploadAction } from "@/app/ui/use-upload";
import { varianceDisplay } from "@/app/budget/variance-display";
import type { BudgetLinesView } from "@/modules/budget/service";

type Line = BudgetLinesView["lines"][number];

const AMOUNT_OF: Record<BudgetAmountField, (line: Line) => number | null> = {
  estimated: (line) => line.estimatedAmountCents,
  quoted: (line) => line.quotedAmountCents,
  committed: (line) => line.committedAmountCents,
  paid: (line) => line.paidAmountCents,
};

function LineRow({ eventId, line, locale }: { eventId: string; line: Line; locale: Locale }) {
  const t = useTranslations("Budget");
  const initialState: BudgetFormState = {};
  const [state, amountsAction, pending] = useActionState(updateBudgetLineAction, initialState);
  const [quoteState, quoteAction, quotePending] = useUploadAction<BudgetFormState>(`/budget/${eventId}/devis`);
  const shown = (cents: number | null) => (cents === null ? t("notSet") : formatAmount(cents, locale));
  const variance = varianceDisplay(line.varianceCents);

  return (
    <tr>
      <th scope="row">{line.label}</th>
      {BUDGET_AMOUNT_FIELDS.map((field) => (
        <td key={field} className="num" data-label={t(`amounts.${field}`)}>
          {shown(AMOUNT_OF[field](line))}
        </td>
      ))}
      <td className={line.remainingAmountCents !== null && line.remainingAmountCents < 0 ? "num text-overdue" : "num"} data-label={t("amounts.remaining")}>
        {shown(line.remainingAmountCents)}
      </td>
      <td className={variance.className} data-label={t("variance")}>
        {t(variance.labelKey, { amount: variance.amountCents === null ? "" : formatAmount(variance.amountCents, locale) })}
      </td>
      <td className="budget-line-edit">
        {/* PRD-BUD-03 : devis prestataires joints, servis après contrôle des droits, en un clic. */}
        {line.attachments.length > 0 ? (
          <ul aria-label={t("quotesOf", { label: line.label })}>
            {line.attachments.map((attachment, index) => (
              <li key={attachment.id}>
                <a href={`/budget/${eventId}/devis/${attachment.id}`} target="_blank" rel="noopener noreferrer">
                  {t("openQuote", { number: index + 1, label: line.label, size: formatFileSize(attachment.sizeBytes, locale) })}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
        <details>
          {/* « Modifier » visible ; le nom de la ligne pour les lecteurs d'écran. */}
          <summary>
            {t("edit")}
            <span className="sr-only"> {t("editLineName", { label: line.label })}</span>
          </summary>
          <form action={amountsAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="eventVendorSlotId" value={line.eventVendorSlotId} />
            {BUDGET_AMOUNT_FIELDS.map((field) => (
              <label key={field}>
                {t(`amounts.${field}`)} — {line.label}
                <input type="hidden" name={`current_${field}`} value={AMOUNT_OF[field](line) ?? ""} />
                <input type="text" inputMode="decimal" name={`amount_${field}`} defaultValue={formatAmountInput(AMOUNT_OF[field](line), locale)} />
              </label>
            ))}
            <button type="submit" disabled={pending}>
              {t("saveLine")}
            </button>
            {state.error ? <p role="alert">{state.error}</p> : null}
            {state.success ? <p role="status">{t("lineSaved")}</p> : null}
          </form>
          <form action={quoteAction}>
            <input type="hidden" name="eventId" value={eventId} />
            <input type="hidden" name="eventVendorSlotId" value={line.eventVendorSlotId} />
            <label>
              {t("quoteFile", { label: line.label })}
              <input type="file" name="quote" accept="application/pdf,image/*" required />
            </label>
            <button type="submit" disabled={quotePending}>
              {t("attachQuote")}
            </button>
            {quoteState.error ? <p role="alert">{quoteState.error}</p> : null}
            {quoteState.success ? <p role="status">{t("quoteAttached")}</p> : null}
          </form>
        </details>
      </td>
    </tr>
  );
}

export function BudgetLinesTable({
  eventId,
  view,
  canConfirm,
  locale,
}: {
  eventId: string;
  view: BudgetLinesView | null;
  canConfirm: boolean;
  locale: Locale;
}) {
  const t = useTranslations("Budget");

  if (!view || view.lines.length === 0) {
    if (!canConfirm) return null;
    return (
      <form action={confirmEventBudgetAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <button type="submit">{t("confirmAsPlanned")}</button>
      </form>
    );
  }

  return (
    <div className="list-table-wrap" role="region" aria-labelledby="budget-lines-caption" tabIndex={0}>
      <table className="list-table budget-lines">
        <caption id="budget-lines-caption">{t("linesTitle")}</caption>
        <thead>
          <tr>
            <th scope="col">{t("vendorSlot")}</th>
            {BUDGET_AMOUNT_FIELDS.map((field) => (
              <th key={field} scope="col" className="num">
                {t(`amounts.${field}`)}
              </th>
            ))}
            <th scope="col" className="num">
              {t("amounts.remaining")}
            </th>
            <th scope="col">{t("variance")}</th>
            <th scope="col">{t("adjust")}</th>
          </tr>
        </thead>
        <tbody>
          {view.lines.map((line) => (
            <LineRow key={line.eventVendorSlotId} eventId={eventId} line={line} locale={locale} />
          ))}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row">{t("total")}</th>
            <td className="num" data-label={t("amounts.estimated")}>{formatAmount(view.totalEstimatedCents, locale)}</td>
            <td className="num" data-label={t("amounts.quoted")}>{formatAmount(view.totalQuotedCents, locale)}</td>
            <td className="num" data-label={t("amounts.committed")}>{formatAmount(view.totalCommittedCents, locale)}</td>
            <td className="num" data-label={t("amounts.paid")}>{formatAmount(view.totalPaidCents, locale)}</td>
            <td className="num" data-label={t("amounts.remaining")}>{formatAmount(view.totalRemainingCents, locale)}</td>
            <td className="num" data-label={t("variance")}>{formatAmount(view.totalVarianceCents, locale)}</td>
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
