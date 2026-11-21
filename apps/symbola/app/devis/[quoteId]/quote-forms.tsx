"use client";

import Link from "next/link";
import { DraftKeeper } from "@/app/ui/draft-keeper";
import { useActionState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AdvanceKind, CatalogItem, GlobalDiscountInput, QuoteLine, QuoteSection, QuoteTemplateSummary } from "@/modules/quotes/service";
import { formatDecimal } from "../decimal-input";
import { MissingMentionsList } from "../missing-mentions";
import { RecipientsGuard } from "../../recipients-guard";
import {
  addCatalogLineAction,
  addFreeLineAction,
  addSectionAction,
  chooseOptionsAction,
  renameSectionAction,
  reviseQuoteAction,
  saveAsTemplateAction,
  setAdvanceKindAction,
  setGlobalDiscountAction,
  updateLineAction,
  type QuoteFormState,
} from "./actions";

type Action = (state: QuoteFormState, formData: FormData) => Promise<QuoteFormState>;

// Formulaire d'une action du devis : identifiant caché, bouton, retour
// d'erreur ou de confirmation annoncé aux lecteurs d'écran. Lot 38a (MSG-02) : les champs peuvent
// relire l'état (valeurs remises après un refus) ; l'écran du garde-fou remplace le bouton.
export function QuoteActionForm({
  action,
  quoteId,
  label,
  submitLabel,
  successMessage,
  children,
  draftKey,
  layout = "stack",
  primary = false,
  danger = false,
}: {
  action: Action;
  quoteId: string;
  label: string;
  submitLabel: string;
  successMessage: string;
  // Lot 39b (UX-09) : la saisie en cours est gardée (brouillon) et se reprend sur tout appareil.
  draftKey?: string;
  // Lot 62d (UX-12) : « row », quelques champs courts et leur bouton sur une même ligne (formulaire
  // en ligne de DESIGN.md) ; « stack », les champs (en grille) puis le bouton.
  layout?: "stack" | "row";
  // Lot 62d (DESIGN.md) : un seul bouton principal par écran, celui de la prochaine action du devis ;
  // tous les autres envois sont des boutons secondaires.
  primary?: boolean;
  // Une action qui annule ou détruit (bouton de danger de DESIGN.md), jamais le bouton principal.
  danger?: boolean;
  children?: ReactNode | ((state: QuoteFormState) => ReactNode);
}) {
  const t = useTranslations("Quotes");
  const initialState: QuoteFormState = {};
  const [state, formAction, pending] = useActionState(action, initialState);
  const fields = typeof children === "function" ? children(state) : children;
  const submit = state.confirmRecipients ? (
    <RecipientsGuard review={state.confirmRecipients} pending={pending} />
  ) : (
    <button type="submit" disabled={pending} className={primary ? "button-primary" : danger ? "button-danger" : "button-secondary"}>
      {submitLabel}
    </button>
  );
  return (
    <form action={formAction} aria-label={label} className={primary ? "quote-form quote-next-action" : "quote-form"}>
      <input type="hidden" name="quoteId" value={quoteId} />
      {draftKey ? <DraftKeeper formKey={draftKey} submission={state} saved={Boolean(state.success)} /> : null}
      {layout === "row" ? (
        <div className="field-row">
          {fields}
          {submit}
        </div>
      ) : (
        <>
          {fields}
          {submit}
        </>
      )}
      {state.error ? (
        <p role="alert">
          {state.error}
          {state.vatRegimeRequired ? (
            <>
              {" "}
              <Link href="/parametres">{t("completeVatRegime")}</Link>
            </>
          ) : null}
        </p>
      ) : null}
      {state.missingMentions && state.missingMentions.length > 0 ? <MissingMentionsList fields={state.missingMentions} /> : null}
      {state.success ? <p role="status">{successMessage}</p> : null}
    </form>
  );
}

