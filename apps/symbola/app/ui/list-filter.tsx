"use client";

// Lot 20 (décision 3) — filtre d'une longue liste de réglages (étiquettes,
// types, modèles…) : il n'apparaît qu'au-delà de 10 éléments, filtre à la
// saisie les éléments marqués data-filter-item de la liste visée et dit
// combien restent affichés. Sans JavaScript, la liste reste entière.
import { useEffect, useId, useState } from "react";
import { useTranslations } from "next-intl";

export const LIST_FILTER_THRESHOLD = 10;

export function ListFilter({ targetId, total, label }: { targetId: string; total: number; label?: string }) {
  const t = useTranslations("Common");
  const inputId = useId();
  const [term, setTerm] = useState("");
  const [shown, setShown] = useState(total);

  useEffect(() => {
    const root = document.getElementById(targetId);
    if (!root) return;
    const query = term.trim().toLocaleLowerCase("fr");
    let count = 0;
    root.querySelectorAll<HTMLElement>("[data-filter-item]").forEach((item) => {
      const match = !query || (item.dataset.filterItem || item.textContent || "").toLocaleLowerCase("fr").includes(query);
      item.hidden = !match;
      if (match) count += 1;
    });
    setShown(count);
    // Lot 21 : recalculé aussi quand la liste change (étiquettes ajoutées ou rangées).
  }, [targetId, term, total]);

  if (total <= LIST_FILTER_THRESHOLD) return null;
  return (
    <div className="list-filter" role="search">
      <label htmlFor={inputId}>{label ?? t("filterLabel")}</label>
      <input id={inputId} type="search" value={term} onChange={(event) => setTerm(event.target.value)} autoComplete="off" aria-controls={targetId} />
      <p className="meta" role="status">
        {t("filterCount", { shown, total })}
      </p>
    </div>
  );
}
