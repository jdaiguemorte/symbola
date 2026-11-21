"use client";

// Lot 28a (BUD-01, ADR 0054) — cinq montants par ligne : estimé, devisé, engagé,
// payé, reste à payer (calculé), et l'écart engagé − estimé (PRD-BUD-02).
// Lot 28b (Q33, BUD-03, BUD-04) : les lignes sont rangées par catégorie (le
// poste de l'événement), avec leur total ; chaque ligne a son libellé, son
// prestataire, ses documents (devis, contrat, facture) et ses échéances. Le
// formulaire s'ouvre dans une rangée pleine largeur sous la ligne (le tableau
// ne s'élargit pas). En 375 px, une carte par ligne (globals.css, .budget-lines).
// Lot 28c (BUD-09, D5) : montants saisis TTC ; pour un client professionnel (type
// d'acheteur du devis de l'événement), le HT s'affiche sous chaque TTC, calculé
// au taux de la ligne (ADR 0059).
// Lot 62c (UX-13, UX-05 ; décision D1) : « Modifier » ouvre la ligne en place, une seule à la fois ;
// son libellé, son prestataire, son taux et ses montants ne partent plus un par un : les lignes
// modifiées attendent dans la barre du bas, qui dit leur nombre, et un seul « Enregistrer le budget »
// les écrit ensemble (une transaction). Documents, échéances et suppression restent immédiats.

