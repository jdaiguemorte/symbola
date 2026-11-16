"use client";

// Lot 38b (HUB-21 ; D10) — « Copier le texte » : l'objet puis le texte rempli, dans le presse-papiers,
// pour une messagerie qui n'ouvre pas les liens « mailto ».
import { useState } from "react";
import { useTranslations } from "next-intl";

export function CopyMessageButton({ text }: { text: string }) {
  const t = useTranslations("WriteToClient");
  const [copied, setCopied] = useState(false);
  return (
    <>
      <button
        type="button"
        className="button-ghost"
        onClick={async () => {
          await navigator.clipboard.writeText(text);
          setCopied(true);
        }}
      >
        {t("copy")}
      </button>
      {copied ? <p role="status">{t("copied")}</p> : null}
    </>
  );
}
