"use client";

// Lot 73b (PRE-01, UX-05, UX-13 ; spécification du lot 73, § 5.2 ; maquette 18) — deux commandes de l'écran
// du carnet :
// - le menu « ⋯ » de l'en-tête, à côté de « Nouveau prestataire » : « Reprendre et importer », « Exporter
//   en CSV », « Exporter en PDF », puis la section « Réglages » et « Paramètres du carnet » (G14 du volet 6 ;
//   le lot 74 en fera la forme commune) ;
// - sur téléphone, la barre de filtres repliée derrière « Filtres » : la recherche reste visible, le reste
//   s'ouvre en panneau du bas, qui finit par « Voir les N fiches ». Le panneau du bas commun est au lot 70f
//   (PR #203, pas encore fusionnée) ; en attendant, celui-ci suit sa forme (feuille de style).
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { TaskPopover, usePopover } from "@/app/ui/task-popover";

export function BookHeaderMenu({ importHref, csvHref, pdfHref, settingsHref }: { importHref: string; csvHref: string; pdfHref: string; settingsHref: string }) {
  const t = useTranslations("VendorBook");
  const menu = usePopover();
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={button} type="button" className="task-menu-button vendor-header-menu" aria-haspopup="menu" aria-controls={menu.id} aria-label={t("headerMenu")} onClick={() => menu.open(button.current)}>
        <span aria-hidden="true">⋯</span>
      </button>
      <TaskPopover handle={menu} label={t("headerMenu")} className="task-menu">
        <div role="menu" aria-label={t("headerMenu")}>
          <Link role="menuitem" href={importHref} data-autofocus onClick={() => menu.close()}>
            <span>{t("importAndTakeOver")}</span>
          </Link>
          <a role="menuitem" href={csvHref} onClick={() => menu.close()}>
            <span>{t("exportCsv")}</span>
          </a>
          <a role="menuitem" href={pdfHref} onClick={() => menu.close()}>
            <span>{t("exportPdf")}</span>
          </a>
          <hr className="task-menu-separator" />
          <p className="task-menu-section">{t("headerMenuSettings")}</p>
          <Link role="menuitem" href={settingsHref} scroll={false} onClick={() => menu.close()}>
            <span>{t("settingsLink")}</span>
          </Link>
        </div>
      </TaskPopover>
    </>
  );
}

export function FiltersPanel({ count, active, clearHref, children }: { count: number; active: number; clearHref: string | null; children: ReactNode }) {
  const t = useTranslations("VendorBook");
  const [open, setOpen] = useState(false);
  return (
    <div className="book-filters" data-open={open ? "true" : undefined}>
      <div className="book-filters-phone-head">
        <button type="button" className="button-secondary" aria-expanded={open} onClick={() => setOpen(true)}>
          {active > 0 ? t("filtersButtonCount", { count: active }) : t("filtersButton")}
        </button>
      </div>
      <div className="book-filters-sheet">
        <div className="book-filters-sheet-head">
          <h2>{t("filtersButton")}</h2>
          {clearHref ? (
            <Link href={clearHref} className="button-link">
              {t("clearShort")}
            </Link>
          ) : null}
        </div>
        {children}
        <button type="button" className="button-primary book-filters-done" onClick={() => setOpen(false)}>
          {t("showRecords", { count })}
        </button>
      </div>
    </div>
  );
}
