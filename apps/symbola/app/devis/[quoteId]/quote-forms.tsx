"use client";

import Link from "next/link";
import { useActionState, type ReactNode } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CatalogItem, GlobalDiscountInput, QuoteLine } from "@/modules/quotes/service";
import { formatDecimal } from "../decimal-input";
import {
  addCatalogLineAction,
  addFreeLineAction,
  reviseQuoteAction,
  sendQuoteAction,
  setGlobalDiscountAction,
  updateLineAction,
  type QuoteFormState,
} from "./actions";

type Action = (state: QuoteFormState, formData: FormData) => Promise<QuoteFormState>;

// Formulaire d'une action du devis : identifiant caché, bouton, retour
// d'erreur ou de confirmation annoncé aux lecteurs d'écran.
function QuoteActionForm({
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
      {state.success ? <p role="status">{successMessage}</p> : null}
    </form>
  );
}

export function AddCatalogLineForm({ quoteId, items }: { quoteId: string; items: CatalogItem[] }) {
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
    </QuoteActionForm>
  );
}

export function AddFreeLineForm({ quoteId, vatApplicable, defaultVatRateBasisPoints }: { quoteId: string; vatApplicable: boolean; defaultVatRateBasisPoints: number }) {
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
    </QuoteActionForm>
  );
}

export function EditLineForm({ quoteId, line, vatApplicable }: { quoteId: string; line: QuoteLine; vatApplicable: boolean }) {
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
