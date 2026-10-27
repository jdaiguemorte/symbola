"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { formatAmount, type Locale } from "@symbola/i18n";
import { confirmEventBudgetAction, updateBudgetLineAction, type BudgetFormState } from "./actions";
import type { BudgetLinesView } from "@/modules/budget/service";

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

  // BUD-02 : dépassement en rouge, économie en vert — jamais seulement la
  // couleur (le texte « dépassement »/« économie » porte l'information,
  // la couleur est un renfort visuel, axe-core).
  const varianceLabel =
    line.varianceCents === null
      ? t("varianceUnset")
      : line.varianceCents > 0
        ? t("varianceOver", { amount: formatAmount(line.varianceCents, locale) })
        : line.varianceCents < 0
          ? t("varianceUnder", { amount: formatAmount(Math.abs(line.varianceCents), locale) })
          : t("varianceEqual");
  const varianceColor =
    line.varianceCents === null ? undefined : line.varianceCents > 0 ? "#b91c1c" : line.varianceCents < 0 ? "#15803d" : undefined;

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
