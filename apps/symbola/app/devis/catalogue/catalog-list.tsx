"use client";

// Lot 62b (UX-13, D1) — le catalogue en tableau éditable : une ligne par article (intitulé, catégorie,
// prix, TVA) et deux actions de ligne, « Modifier » et « Archiver », le nom de l'article dans leur nom
// accessible. « Modifier » ouvre la ligne en place, une seule à la fois ; ses champs s'enregistrent à
// la sortie du champ. Plus de liste à puces, de pastilles ni de « Enregistrer l'article » par ligne.
import { useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { AutosaveList, useAutosaveList, useAutosaveRow } from "@/app/ui/autosave-list";
import { archiveCatalogItemAction, saveCatalogItemAction } from "./actions";

export type CatalogLine = {
  id: string;
  label: string;
  description: string;
  category: string;
  unit: string;
  nature: "service" | "goods";
  // Valeurs des champs, déjà mises en forme pour la saisie (« 1500 », « 20 »).
  unitPrice: string;
  vatRate: string;
  // Valeurs affichées dans la ligne (« 1 500,00 € », « 20 % »).
  priceText: string;
  vatText: string;
};

function CatalogEditor({ item }: { item: CatalogLine }) {
  const t = useTranslations("Quotes");
  const { ref, rowProps } = useAutosaveRow((data) => saveCatalogItemAction({}, data), {
    label: item.label,
    description: item.description,
    unit: item.unit,
    unitPrice: item.unitPrice,
    vatRate: item.vatRate,
    category: item.category,
    nature: item.nature,
  });
  const id = (name: string) => `${name}-${item.id}`;
  return (
    <div className="edit-row-open" role="row">
      <div role="cell" ref={ref} {...rowProps}>
        <div className="form-grid form-grid-3" role="group" aria-label={t("editItemNamed", { label: item.label })}>
          <input type="hidden" name="itemId" value={item.id} />
          <label htmlFor={id("label")}>
            {t("itemLabel")}
            <input id={id("label")} type="text" name="label" required defaultValue={item.label} />
          </label>
          <label htmlFor={id("category")}>
            {t("itemCategory")}
            <input id={id("category")} type="text" name="category" defaultValue={item.category} />
          </label>
          <label htmlFor={id("nature")}>
            {t("lineNature")}
            <select id={id("nature")} name="nature" defaultValue={item.nature}>
              <option value="service">{t("lineNatureService")}</option>
              <option value="goods">{t("lineNatureGoods")}</option>
            </select>
          </label>
          <label htmlFor={id("description")} className="span-all">
            {t("itemDescription")}
            <input id={id("description")} type="text" name="description" defaultValue={item.description} />
          </label>
          <div className="field-row span-all">
            <label htmlFor={id("unitPrice")} className="field-fit">
              {t("itemUnitPrice")}
              <input id={id("unitPrice")} className="field-code" type="text" inputMode="decimal" name="unitPrice" required defaultValue={item.unitPrice} />
            </label>
            <label htmlFor={id("unit")} className="field-fit">
              {t("itemUnit")}
              <input id={id("unit")} className="field-code" type="text" name="unit" required defaultValue={item.unit} />
            </label>
            <label htmlFor={id("vatRate")} className="field-fit">
              {t("itemVatRate")}
              <input id={id("vatRate")} className="field-short" type="text" inputMode="decimal" name="vatRate" defaultValue={item.vatRate} />
            </label>
          </div>
        </div>
      </div>
    </div>
  );
}

function CatalogRow({ item, extra, open, onOpen }: { item: CatalogLine; extra: ReactNode; open: boolean; onOpen: (open: boolean) => void }) {
  const t = useTranslations("Quotes");
  const { run } = useAutosaveList();
  const archive = () => {
    const data = new FormData();
    data.set("itemId", item.id);
    void run({ apply: () => archiveCatalogItemAction(data) });
  };
  return (
    <>
      <div className="edit-row" role="row">
        <span role="rowheader" className="edit-cell-name">
          <strong>{item.label}</strong>
          {item.description ? <span className="edit-cell-note">{item.description}</span> : null}
          {extra}
        </span>
        <span role="cell" className="edit-cell-meta">
          {item.category || "—"}
        </span>
        <span role="cell" className="edit-cell-meta num">
          {t("catalogPricePerUnit", { price: item.priceText, unit: item.unit })}
        </span>
        <span role="cell" className="edit-cell-meta num">
          {t("vatRateValue", { rate: item.vatText })}
        </span>
        <span role="cell" className="row-actions">
          <button type="button" className="button-ghost" aria-expanded={open} aria-label={open ? t("closeItemNamed", { label: item.label }) : t("editItemNamed", { label: item.label })} onClick={() => onOpen(!open)}>
            {open ? t("closeItem") : t("editItem")}
          </button>
          <button type="button" className="button-ghost" aria-label={t("archiveItem", { label: item.label })} onClick={archive}>
            {t("archiveItemShort")}
          </button>
        </span>
      </div>
      {open ? <CatalogEditor item={item} /> : null}
    </>
  );
}

export function CatalogList({ items, extras }: { items: CatalogLine[]; extras: Record<string, ReactNode> }) {
  const t = useTranslations("Quotes");
  // Une seule ligne ouverte à la fois.
  const [openId, setOpenId] = useState<string | null>(null);
  return (
    <AutosaveList hint={t("catalogListHint")}>
      <div className="edit-list-scroll settings-list">
        <div className="edit-list catalog-list" role="table" aria-label={t("catalogTableLabel")}>
          <div className="edit-list-head" role="row">
            <span role="columnheader">{t("catalogItem")}</span>
            <span role="columnheader">{t("itemCategory")}</span>
            <span role="columnheader">{t("catalogColumnPrice")}</span>
            <span role="columnheader">{t("catalogColumnVat")}</span>
            <span role="columnheader">
              <span className="sr-only">{t("catalogColumnActions")}</span>
            </span>
          </div>
          {items.map((item) => (
            <CatalogRow key={item.id} item={item} extra={extras[item.id] ?? null} open={openId === item.id} onOpen={(open) => setOpenId(open ? item.id : null)} />
          ))}
        </div>
      </div>
    </AutosaveList>
  );
}
