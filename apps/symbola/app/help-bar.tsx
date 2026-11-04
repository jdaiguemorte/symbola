"use client";

// Lot 10 (AIDE-07) — barre d'aide, en bas de chaque écran de l'équipe :
// progression de la prise en main, reprise de la visite mise de côté sur cet
// écran, ou du tutoriel en cours. Repliable (préférence gardée dans le
// navigateur, sans donnée personnelle).
import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useHelpContext } from "./help-context";

const COLLAPSED_KEY = "symbola_aide_barre_repliee";

export function HelpBar({ completed, total, tutorial }: { completed: number; total: number; tutorial: { title: string; href: string } | null }) {
  const t = useTranslations("HelpBar");
  const help = useHelpContext();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Stockage indisponible (navigation privée) : barre dépliée.
    }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // Sans stockage, le choix vaut pour cette page seulement.
    }
  }

  const tour = help?.tour;
  if (tour?.open) return null;

  return (
    <aside className="help-bar" aria-label={t("label")} data-collapsed={collapsed ? "true" : "false"}>
      {collapsed ? (
        <button type="button" className="help-bar-toggle" onClick={toggle} aria-expanded="false">
          {t("progressShort", { completed, total })}
        </button>
      ) : (
        <>
          <Link href="/aide" className="help-bar-progress">
            {t("progress", { completed, total })}
          </Link>
          {tour && tour.postponedStep !== null ? (
            <button type="button" className="help-bar-resume" onClick={tour.resume}>
              {t("resumeTour", { step: tour.postponedStep + 1 })}
            </button>
          ) : tutorial ? (
            <Link href={tutorial.href} className="help-bar-resume">
              {t("resumeTutorial", { title: tutorial.title })}
            </Link>
          ) : null}
          <button type="button" className="help-bar-toggle" onClick={toggle} aria-expanded="true" aria-label={t("collapse")}>
            ×
          </button>
        </>
      )}
    </aside>
  );
}
