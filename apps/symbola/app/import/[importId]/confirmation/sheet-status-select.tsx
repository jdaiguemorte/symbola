"use client";

// Lot 63a (HUB-14, recette du 21/11/2026) — statut d'un évènement à créer depuis une fiche PDF,
// enregistré dès qu'il est choisi. Liste contrôlée : la valeur affichée est celle choisie, jamais
// celle du fichier reprise après coup (cause du bogue relevé en recette).
import { useState, useTransition } from "react";
import { saveSheetStatusAction } from "./actions";

export type SheetStatusOption = { value: string; label: string };

export function SheetStatusSelect({
  importId,
  rowIndex,
  label,
  initialStatus,
  options,
  savedText,
  failedText,
}: {
  importId: string;
  rowIndex: number;
  label: string;
  initialStatus: string;
  options: SheetStatusOption[];
  savedText: string;
  failedText: string;
}) {
  const [status, setStatus] = useState(initialStatus);
  const [result, setResult] = useState<"saved" | "failed" | null>(null);
  const [pending, startTransition] = useTransition();
  const id = `status-${rowIndex}`;

  function choose(next: string) {
    const previous = status;
    setStatus(next);
    setResult(null);
    startTransition(async () => {
      const saved = await saveSheetStatusAction(importId, rowIndex, next);
      if (!saved) setStatus(previous);
      setResult(saved ? "saved" : "failed");
    });
  }

  return (
    <li>
      <label htmlFor={id}>{label}</label>
      <select id={id} name={id} value={status} disabled={pending} onChange={(event) => choose(event.target.value)}>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <span role="status" className={result === "failed" ? "notice-error" : "muted"}>
        {result === "saved" ? savedText : result === "failed" ? failedText : ""}
      </span>
    </li>
  );
}