const COLUMNS = 8;
// Au-delà de ce nombre de lignes, les catégories se replient sur téléphone (lot 62c).
const FOLD_ABOVE_LINES = 12;
import { useActionState, useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { formatAmount, formatAmountInput, formatCalendarDate, formatFileSize, type Locale } from "@symbola/i18n";
import { BUDGET_AMOUNT_FIELDS, BUDGET_DOCUMENT_KINDS, type BudgetAmountField, type BudgetCategory, type BudgetHtTotals } from "@symbola/contracts";
import {
  addBudgetLineAction,
  addVendorPaymentAction,
  confirmEventBudgetAction,
  removeBudgetLineAction,
  removeVendorPaymentAction,
  setVendorPaymentPaidAction,
  setVendorPaymentHandoverAction,
  saveBudgetLinesAction,
  type BudgetFormState,
} from "./actions";
import { useUploadAction } from "@/app/ui/use-upload";
import { formatDecimal } from "@/app/devis/decimal-input";
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

const HT_OF: Record<BudgetAmountField, (line: Line) => number | null> = {
  estimated: (line) => line.ht.estimatedCents,
  quoted: (line) => line.ht.quotedCents,
  committed: (line) => line.ht.committedCents,
  paid: (line) => line.ht.paidCents,
};

// BUD-09 : le HT sous le TTC, pour un client professionnel seulement.
function HtAmount({ cents, professional, locale }: { cents: number | null; professional: boolean; locale: Locale }) {
  const t = useTranslations("Budget");
  if (!professional || cents === null) return null;
  return <span className="budget-ht">{t("htAmount", { amount: formatAmount(cents, locale) })}</span>;
}

function Feedback({ state, success }: { state: BudgetFormState; success: string }) {
  if (state.error) return <p role="alert">{state.error}</p>;
  if (state.success) return <p role="status">{success}</p>;
  return null;
}

// Ce qui se modifie d'une ligne avant « Enregistrer le budget » : le brouillon, en texte.
type LineDraft = { label: string; vendorCandidateId: string; vatRate: string; amounts: Record<BudgetAmountField, string> };

function draftOf(line: Line, locale: Locale): LineDraft {
  return {
    label: line.label,
    vendorCandidateId: line.vendorCandidateId ?? "",
    vatRate: formatDecimal(line.vatRateBasisPoints, 2, locale),
    amounts: {
      estimated: formatAmountInput(line.estimatedAmountCents, locale),
      quoted: formatAmountInput(line.quotedAmountCents, locale),
      committed: formatAmountInput(line.committedAmountCents, locale),
      paid: formatAmountInput(line.paidAmountCents, locale),
    },
  };
}

function sameDraft(a: LineDraft, b: LineDraft): boolean {
  return a.label === b.label && a.vendorCandidateId === b.vendorCandidateId && a.vatRate.trim() === b.vatRate.trim() && BUDGET_AMOUNT_FIELDS.every((field) => a.amounts[field].trim() === b.amounts[field].trim());
}

// Les champs d'une ligne ouverte : libellé, prestataire, taux, puis ses quatre montants. Le nom de
// la ligne reste dans le nom accessible de chaque champ, pas dans son libellé visible.
function LineFields({ line, draft, setDraft, vendors, locale }: { line: Line; draft: LineDraft; setDraft: (draft: LineDraft) => void; vendors: VendorOption[]; locale: Locale }) {
  const t = useTranslations("Budget");
  const of = <span className="sr-only"> — {line.label}</span>;
  return (
    <div className="budget-line-fields">
      <div className="field-row">
        <label>
          <span>
            {t("lineLabel")}
            {of}
          </span>
          <input type="text" value={draft.label} maxLength={200} required onChange={(event) => setDraft({ ...draft, label: event.target.value })} />
        </label>
        <label>
          <span>
            {t("lineVendor")}
            {of}
          </span>
          <select value={draft.vendorCandidateId} onChange={(event) => setDraft({ ...draft, vendorCandidateId: event.target.value })}>
            <option value="">{t("noVendor")}</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field-fit">
          <span>
            {t("lineVatRate")}
            {of}
          </span>
          <input type="text" inputMode="decimal" className="field-short" value={draft.vatRate} onChange={(event) => setDraft({ ...draft, vatRate: event.target.value })} />
        </label>
      </div>
      <div className="field-row">
        {BUDGET_AMOUNT_FIELDS.map((field) =>
          field === "paid" && line.paidFromPayments ? (
            // D13 : le payé vient des échéances payées.
            <p key={field} className="budget-paid-hint">
              {t("paidFromPaymentsHint", { amount: formatAmount(line.paidAmountCents ?? 0, locale) })}
            </p>
          ) : (
            <label key={field} className="field-fit">
              <span>
                {t(`amounts.${field}`)}
                {of}
              </span>
              <input type="text" inputMode="decimal" className="field-amount" value={draft.amounts[field]} onChange={(event) => setDraft({ ...draft, amounts: { ...draft.amounts, [field]: event.target.value } })} />
            </label>
          ),
        )}
      </div>
    </div>
  );
}

// BUD-04 : documents par nature, chacun s'ouvre en un clic.
export function Documents({ eventId, line, locale }: { eventId: string; line: Line; locale: Locale }) {
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
      <form action={action} className="form-inline">
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
        <button type="submit" className="button-secondary" disabled={pending}>
          {t("attachQuote")}
        </button>
        <Feedback state={state} success={t("quoteAttached")} />
      </form>
    </>
  );
}

