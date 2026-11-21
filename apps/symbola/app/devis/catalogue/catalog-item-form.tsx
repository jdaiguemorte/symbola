"use client";

import { useActionState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatDecimal } from "../decimal-input";
import { saveCatalogItemAction, type CatalogFormState } from "./actions";

// DEV-01 — le formulaire d'un nouvel article (un article existant se modifie dans sa ligne du tableau,
// catalog-list.tsx). Lot 62b (UX-12) : formulaire en grille, prix, unité et taux en champs courts.
export function CatalogItemForm({ defaultVatRateBasisPoints }: { defaultVatRateBasisPoints: number }) {
  const t = useTranslations("Quotes");
  const locale = useLocale() as "fr" | "en";
  const initialState: CatalogFormState = {};
  const [state, formAction, pending] = useActionState(saveCatalogItemAction, initialState);
  return (
    <form action={formAction} aria-label={t("newItemTitle")} className="form-grid form-grid-3">
      <label htmlFor="label-new">
        {t("itemLabel")}
        <input id="label-new" type="text" name="label" required />
      </label>
      <label htmlFor="category-new">
        {t("itemCategory")}
        <input id="category-new" type="text" name="category" />
      </label>
      {/* Lot 41 (JUR-02, D9) : bien ou service, repris par chaque ligne de devis. */}
      <label htmlFor="nature-new">
        {t("lineNature")}
        <select id="nature-new" name="nature" defaultValue="service">
          <option value="service">{t("lineNatureService")}</option>
          <option value="goods">{t("lineNatureGoods")}</option>
        </select>
      </label>
      <label htmlFor="description-new" className="span-all">
        {t("itemDescription")}
        <input id="description-new" type="text" name="description" />
      </label>
      <div className="field-row span-all">
        <label htmlFor="unitPrice-new" className="field-fit">
          {t("itemUnitPrice")}
          <input id="unitPrice-new" className="field-code" type="text" inputMode="decimal" name="unitPrice" required />
        </label>
        <label htmlFor="unit-new" className="field-fit">
          {t("itemUnit")}
          <input id="unit-new" className="field-code" type="text" name="unit" required />
        </label>
        <label htmlFor="vatRate-new" className="field-fit">
          {t("itemVatRate")}
          <input id="vatRate-new" className="field-short" type="text" inputMode="decimal" name="vatRate" defaultValue={formatDecimal(defaultVatRateBasisPoints, 2, locale)} />
        </label>
      </div>
      <div className="span-all form-foot">
        <button type="submit" disabled={pending}>
          {t("createItem")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
        {state.success ? <p role="status">{t("itemCreated")}</p> : null}
      </div>
    </form>
  );
}
