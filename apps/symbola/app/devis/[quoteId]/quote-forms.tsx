"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { AdvanceKind, CatalogItem, GlobalDiscountInput, QuoteLine, QuoteSection, QuoteTemplateSummary } from "@/modules/quotes/service";
import { formatDecimal } from "../decimal-input";
import { MissingMentionsList } from "../missing-mentions";
import {
  addCatalogLineAction,
  addFreeLineAction,
  addSectionAction,
  chooseOptionsAction,
  renameSectionAction,
  reviseQuoteAction,
  saveAsTemplateAction,
  sendQuoteAction,
  setAdvanceKindAction,
  setGlobalDiscountAction,
  updateLineAction,
  type QuoteFormState,
} from "./actions";

type Action = (state: QuoteFormState, formData: FormData) => Promise<QuoteFormState>;

// Formulaire d'une action du devis : identifiant caché, bouton, retour
// d'erreur ou de confirmation annoncé aux lecteurs d'écran.
export function QuoteActionForm({
  action,
  quoteId,
  label,
  submitLabel,
  successMessage,
  children,
}: {
  action: Action;
  quoteId: string;
  label: string;
  submitLabel: string;
  successMessage: string;
  children?: ReactNode;
}) {
  const t = useTranslations("Quotes");
  const initialState: QuoteFormState = {};
  const [state, formAction, pending] = useActionState(action, initialState);
  return (
    <form action={formAction} aria-label={label}>
      <input type="hidden" name="quoteId" value={quoteId} />
      {children}
      <button type="submit" disabled={pending}>
        {submitLabel}
      </button>
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
function PlacementFields({ idPrefix, sections, line }: { idPrefix: string; sections: QuoteSection[]; line?: QuoteLine }) {
  const t = useTranslations("Quotes");
  return (
    <>
      {sections.length > 0 ? (
        <>
          <label htmlFor={`${idPrefix}-section`}>{t("lineSection")}</label>
          <select id={`${idPrefix}-section`} name="sectionId" defaultValue={line?.sectionId ?? ""}>
            <option value="">{t("noSection")}</option>
            {sections.map((section) => (
              <option key={section.id} value={section.id}>
                {section.title}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <label className="checkbox-label">
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
    >
      <label htmlFor="catalogItemId">{t("catalogItem")}</label>
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
      <label htmlFor="catalog-quantity">{t("quantity")}</label>
      <input id="catalog-quantity" type="text" inputMode="decimal" name="quantity" required defaultValue="1" />
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
      label={t("addFreeLine")}
      submitLabel={t("addLine")}
      successMessage={t("lineAdded")}
    >
      <label htmlFor="free-label">{t("itemLabel")}</label>
      <input id="free-label" type="text" name="label" required />
      <label htmlFor="free-description">{t("itemDescription")}</label>
      <input id="free-description" type="text" name="description" />
      <label htmlFor="free-unit">{t("itemUnit")}</label>
      <input id="free-unit" type="text" name="unit" required />
      <label htmlFor="free-quantity">{t("quantity")}</label>
      <input id="free-quantity" type="text" inputMode="decimal" name="quantity" required defaultValue="1" />
      <label htmlFor="free-unit-price">{t("itemUnitPrice")}</label>
      <input id="free-unit-price" type="text" inputMode="decimal" name="unitPrice" required />
      {vatApplicable ? (
        <>
          <label htmlFor="free-vat-rate">{t("itemVatRate")}</label>
          <input
            id="free-vat-rate"
            type="text"
            inputMode="decimal"
            name="vatRate"
            defaultValue={formatDecimal(defaultVatRateBasisPoints, 2, locale)}
          />
        </>
      ) : null}
      <PlacementFields idPrefix="free" sections={sections} />
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
      <label htmlFor={id("label")}>{t("itemLabel")}</label>
      <input id={id("label")} type="text" name="label" required defaultValue={line.label} />
      <label htmlFor={id("description")}>{t("itemDescription")}</label>
      <input id={id("description")} type="text" name="description" defaultValue={line.description ?? ""} />
      <label htmlFor={id("quantity")}>{t("quantity")}</label>
      <input id={id("quantity")} type="text" inputMode="decimal" name="quantity" required defaultValue={formatDecimal(line.quantityMilli, 3, locale)} />
      <label htmlFor={id("unitPrice")}>{t("itemUnitPrice")}</label>
      <input id={id("unitPrice")} type="text" inputMode="decimal" name="unitPrice" required defaultValue={formatDecimal(line.unitPriceCents, 2, locale)} />
      <label htmlFor={id("discount")}>{t("lineDiscount")}</label>
      <input id={id("discount")} type="text" inputMode="decimal" name="discount" defaultValue={formatDecimal(line.discountBasisPoints, 2, locale)} />
      {vatApplicable ? (
        <>
          <label htmlFor={id("vatRate")}>{t("itemVatRate")}</label>
          <input id={id("vatRate")} type="text" inputMode="decimal" name="vatRate" defaultValue={formatDecimal(line.vatRateBasisPoints, 2, locale)} />
        </>
      ) : null}
      <PlacementFields idPrefix={`edit-${line.id}`} sections={sections} line={line} />
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
    >
      <label htmlFor="discount-kind">{t("discountKind")}</label>
      <select id="discount-kind" name="kind" defaultValue={discount.kind}>
        <option value="none">{t("discountNone")}</option>
        <option value="percent">{t("discountPercent")}</option>
        <option value="amount">{t("discountAmount")}</option>
      </select>
      <label htmlFor="discount-value">{t("discountValue")}</label>
      <input id="discount-value" type="text" inputMode="decimal" name="value" defaultValue={value} />
    </QuoteActionForm>
  );
}

export function SendQuoteForm({ quoteId }: { quoteId: string }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm
      action={sendQuoteAction}
      quoteId={quoteId}
      label={t("sendQuote")}
      submitLabel={t("sendQuote")}
      successMessage={t("quoteSent")}
    >
      <p>{t("sendQuoteHint")}</p>
    </QuoteActionForm>
  );
}

export function ReviseQuoteForm({ quoteId, label }: { quoteId: string; label: string }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm action={reviseQuoteAction} quoteId={quoteId} label={label} submitLabel={label} successMessage={t("versionCreated")} />
  );
}

// --- Lot 31a (FAC-01, JUR-08, HUB-21 ; décisions D2, D3, D5) ---

export function AddSectionForm({ quoteId }: { quoteId: string }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm action={addSectionAction} quoteId={quoteId} label={t("addSection")} submitLabel={t("addSection")} successMessage={t("sectionAdded")}>
      <label htmlFor="section-title">{t("sectionTitle")}</label>
      <input id="section-title" type="text" name="title" maxLength={120} required />
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
    >
      <input type="hidden" name="sectionId" value={section.id} />
      <label htmlFor={`section-${section.id}`}>{t("sectionTitle")}</label>
      <input id={`section-${section.id}`} type="text" name="title" maxLength={120} required defaultValue={section.title} />
    </QuoteActionForm>
  );
}

export function AdvanceKindForm({ quoteId, value }: { quoteId: string; value: AdvanceKind | null }) {
  const t = useTranslations("Quotes");
  return (
    <QuoteActionForm action={setAdvanceKindAction} quoteId={quoteId} label={t("advanceKindTitle")} submitLabel={t("advanceKindSave")} successMessage={t("advanceKindSaved")}>
      <label htmlFor="advance-kind">{t("advanceKindLabel")}</label>
      <select id="advance-kind" name="advanceKind" defaultValue={value ?? ""}>
        <option value="">{t("advanceUnset")}</option>
        <option value="deposit">{t("advanceDeposit")}</option>
        <option value="earnest">{t("advanceEarnest")}</option>
      </select>
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
          <label key={line.id} className="checkbox-label">
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
    <QuoteActionForm action={saveAsTemplateAction} quoteId={quoteId} label={t("saveAsTemplate")} submitLabel={t("saveAsTemplate")} successMessage={t("templateSaved")}>
      {templates.length > 0 ? (
        <>
          <label htmlFor="replace-template">{t("templateTarget")}</label>
          <select id="replace-template" name="templateId" defaultValue="">
            <option value="">{t("templateTargetNew")}</option>
            {templates.map((template) => (
              <option key={template.id} value={template.id}>
                {t("templateTargetReplace", { name: template.name, version: template.version })}
              </option>
            ))}
          </select>
        </>
      ) : null}
      <label htmlFor="template-name">{t("templateName")}</label>
      <input id="template-name" type="text" name="name" maxLength={120} />
    </QuoteActionForm>
  );
}