// BUD-03 : échéances de la ligne (montant fixe ou % de l'engagé du prestataire).
export function Payments({ eventId, line, locale }: { eventId: string; line: Line; locale: Locale }) {
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
                  <input type="date" name="paidOn" className="field-date" defaultValue={today} required />
                </label>
                <button type="submit" className="button-secondary">
                  {t("markPaid", { label: payment.label })}
                </button>
              </form>
            )}
            <form action={removeVendorPaymentAction} className="inline-form">
              <input type="hidden" name="eventId" value={eventId} />
              <input type="hidden" name="paymentId" value={payment.id} />
              <button type="submit" className="link-button">
                {t("removePayment", { label: payment.label })}
              </button>
            </form>
            {/* Lot 51 (JRJ-09 ; D8) : à remettre le jour J (moyen, personne qui remet), pointée dans le mode Jour J. */}
            {payment.handover?.handedOverAt ? (
              <p className="muted">{t("handoverDone", { method: payment.handover.method ?? "—" })}</p>
            ) : payment.status === "paid" ? null : (
              <details>
                <summary>{payment.handover ? t("handoverMarked", { method: payment.handover.method ?? "—", by: payment.handover.by ?? "—" }) : t("handoverOpen", { label: payment.label })}</summary>
                <form action={setVendorPaymentHandoverAction} className="stack">
                  <input type="hidden" name="eventId" value={eventId} />
                  <input type="hidden" name="paymentId" value={payment.id} />
                  <label>
                    <input type="checkbox" name="onDay" defaultChecked={payment.handover !== null} />
                    {t("handoverOnDay")}
                  </label>
                  <label>
                    {t("handoverMethod")}
                    <input type="text" name="method" maxLength={80} defaultValue={payment.handover?.method ?? ""} />
                  </label>
                  <label>
                    {t("handoverBy")}
                    <input type="text" name="by" maxLength={120} defaultValue={payment.handover?.by ?? ""} />
                  </label>
                  <p className="muted">{t("handoverCashHint")}</p>
                  <button type="submit" className="button-secondary">
                    {t("handoverSave")}
                  </button>
                </form>
              </details>
            )}
          </li>
        ))}
      </ul>
      <form action={action}>
        <input type="hidden" name="eventId" value={eventId} />
        <input type="hidden" name="lineId" value={line.id} />
        <fieldset>
          <legend>{t("addPaymentTo", { label: line.label })}</legend>
          <div className="field-row">
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
            <label className="field-fit">
              {t("paymentValue")}
              <input type="text" inputMode="decimal" name="value" className="field-amount" required />
            </label>
            <label className="field-fit">
              {t("paymentDueOn")}
              <input type="date" name="dueOn" className="field-date" required />
            </label>
          </div>
          <button type="submit" className="button-secondary" disabled={pending}>
            {t("addPayment")}
          </button>
          <Feedback state={state} success={t("paymentAdded")} />
        </fieldset>
      </form>
    </section>
  );
}

type RowEditing = {
  openId: string | null;
  toggle: (lineId: string) => void;
  draftFor: (line: Line) => LineDraft;
  isChanged: (line: Line) => boolean;
  setDraft: (line: Line, draft: LineDraft) => void;
  revert: (line: Line) => void;
};

