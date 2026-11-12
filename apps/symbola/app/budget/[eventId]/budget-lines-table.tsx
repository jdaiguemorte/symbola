"use client";

// Lot 28a (BUD-01, ADR 0054) — cinq montants par ligne : estimé, devisé, engagé,
// payé, reste à payer (calculé), et l'écart engagé − estimé (PRD-BUD-02).
// Lot 28b (Q33, BUD-03, BUD-04) : les lignes sont rangées par catégorie (le
// poste de l'événement), avec leur total ; chaque ligne a son libellé, son
// prestataire, ses documents (devis, contrat, facture) et ses échéances. Le
// formulaire s'ouvre dans une rangée pleine largeur sous la ligne (le tableau
// ne s'élargit pas). En 375 px, une carte par ligne (globals.css, .budget-lines).

const COLUMNS = 8;
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { formatAmount, formatAmountInput, formatCalendarDate, formatFileSize, type Locale } from "@symbola/i18n";
import { BUDGET_AMOUNT_FIELDS, BUDGET_DOCUMENT_KINDS, type BudgetAmountField, type BudgetCategory } from "@symbola/contracts";
import {
  addBudgetLineAction,
  addVendorPaymentAction,
  confirmEventBudgetAction,
  removeBudgetLineAction,
  removeVendorPaymentAction,
  setVendorPaymentPaidAction,
  updateBudgetLineAction,
  updateBudgetLineDetailsAction,
  type BudgetFormState,
} from "./actions";
import { useUploadAction } from "@/app/ui/use-upload";
import { varianceDisplay } from "@/app/budget/variance-display";
import type { BudgetLinesView } from "@/modules/budget/service";

type Line = BudgetLinesView["lines"][number];
export type VendorOption = { id: string; name: string };

const AMOUNT_OF: Record<BudgetAmountField, (line: Line) => number | null> = {
  estimated: (line) => line.estimatedAmountCents,
  quoted: (line) => line.quotedAmountCents,
  committed: (line) => line.committedAmountCents,
  paid: (line) => line.paidAmountCents,
};

function Feedback({ state, success }: { state: BudgetFormState; success: string }) {
  if (state.error) return <p role="alert">{state.error}</p>;
  if (state.success) return <p role="status">{success}</p>;
  return null;
}

function AmountsForm({ eventId, line, locale }: { eventId: string; line: Line; locale: Locale }) {
  const t = useTranslations("Budget");
  const [state, action, pending] = useActionState(updateBudgetLineAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="lineId" value={line.id} />
      {BUDGET_AMOUNT_FIELDS.map((field) =>
        field === "paid" && line.paidFromPayments ? (
          // D13 : le payé vient des échéances payées.
          <p key={field}>{t("paidFromPaymentsHint", { amount: formatAmount(line.paidAmountCents ?? 0, locale) })}</p>
        ) : (
          <label key={field}>
            {t(`amounts.${field}`)} — {line.label}
            <input type="hidden" name={`current_${field}`} value={AMOUNT_OF[field](line) ?? ""} />
            <input type="text" inputMode="decimal" name={`amount_${field}`} defaultValue={formatAmountInput(AMOUNT_OF[field](line), locale)} />
          </label>
        ),
      )}
      <button type="submit" disabled={pending}>
        {t("saveLine")}
      </button>
      <Feedback state={state} success={t("lineSaved")} />
    </form>
  );
}

function DetailsForm({ eventId, line, vendors }: { eventId: string; line: Line; vendors: VendorOption[] }) {
  const t = useTranslations("Budget");
  const [state, action, pending] = useActionState(updateBudgetLineDetailsAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="lineId" value={line.id} />
      <label>
        {t("lineLabelOf", { label: line.label })}
        <input type="text" name="label" defaultValue={line.label} maxLength={200} required />
      </label>
      <label>
        {t("lineVendorOf", { label: line.label })}
        <select name="vendorCandidateId" defaultValue={line.vendorCandidateId ?? ""}>
          <option value="">{t("noVendor")}</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {t("saveLineDetails")}
      </button>
      <Feedback state={state} success={t("lineDetailsSaved")} />
    </form>
  );
}

