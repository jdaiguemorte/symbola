"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { CatalogItem } from "@/modules/quotes/service";
import { formatDecimal } from "../decimal-input";
import { saveCatalogItemAction, type CatalogFormState } from "./actions";

// DEV-01 — un même formulaire crée un article ou modifie un article existant.
export function CatalogItemForm({ item, defaultVatRateBasisPoints }: { item?: CatalogItem; defaultVatRateBasisPoints: number }) {
  const t = useTranslations("Quotes");
  const locale = useLocale() as "fr" | "en";
  const initialState: CatalogFormState = {};
  const [state, formAction, pending] = useActionState(saveCatalogItemAction, initialState);
  const suffix = item ? `-${item.id}` : "-new";

  return (
    <form action={formAction} aria-label={item ? t("editItemNamed", { label: item.label }) : t("newItemTitle")}>
      {item ? <input type="hidden" name="itemId" value={item.id} /> : null}
      <label htmlFor={`label${suffix}`}>{t("itemLabel")}</label>
      <input id={`label${suffix}`} type="text" name="label" required defaultValue={item?.label ?? ""} />
      <label htmlFor={`description${suffix}`}>{t("itemDescription")}</label>
      <input id={`description${suffix}`} type="text" name="description" defaultValue={item?.description ?? ""} />
      <label htmlFor={`unit${suffix}`}>{t("itemUnit")}</label>
      <input id={`unit${suffix}`} type="text" name="unit" required defaultValue={item?.unit ?? ""} />
      <label htmlFor={`unitPrice${suffix}`}>{t("itemUnitPrice")}</label>
      <input
        id={`unitPrice${suffix}`}
        type="text"
        inputMode="decimal"
        name="unitPrice"
        required
        defaultValue={item ? formatDecimal(item.unitPriceCents, 2, locale) : ""}
      />
      <label htmlFor={`vatRate${suffix}`}>{t("itemVatRate")}</label>
      <input
        id={`vatRate${suffix}`}
        type="text"
        inputMode="decimal"
        name="vatRate"
        defaultValue={formatDecimal(item?.vatRateBasisPoints ?? defaultVatRateBasisPoints, 2, locale)}
      />
      <label htmlFor={`category${suffix}`}>{t("itemCategory")}</label>
      <input id={`category${suffix}`} type="text" name="category" defaultValue={item?.category ?? ""} />
      <button type="submit" disabled={pending}>
        {item ? t("saveItem") : t("createItem")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{item ? t("itemSaved") : t("itemCreated")}</p> : null}
    </form>
  );
}