function LineRow({ eventId, line, vendors, professional, locale, editing }: { eventId: string; line: Line; vendors: VendorOption[]; professional: boolean; locale: Locale; editing: RowEditing }) {
  const t = useTranslations("Budget");
  const open = editing.openId === line.id;
  const changed = editing.isChanged(line);
  const shown = (cents: number | null) => (cents === null ? t("notSet") : formatAmount(cents, locale));
  const variance = varianceDisplay(line.varianceCents);
  const editorId = `edition-${line.id}`;
  return (
    <>
      <tr id={`ligne-${line.id}`} className={open ? "budget-line budget-line-open" : "budget-line"}>
        {/* Le prestataire sous le libellé : le tableau tient dans la largeur de l'écran. */}
        <th scope="row">
          {line.label}
          {changed ? <span className="badge badge-ambre">{t("lineChanged")}</span> : null}
          {line.vendorName ? <span className="budget-line-vendor">{line.vendorName}</span> : null}
        </th>
        {BUDGET_AMOUNT_FIELDS.map((field) => (
          <td key={field} className="num" data-label={t(`amounts.${field}`)}>
            {shown(AMOUNT_OF[field](line))}
            <HtAmount cents={HT_OF[field](line)} professional={professional} locale={locale} />
          </td>
        ))}
        <td className={line.remainingAmountCents !== null && line.remainingAmountCents < 0 ? "num budget-wide text-overdue" : "num budget-wide"} data-label={t("amounts.remaining")}>
          {shown(line.remainingAmountCents)}
          <HtAmount cents={line.ht.remainingCents} professional={professional} locale={locale} />
        </td>
        <td className={variance.className ? `budget-wide ${variance.className}` : "budget-wide"} data-label={t("variance")}>
          {t(variance.labelKey, { amount: variance.amountCents === null ? "" : formatAmount(variance.amountCents, locale) })}
          <HtAmount cents={line.ht.varianceCents} professional={professional} locale={locale} />
        </td>
        <td className="budget-line-edit">
          {/* « Modifier » visible ; le nom de la ligne pour les lecteurs d'écran. */}
          <button type="button" className="button-secondary" aria-expanded={open} aria-controls={editorId} data-edit-line={line.id} onClick={() => editing.toggle(line.id)}>
            {t("edit")}
            <span className="sr-only"> {t("editLineName", { label: line.label })}</span>
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="budget-line-editor">
          <td colSpan={COLUMNS}>
            <section id={editorId} aria-label={t("editorOf", { label: line.label })} className="edit-row-open budget-line-editor-panel" tabIndex={-1} data-open-line={line.id}>
              <LineFields line={line} draft={editing.draftFor(line)} setDraft={(draft) => editing.setDraft(line, draft)} vendors={vendors} locale={locale} />
              <div className="row-wrap">
                <button type="button" className="button-secondary" onClick={() => editing.toggle(line.id)}>
                  {t("closeLine")}
                </button>
                {changed ? (
                  <button type="button" className="button-ghost" onClick={() => editing.revert(line)}>
                    {t("revertLine")}
                  </button>
                ) : null}
              </div>
              <div className="budget-line-more">
                <section aria-label={t("documentsOf", { label: line.label })} className="stack">
                  <h3>{t("documentsTitle")}</h3>
                  <Documents eventId={eventId} line={line} locale={locale} />
                </section>
                <div className="stack">
                  <h3>{t("paymentsTitle")}</h3>
                  <Payments eventId={eventId} line={line} locale={locale} />
                </div>
              </div>
              <form action={removeBudgetLineAction}>
                <input type="hidden" name="eventId" value={eventId} />
                <input type="hidden" name="lineId" value={line.id} />
                <button type="submit" className="button-danger">
                  {t("removeLine", { label: line.label })}
                </button>
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
    <form action={action} className="form-inline">
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
      <button type="submit" className="button-secondary" disabled={pending}>
        {t("addLine")}
      </button>
      <Feedback state={state} success={t("lineAdded")} />
    </form>
  );
}

function CategoryRows({
  eventId,
  category,
  vendors,
  professional,
  locale,
  editing,
  foldable,
}: {
  eventId: string;
  category: BudgetCategory;
  vendors: VendorOption[];
  professional: boolean;
  locale: Locale;
  editing: RowEditing;
  // Au-delà de douze lignes, les catégories se replient sur téléphone (leurs totaux restent en vue).
  foldable: boolean;
}) {
  const t = useTranslations("Budget");
  const [adding, setAdding] = useState(false);
  const [unfolded, setUnfolded] = useState(false);
  // Une ligne ouverte ou modifiée garde sa catégorie dépliée.
  const folded = foldable && !unfolded && !category.lines.some((line) => line.id === editing.openId || editing.isChanged(line));
  const titleId = `categorie-${category.eventVendorSlotId}`;
  const addId = `ajout-${category.eventVendorSlotId}`;
  return (
    <tbody aria-labelledby={titleId} data-folded={folded ? "true" : undefined}>
      <tr className="budget-category">
        <th scope="rowgroup">
          <span id={titleId}>{category.label}</span>
          {foldable && category.lines.length > 0 ? (
            <button type="button" className="link-button budget-fold" aria-expanded={!folded} onClick={() => setUnfolded(folded)}>
              {t(folded ? "showLines" : "hideLines", { count: category.lines.length })}
              <span className="sr-only"> {t("editLineName", { label: category.label })}</span>
            </button>
          ) : null}
          {/* L'ajout d'une ligne sous le nom de la catégorie : la dernière colonne reste étroite. */}
          <button type="button" className="link-button" aria-expanded={adding} aria-controls={addId} onClick={() => setAdding(!adding)}>
            {t("addLine")}
            <span className="sr-only"> {t("addLineTo", { category: category.label })}</span>
          </button>
        </th>
        <TotalCells ttc={category} ht={category.ht} professional={professional} locale={locale} />
        <td />
      </tr>
      {adding ? (
        <tr className="budget-line-editor budget-line-adding">
          <td colSpan={COLUMNS}>
            <section id={addId} aria-label={t("newLineOf", { category: category.label })} className="edit-row-open">
              <AddLineForm eventId={eventId} category={category} vendors={vendors} />
            </section>
          </td>
        </tr>
      ) : null}
      {category.lines.map((line) => (
        <LineRow key={line.id} eventId={eventId} line={line} vendors={vendors} professional={professional} locale={locale} editing={editing} />
      ))}
    </tbody>
  );
}