// BUD-04 : documents par nature, chacun s'ouvre en un clic.
function Documents({ eventId, line, locale }: { eventId: string; line: Line; locale: Locale }) {
  const t = useTranslations("Budget");
  const [state, action, pending] = useUploadAction<BudgetFormState>(`/budget/${eventId}/devis`);
  return (
    <>
      {line.attachments.length > 0 ? (
        <ul aria-label={t("documentsOf", { label: line.label })}>
          {line.attachments.map((attachment) => {
            const number = line.attachments.filter((other) => other.kind === attachment.kind).indexOf(attachment) + 1;
            return (
              <li key={attachment.id}>
                <a href={`/budget/${eventId}/devis/${attachment.id}`} target="_blank" rel="noopener noreferrer">
                  {t("openDocument", { kind: t(`documentKindArticle.${attachment.kind}`), number, label: line.label, size: formatFileSize(attachment.sizeBytes, locale) })}
                </a>
              </li>
            );
          })}
        </ul>
      ) : null}
      <form action={action}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="lineId" value={line.id} />
        <label>
          {t("documentKindOf", { label: line.label })}
          <select name="kind" defaultValue="quote">
            {BUDGET_DOCUMENT_KINDS.map((kind) => (
              <option key={kind} value={kind}>
                {t(`documentKind.${kind}`)}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("quoteFile", { label: line.label })}
          <input type="file" name="quote" accept="application/pdf,image/*" required />
        </label>
        <button type="submit" disabled={pending}>
          {t("attachQuote")}
        </button>
        <Feedback state={state} success={t("quoteAttached")} />
      </form>
    </>
  );
}

// BUD-03 : échéances de la ligne (montant fixe ou % de l'engagé du prestataire).
function Payments({ eventId, line, locale }: { eventId: string; line: Line; locale: Locale }) {
  const t = useTranslations("Budget");
  const [state, action, pending] = useActionState(addVendorPaymentAction, {});
  const today = new Date().toISOString().slice(0, 10);
  return (
    <section aria-label={t("paymentsOf", { label: line.label })} className="stack">
      {line.payments.length === 0 ? <p className="muted">{t("noPayments")}</p> : null}
      <ul>
        {line.payments.map((payment) => (
          <li key={payment.id}>
            <strong>{payment.label}</strong> — {formatAmount(payment.amountCents, locale)}
            {payment.percentageBasisPoints !== null ? ` (${t("paymentPercent", { percent: payment.percentageBasisPoints / 100 })})` : ""} —{" "}
            <span className={payment.status === "overdue" ? "text-overdue" : undefined}>
              {payment.status === "paid"
                ? t("paymentPaid", { date: formatCalendarDate(payment.paidOn!, locale) })
                : t(payment.status === "overdue" ? "paymentOverdue" : "paymentDue", { date: formatCalendarDate(payment.dueOn, locale) })}
            </span>
            {/* Deux formulaires distincts (clés) : React ne réutilise pas le bouton plein
                pour le lien, ce qui animerait sa couleur (contraste faux pendant la transition). */}
            {payment.status === "paid" ? (
              <form key="unpay" action={setVendorPaymentPaidAction} className="inline-form">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="paymentId" value={payment.id} />
                <input type="hidden" name="paidOn" value="" />
                <button type="submit" className="link-button">
                  {t("unmarkPaid", { label: payment.label })}
                </button>
              </form>
            ) : (
              <form key="pay" action={setVendorPaymentPaidAction} className="inline-form">
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="paymentId" value={payment.id} />
                <label>
                  {t("paidOnFor", { label: payment.label })}
                  <input type="date" name="paidOn" defaultValue={today} required />
                </label>
                <button type="submit">{t("markPaid", { label: payment.label })}</button>
              </form>
            )}
            <form action={removeVendorPaymentAction} className="inline-form">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="paymentId" value={payment.id} />
              <button type="submit" className="link-button">
                {t("removePayment", { label: payment.label })}
              </button>
            </form>
          </li>
        ))}
      </ul>
      <form action={action}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="lineId" value={line.id} />
        <fieldset>
          <legend>{t("addPaymentTo", { label: line.label })}</legend>
          <label>
            {t("paymentLabel")}
            <input type="text" name="label" maxLength={200} required />
          </label>
          <label>
            {t("paymentMode")}
            <select name="mode" defaultValue="amount">
              <option value="amount">{t("paymentModeAmount")}</option>
              <option value="percent">{t("paymentModePercent")}</option>
            </select>
          </label>
          <label>
            {t("paymentValue")}
            <input type="text" inputMode="decimal" name="value" required />
          </label>
          <label>
            {t("paymentDueOn")}
            <input type="date" name="dueOn" required />
          </label>
          <button type="submit" disabled={pending}>
            {t("addPayment")}
          </button>
          <Feedback state={state} success={t("paymentAdded")} />
        </fieldset>
      </form>
    </section>
  );
}

function LineRow({ eventId, line, vendors, locale }: { eventId: string; line: Line; vendors: VendorOption[]; locale: Locale }) {
  const t = useTranslations("Budget");
  const [open, setOpen] = useState(false);
  const shown = (cents: number | null) => (cents === null ? t("notSet") : formatAmount(cents, locale));
  const variance = varianceDisplay(line.varianceCents);
  const editorId = `edition-${line.id}`;
  return (
    <>
      <tr id={`ligne-${line.id}`}>
        {/* Le prestataire sous le libellé : le tableau tient dans la largeur de l'écran. */}
        <th scope="row">
          {line.label}
          {line.vendorName ? <span className="budget-line-vendor">{line.vendorName}</span> : null}
        </th>
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
          {/* « Modifier » visible ; le nom de la ligne pour les lecteurs d'écran. */}
          <button type="button" aria-expanded={open} aria-controls={editorId} onClick={() => setOpen(!open)}>
            {t("edit")}
            <span className="sr-only"> {t("editLineName", { label: line.label })}</span>
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="budget-line-editor">
          <td colSpan={COLUMNS}>
            <section id={editorId} aria-label={t("editorOf", { label: line.label })} className="budget-line-editor-panel">
              <AmountsForm eventId={eventId} line={line} locale={locale} />
              <DetailsForm eventId={eventId} line={line} vendors={vendors} />
              <Documents eventId={eventId} line={line} locale={locale} />
              <Payments eventId={eventId} line={line} locale={locale} />
              <form action={removeBudgetLineAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="lineId" value={line.id} />
                <button type="submit">{t("removeLine", { label: line.label })}</button>
              </form>
            </section>
          </td>
        </tr>
      ) : null}
    </>
  );
}

function AddLineForm({ eventId, category, vendors }: { eventId: string; category: BudgetCategory; vendors: VendorOption[] }) {
  const t = useTranslations("Budget");
  const [state, action, pending] = useActionState(addBudgetLineAction, {});
  return (
    <form action={action}>
      <input type="hidden" name="eventId" value={eventId} />
      <input type="hidden" name="eventVendorSlotId" value={category.eventVendorSlotId} />
      <label>
        {t("newLineLabel", { category: category.label })}
        <input type="text" name="label" maxLength={200} required />
      </label>
      <label>
        {t("newLineVendor", { category: category.label })}
        <select name="vendorCandidateId" defaultValue="">
          <option value="">{t("noVendor")}</option>
          {vendors.map((vendor) => (
            <option key={vendor.id} value={vendor.id}>
              {vendor.name}
            </option>
          ))}
        </select>
      </label>
      <button type="submit" disabled={pending}>
        {t("addLine")}
      </button>
      <Feedback state={state} success={t("lineAdded")} />
    </form>
  );
}

function CategoryRows({ eventId, category, vendors, locale }: { eventId: string; category: BudgetCategory; vendors: VendorOption[]; locale: Locale }) {
  const t = useTranslations("Budget");
  const [adding, setAdding] = useState(false);
  const titleId = `categorie-${category.eventVendorSlotId}`;
  const addId = `ajout-${category.eventVendorSlotId}`;
  return (
    <tbody aria-labelledby={titleId}>
      <tr className="budget-category">
        <th scope="rowgroup">
          <span id={titleId}>{category.label}</span>
          {/* L'ajout d'une ligne sous le nom de la catégorie : la dernière colonne reste étroite. */}
          <button type="button" className="link-button" aria-expanded={adding} aria-controls={addId} onClick={() => setAdding(!adding)}>
            {t("addLine")}
            <span className="sr-only"> {t("addLineTo", { category: category.label })}</span>
          </button>
        </th>
        <td className="num" data-label={t("amounts.estimated")}>{formatAmount(category.estimatedCents, locale)}</td>
        <td className="num" data-label={t("amounts.quoted")}>{formatAmount(category.quotedCents, locale)}</td>
        <td className="num" data-label={t("amounts.committed")}>{formatAmount(category.committedCents, locale)}</td>
        <td className="num" data-label={t("amounts.paid")}>{formatAmount(category.paidCents, locale)}</td>
        <td className="num" data-label={t("amounts.remaining")}>{formatAmount(category.remainingCents, locale)}</td>
        <td className="num" data-label={t("variance")}>{formatAmount(category.varianceCents, locale)}</td>
        <td />
      </tr>
      {adding ? (
        <tr className="budget-line-editor">
          <td colSpan={COLUMNS}>
            <section id={addId} aria-label={t("newLineOf", { category: category.label })} className="budget-line-editor-panel">
              <AddLineForm eventId={eventId} category={category} vendors={vendors} />
            </section>
          </td>
        </tr>
      ) : null}
      {category.lines.map((line) => (
        <LineRow key={line.id} eventId={eventId} line={line} vendors={vendors} locale={locale} />
      ))}
    </tbody>
  );
}

export function BudgetLinesTable({
  eventId,
  view,
  canConfirm,
  vendorOptions,
  locale,
}: {
  eventId: string;
  view: BudgetLinesView | null;
  canConfirm: boolean;
  // Prestataires rattachés de chaque catégorie (hors écartés), par poste.
  vendorOptions: Record<string, VendorOption[]>;
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
        {view.categories.map((category) => (
          <CategoryRows key={category.eventVendorSlotId} eventId={eventId} category={category} vendors={vendorOptions[category.eventVendorSlotId] ?? []} locale={locale} />
        ))}
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