// Lot 31a (FAC-01, D2) : section de la ligne et ligne en option.
// Lot 41 (JUR-02, D9) : bien ou service (« service » par défaut) ; la facture en déduit la catégorie.
export function NatureField({ idPrefix, value, line }: { idPrefix: string; value?: "service" | "goods" | undefined; line?: QuoteLine }) {
  const t = useTranslations("Quotes");
  return (
    <>
      <label htmlFor={`${idPrefix}-nature`}>
        {t("lineNature")}
        <select id={`${idPrefix}-nature`} name="nature" defaultValue={value ?? "service"}>
          <option value="service">{t("lineNatureService")}</option>
          <option value="goods">{t("lineNatureGoods")}</option>
        </select>
      </label>
      {/* Lot 48b (JUR-10, D7) : revendeur (dans votre total) ou intermédiaire (facturée par le prestataire). */}
      <label htmlFor={`${idPrefix}-supply`}>
        {t("lineSupplyMode")}
        <select id={`${idPrefix}-supply`} name="supplyMode" defaultValue={line?.supplyMode ?? "resale"}>
          <option value="resale">{t("lineSupplyResale")}</option>
          <option value="intermediary">{t("lineSupplyIntermediary")}</option>
        </select>
      </label>
      <label htmlFor={`${idPrefix}-tourism`}>
        {t("lineTourismKind")}
        <select id={`${idPrefix}-tourism`} name="tourismKind" defaultValue={line?.tourismKind ?? ""}>
          <option value="">{t("lineTourismNone")}</option>
          <option value="transport">{t("lineTourismTransport")}</option>
          <option value="lodging">{t("lineTourismLodging")}</option>
          <option value="other">{t("lineTourismOther")}</option>
        </select>
      </label>
    </>
  );
}

