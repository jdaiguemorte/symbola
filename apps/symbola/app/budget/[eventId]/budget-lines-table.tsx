"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { formatAmount, formatFileSize, type Locale } from "@symbola/i18n";
import { attachQuoteAction, confirmEventBudgetAction, updateBudgetLineAction, type BudgetFormState } from "./actions";
import type { BudgetLinesView } from "@/modules/budget/service";
import { varianceDisplay } from "../variance-display";

function LineRow({
  eventId,
  line,
  locale,
}: {
  eventId: string;
  line: BudgetLinesView["lines"][number];
  locale: Locale;
}) {
  const t = useTranslations("Budget");
  const initialState: BudgetFormState = {};
  const [plannedState, plannedAction, plannedPending] = useActionState(updateBudgetLineAction, initialState);
  const [actualState, actualAction, actualPending] = useActionState(updateBudgetLineAction, initialState);
  const [quoteState, quoteAction, quotePending] = useActionState(attachQuoteAction, initialState);

  const variance = varianceDisplay(line.varianceCents);
  const varianceLabel = t(variance.labelKey, {
    amount: variance.amountCents === null ? "" : formatAmount(variance.amountCents, locale),
  });
  const varianceColor = variance.color;

  return (
    <tr>
      <th scope="row">{line.label}</th>
      <td>{formatAmount(line.plannedAmountCents, locale)}</td>
      <td>{line.actualAmountCents === null ? t("notSet") : formatAmount(line.actualAmountCents, locale)}</td>
      <td style={varianceColor ? { color: varianceColor } : undefined}>
        {varianceLabel}
        {line.variancePercent !== null ? ` (${line.variancePercent > 0 ? "+" : ""}${line.variancePercent} %)` : ""}
      </td>
      <td>
        <form action={plannedAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="eventVendorSlotId" value={line.eventVendorSlotId} />
          <input type="hidden" name="field" value="planned" />
          <label>
            {t("planned")} — {line.label}
            <input type="number" name="amount" min={0} step={0.01} defaultValue={line.plannedAmountCents / 100} />
          </label>
          <button type="submit" disabled={plannedPending}>
            {t("updatePlanned")}
          </button>
          {plannedState.error ? <p role="alert">{plannedState.error}</p> : null}
        </form>
        <form action={actualAction}>
          <input type="hidden" name="eventId" value={eventId} />
          <input type="hidden" name="eventVendorSlotId" value={line.eventVendorSlotId} />
          <input type="hidden" name="field" value="actual" />
          <label>
            {t("actual")} — {line.label}
            <input
              type="number"
              name="amount"
              min={0}
              step={0.01}
              defaultValue={line.actualAmountCents === null ? "" : line.actualAmountCents / 100}
            />
          </label>
          <button type="submit" disabled={actualPending}>
            {t("updateActual")}
          </button>
          {actualState.error ? <p role="alert">{actualState.error}</p> : null}
        </form>
        {/* BUD-03 : devis prestataires joints, ouverts par lien signé temporaire. */}
        {line.attachments.length > 0 ? (
          <ul aria-label={t("quotesOf", { label: line.label })}>
            {line.attachments.map((attachment, index) => (
              <li key={attachment.id}>
                <a href={`/budget/${eventId}/devis/${attachment.id}`} target="_blank" rel="noopener noreferrer">
                  {t("openQuote", {
                    number: index + 1,
                    label: line.label,
                    size: formatFileSize(attachment.sizeBytes, locale),
                  })}
                </a>
              </li>
            ))}
          </ul>
        ) : null}
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
    <table>
      <caption>{t("linesTitle")}</caption>
      <thead>
        <tr>
          <th scope="col">{t("vendorSlot")}</th>
          <th scope="col">{t("planned")}</th>
          <th scope="col">{t("actual")}</th>
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
          <td>{formatAmount(view.totalPlannedCents, locale)}</td>
          <td>{formatAmount(view.totalActualCents, locale)}</td>
          <td>{formatAmount(view.totalVarianceCents, locale)}</td>
          <td />
        </tr>
      </tfoot>
    </table>
  );
}