// Totaux d'une catégorie ou du budget : TTC, et HT par taux pour un professionnel.
function TotalCells({
  ttc,
  ht,
  professional,
  locale,
}: {
  ttc: Record<"estimatedCents" | "quotedCents" | "committedCents" | "paidCents" | "remainingCents" | "varianceCents", number>;
  ht: BudgetHtTotals;
  professional: boolean;
  locale: Locale;
}) {
  const t = useTranslations("Budget");
  const cells = [
    ["amounts.estimated", "estimatedCents"],
    ["amounts.quoted", "quotedCents"],
    ["amounts.committed", "committedCents"],
    ["amounts.paid", "paidCents"],
    ["amounts.remaining", "remainingCents"],
    ["variance", "varianceCents"],
  ] as const;
  return (
    <>
      {cells.map(([label, key]) => (
        <td key={key} className={key === "remainingCents" || key === "varianceCents" ? "num budget-wide" : "num"} data-label={t(label)}>
          {formatAmount(ttc[key], locale)}
          <HtAmount cents={ht[key]} professional={professional} locale={locale} />
        </td>
      ))}
    </>
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
  const professional = view?.clientKind === "professional";
  const [drafts, setDrafts] = useState<Record<string, LineDraft>>({});
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [savedCount, setSavedCount] = useState<number | null>(null);
  const [pending, startTransition] = useTransition();
  const root = useRef<HTMLDivElement>(null);
  const lines = view?.lines ?? [];
  // Une ligne redevenue comme elle était, ou supprimée entre-temps, ne compte plus.
  const changed = lines.filter((line) => drafts[line.id] && !sameDraft(drafts[line.id]!, draftOf(line, locale)));
  const dirty = changed.length > 0;

  // Quitter ou recharger la page avec des lignes en attente : le navigateur demande confirmation ;
  // un lien de l'app (menu, retour à la fiche) pose la même question.
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    const guard = (event: MouseEvent) => {
      const link = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link || link.target === "_blank" || link.hasAttribute("download")) return;
      if (link.origin === window.location.origin && link.pathname === window.location.pathname && link.search === window.location.search) return;
      if (!window.confirm(t("unsavedConfirm"))) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", warn);
    document.addEventListener("click", guard, true);
    return () => {
      window.removeEventListener("beforeunload", warn);
      document.removeEventListener("click", guard, true);
    };
  }, [dirty, t]);

  // La ligne qui s'ouvre prend le focus ; refermée, il revient à son bouton « Modifier ».
  const lastOpen = useRef<string | null>(null);
  useEffect(() => {
    const target = openId ? `[data-open-line="${openId}"]` : lastOpen.current ? `[data-edit-line="${lastOpen.current}"]` : null;
    if (target) root.current?.querySelector<HTMLElement>(target)?.focus();
    lastOpen.current = openId;
  }, [openId]);

  const editing: RowEditing = {
    openId,
    toggle: (lineId) => setOpenId(openId === lineId ? null : lineId),
    draftFor: (line) => drafts[line.id] ?? draftOf(line, locale),
    isChanged: (line) => changed.includes(line),
    setDraft: (line, draft) => {
      setSavedCount(null);
      setDrafts((current) => ({ ...current, [line.id]: draft }));
    },
    revert: (line) => {
      setDrafts((current) => Object.fromEntries(Object.entries(current).filter(([lineId]) => lineId !== line.id)));
      setError(null);
    },
  };
  const cancelAll = () => {
    setDrafts({});
    setError(null);
  };
  const save = () => {
    const unnamed = changed.find((line) => drafts[line.id]!.label.trim() === "");
    if (unnamed) {
      setOpenId(unnamed.id);
      setError(t("lineLabelRequired"));
      return;
    }
    startTransition(async () => {
      setError(null);
      const result = await saveBudgetLinesAction({
        eventId,
        lines: changed.map((line) => {
          const draft = drafts[line.id]!;
          const original = draftOf(line, locale);
          return {
            lineId: line.id,
            label: draft.label,
            vendorCandidateId: draft.vendorCandidateId === "" ? null : draft.vendorCandidateId,
            vatRate: draft.vatRate,
            // Seuls les montants touchés partent : un champ laissé tel quel n'est pas réécrit.
            amounts: Object.fromEntries(BUDGET_AMOUNT_FIELDS.filter((field) => !(field === "paid" && line.paidFromPayments) && draft.amounts[field].trim() !== original.amounts[field].trim()).map((field) => [field, draft.amounts[field]])),
          };
        }),
      });
      if (!result.ok) {
        setError(result.error);
        if (result.line) setOpenId(result.line);
        return;
      }
      setDrafts({});
      setOpenId(null);
      setSavedCount(result.count);
    });
  };

  if (!view || view.lines.length === 0) {
    if (!canConfirm) return null;
    return (
      <form action={confirmEventBudgetAction}>
        <input type="hidden" name="eventId" value={eventId} />
        <button type="submit" className="button-primary">
          {t("confirmAsPlanned")}
        </button>
      </form>
    );
  }

  return (
    <div className="budget-lines-editor" ref={root}>
    {/* BUD-09 : le mode suit le type de client du devis, sans réglage. */}
    <p className="muted">{t(professional ? "vatModeProfessional" : "vatModeIndividual")}</p>
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
            <th scope="col">{t("linesActions")}</th>
          </tr>
        </thead>
        {view.categories.map((category) => (
          <CategoryRows
            key={category.eventVendorSlotId}
            eventId={eventId}
            category={category}
            vendors={vendorOptions[category.eventVendorSlotId] ?? []}
            professional={professional}
            locale={locale}
            editing={editing}
            foldable={view.lines.length > FOLD_ABOVE_LINES}
          />
        ))}
        <tfoot>
          <tr>
            <th scope="row">{t("total")}</th>
            <TotalCells
              ttc={{
                estimatedCents: view.totalEstimatedCents,
                quotedCents: view.totalQuotedCents,
                committedCents: view.totalCommittedCents,
                paidCents: view.totalPaidCents,
                remainingCents: view.totalRemainingCents,
                varianceCents: view.totalVarianceCents,
              }}
              ht={view.totalHt}
              professional={professional}
              locale={locale}
            />
            <td />
          </tr>
        </tfoot>
      </table>
    </div>
    {error ? (
      <p role="alert" className="notice notice-error">
        {error}
      </p>
    ) : null}
    {dirty ? (
      <div className="edit-bar">
        <p role="status">{t("linesPending", { count: changed.length })}</p>
        <div className="row-wrap">
          <button type="button" className="button-secondary" onClick={cancelAll} disabled={pending}>
            {t("cancelChanges")}
          </button>
          <button type="button" className="button-primary" onClick={save} disabled={pending}>
            {t("linesSave")}
          </button>
        </div>
      </div>
    ) : savedCount !== null ? (
      <p role="status" className="notice">
        {t("linesSaved", { count: savedCount })}
      </p>
    ) : null}
    </div>
  );
}