function PlacementFields({ idPrefix, sections, line }: { idPrefix: string; sections: QuoteSection[]; line?: QuoteLine }) {
  const t = useTranslations("Quotes");
  return (
    <>
      {sections.length > 0 ? (
        <label htmlFor={`${idPrefix}-section`}>
          {t("lineSection")}
          <select id={`${idPrefix}-section`} name="sectionId" defaultValue={line?.sectionId ?? ""}>
            <option value="">{t("noSection")}</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label>
        <input type="checkbox" name="isOption" defaultChecked={line?.isOption ?? false} />
        {t("lineIsOption")}
      </label>
    </>
  );
}

export function AddCatalogLineForm({ quoteId, items, sections = [] }: { quoteId: string; items: CatalogItem[]; sections?: QuoteSection[] }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm
      action={addCatalogLineAction}
      quoteId={quoteId}
      label={t("addFromCatalog")}
      submitLabel={t("addLine")}
      successMessage={t("lineAdded")}
      layout="row"
    >
      <label htmlFor="catalogItemId">
        {t("catalogItem")}
        <select id="catalogItemId" name="catalogItemId" required defaultValue="">
          <option value="" disabled>
            {t("chooseItem")}
          </option>
          {items.map((item) => (
            <option key={item.id} value={item.id}>
              {item.category ? `${item.category} — ${item.label}` : item.label}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor="catalog-quantity" className="field-fit">
        {t("quantity")}
        <input id="catalog-quantity" type="text" inputMode="decimal" name="quantity" required defaultValue="1" className="field-short" />
      </label>
      <PlacementFields idPrefix="catalog" sections={sections} />
    </QuoteActionForm>
  );
}

export function AddFreeLineForm({
  quoteId,
  vatApplicable,
  defaultVatRateBasisPoints,
  sections = [],
}: {
  quoteId: string;
  vatApplicable: boolean;
  defaultVatRateBasisPoints: number;
  sections?: QuoteSection[];
}) {
  const t = useTranslations("Quotes");
  const locale = useLocale() as "fr" | "en";
  return (
    <QuoteActionForm
      action={addFreeLineAction}
      quoteId={quoteId}
      draftKey={`quote-line:${quoteId}`}
      label={t("addFreeLine")}
      submitLabel={t("addLine")}
      successMessage={t("lineAdded")}
    >
      <div className="field-row">
        <label htmlFor="free-label">
          {t("itemLabel")}
          <input id="free-label" type="text" name="label" required />
        </label>
        <label htmlFor="free-unit" className="field-fit">
          {t("itemUnit")}
          <input id="free-unit" type="text" name="unit" required className="field-code" />
        </label>
        <label htmlFor="free-quantity" className="field-fit">
          {t("quantity")}
          <input id="free-quantity" type="text" inputMode="decimal" name="quantity" required defaultValue="1" className="field-short" />
        </label>
        <label htmlFor="free-unit-price" className="field-fit">
          {t("itemUnitPrice")}
          <input id="free-unit-price" type="text" inputMode="decimal" name="unitPrice" required className="field-amount" />
        </label>
        {vatApplicable ? (
          <label htmlFor="free-vat-rate" className="field-fit">
            {t("itemVatRate")}
            <input id="free-vat-rate" type="text" inputMode="decimal" name="vatRate" defaultValue={formatDecimal(defaultVatRateBasisPoints, 2, locale)} className="field-short" />
          </label>
        ) : null}
      </div>
      <label htmlFor="free-description" className="field-wide">
        {t("itemDescription")}
        <input id="free-description" type="text" name="description" />
      </label>
      <div className="field-row">
        <NatureField idPrefix="free" />
        <PlacementFields idPrefix="free" sections={sections} />
      </div>
    </QuoteActionForm>
  );
}

export function EditLineForm({ quoteId, line, vatApplicable, sections = [] }: { quoteId: string; line: QuoteLine; vatApplicable: boolean; sections?: QuoteSection[] }) {
  const t = useTranslations("Quotes");
  const locale = useLocale() as "fr" | "en";
  const id = (name: string) => `${name}-${line.id}`;
  return (
    <QuoteActionForm
      action={updateLineAction}
      quoteId={quoteId}
      label={t("editLineNamed", { label: line.label })}
      submitLabel={t("saveLine")}
      successMessage={t("lineSaved")}
    >
      <input type="hidden" name="lineId" value={line.id} />
      <div className="field-row">
        <label htmlFor={id("label")}>
          {t("itemLabel")}
          <input id={id("label")} type="text" name="label" required defaultValue={line.label} />
        </label>
        <label htmlFor={id("quantity")} className="field-fit">
          {t("quantity")}
          <input id={id("quantity")} type="text" inputMode="decimal" name="quantity" required defaultValue={formatDecimal(line.quantityMilli, 3, locale)} className="field-short" />
        </label>
        <label htmlFor={id("unitPrice")} className="field-fit">
          {t("itemUnitPrice")}
          <input id={id("unitPrice")} type="text" inputMode="decimal" name="unitPrice" required defaultValue={formatDecimal(line.unitPriceCents, 2, locale)} className="field-amount" />
        </label>
        <label htmlFor={id("discount")} className="field-fit">
          {t("lineDiscount")}
          <input id={id("discount")} type="text" inputMode="decimal" name="discount" defaultValue={formatDecimal(line.discountBasisPoints, 2, locale)} className="field-short" />
        </label>
        {vatApplicable ? (
          <label htmlFor={id("vatRate")} className="field-fit">
            {t("itemVatRate")}
            <input id={id("vatRate")} type="text" inputMode="decimal" name="vatRate" defaultValue={formatDecimal(line.vatRateBasisPoints, 2, locale)} className="field-short" />
          </label>
        ) : null}
      </div>
      <label htmlFor={id("description")} className="field-wide">
        {t("itemDescription")}
        <input id={id("description")} type="text" name="description" defaultValue={line.description ?? ""} />
      </label>
      <div className="field-row">
        <NatureField idPrefix={`edit-${line.id}`} value={line.nature} line={line} />
        <PlacementFields idPrefix={`edit-${line.id}`} sections={sections} line={line} />
      </div>
    </QuoteActionForm>
  );
}

export function GlobalDiscountForm({ quoteId, discount }: { quoteId: string; discount: GlobalDiscountInput }) {
  const t = useTranslations("Quotes");
  const locale = useLocale() as "fr" | "en";
  const value =
    discount.kind === "percent"
      ? formatDecimal(discount.basisPoints, 2, locale)
      : discount.kind === "amount"
        ? formatDecimal(discount.cents, 2, locale)
        : "";
  return (
    <QuoteActionForm
      action={setGlobalDiscountAction}
      quoteId={quoteId}
      label={t("globalDiscount")}
      submitLabel={t("applyDiscount")}
      successMessage={t("discountApplied")}
      layout="row"
    >
      <label htmlFor="discount-kind" className="field-fit">
        {t("discountKind")}
        <select id="discount-kind" name="kind" defaultValue={discount.kind}>
          <option value="none">{t("discountNone")}</option>
          <option value="percent">{t("discountPercent")}</option>
          <option value="amount">{t("discountAmount")}</option>
        </select>
      </label>
      <label htmlFor="discount-value" className="field-fit">
        {t("discountValue")}
        <input id="discount-value" type="text" inputMode="decimal" name="value" defaultValue={value} className="field-amount" />
      </label>
    </QuoteActionForm>
  );
}

export function ReviseQuoteForm({ quoteId, label }: { quoteId: string; label: string }) {
  const t = useTranslations("Quotes");
  return <QuoteActionForm action={reviseQuoteAction} quoteId={quoteId} label={label} submitLabel={label} successMessage={t("versionCreated")} />;
}

// --- Lot 31a (FAC-01, JUR-08, HUB-21 ; décisions D2, D3, D5) ---

export function AddSectionForm({ quoteId }: { quoteId: string }) {
  const t = useTranslations("Quotes");
  const tRubrics = useTranslations("QuoteRubrics");
  return (
    <QuoteActionForm action={addSectionAction} quoteId={quoteId} label={tRubrics("addSection")} submitLabel={t("addSection")} successMessage={t("sectionAdded")} layout="row">
      <label htmlFor="section-title">
        {t("sectionTitle")}
        <input id="section-title" type="text" name="title" maxLength={120} required />
      </label>
    </QuoteActionForm>
  );
}

export function RenameSectionForm({ quoteId, section }: { quoteId: string; section: QuoteSection }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm
      action={renameSectionAction}
      quoteId={quoteId}
      label={t("renameSectionNamed", { title: section.title })}
      submitLabel={t("renameSection")}
      successMessage={t("sectionRenamed")}
      layout="row"
    >
      <input type="hidden" name="sectionId" value={section.id} />
      <label htmlFor={`section-${section.id}`}>
        {t("sectionTitle")}
        <input id={`section-${section.id}`} type="text" name="title" maxLength={120} required defaultValue={section.title} />
      </label>
    </QuoteActionForm>
  );
}

export function AdvanceKindForm({ quoteId, value }: { quoteId: string; value: AdvanceKind | null }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm action={setAdvanceKindAction} quoteId={quoteId} label={t("advanceKindTitle")} submitLabel={t("advanceKindSave")} successMessage={t("advanceKindSaved")} layout="row">
      <label htmlFor="advance-kind" className="field-fit">
        {t("advanceKindLabel")}
        <select id="advance-kind" name="advanceKind" defaultValue={value ?? ""}>
          <option value="">{t("advanceUnset")}</option>
          <option value="deposit">{t("advanceDeposit")}</option>
          <option value="earnest">{t("advanceEarnest")}</option>
        </select>
      </label>
    </QuoteActionForm>
  );
}

export function ChooseOptionsForm({ quoteId, options }: { quoteId: string; options: QuoteLine[] }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm action={chooseOptionsAction} quoteId={quoteId} label={t("chooseOptionsForClient")} submitLabel={t("chooseOptionsForClient")} successMessage={t("optionsSaved")}>
      <fieldset>
        <legend>{t("optionsTitle")}</legend>
        {options.map((line) => (
          <label key={line.id}>
            <input type="checkbox" name="optionLineIds" value={line.id} defaultChecked={line.optionChosen} />
            {line.label}
          </label>
        ))}
      </fieldset>
    </QuoteActionForm>
  );
}

export function SaveAsTemplateForm({ quoteId, templates }: { quoteId: string; templates: QuoteTemplateSummary[] }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm action={saveAsTemplateAction} quoteId={quoteId} label={t("saveAsTemplate")} submitLabel={t("saveAsTemplate")} successMessage={t("templateSaved")} layout="row">
      {templates.length > 0 ? (
        <label htmlFor="replace-template">
          {t("templateTarget")}
          <select id="replace-template" name="templateId" defaultValue="">
            <option value="">{t("templateTargetNew")}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {t("templateTargetReplace", { name: template.name, version: template.version })}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label htmlFor="template-name">
        {t("templateName")}
        <input id="template-name" type="text" name="name" maxLength={120} />
      </label>
    </QuoteActionForm>
  );
}
