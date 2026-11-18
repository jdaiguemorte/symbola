"use client";

// Lot 43 (FAC-08, ADR 0087) — « Copier » le RIB ou la référence, pour les recoller dans l'application
// de la banque sans erreur. L'état est annoncé aux lecteurs d'écran.
import { useState } from "react";
import { useTranslations } from "next-intl";

export function CopyButton({ value, label }: { value: string; label: string }) {
  const t = useTranslations("Settlement");
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button-small"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(value);
            setCopied(true);
          } catch {
            setCopied(false);
          }
        }}
      >
        <span aria-hidden="true">{t("copy")}</span>
        <span className="sr-only">{t("copyLabel", { label })}</span>
      </button>
      <span role="status" className="sr-only">
        {copied ? t("copied", { label }) : ""}
      </span>
    </>
  );
}
