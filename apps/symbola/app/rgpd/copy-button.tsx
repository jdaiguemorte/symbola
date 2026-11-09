"use client";

// Lot 18 (RGPD-07) — copie du modèle de réponse, à coller dans l'e-mail
// envoyé à la personne. Si le presse-papiers est refusé, le texte reste
// sélectionnable à l'écran.
import { useState } from "react";
import { useTranslations } from "next-intl";

export function CopyButton({ text }: { text: string }) {
  const t = useTranslations("Privacy");
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");
  return (
    <>
      <button
        type="button"
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(text);
            setState("copied");
          } catch {
            setState("failed");
          }
        }}
      >
        {t("copyResponse")}
      </button>
      <span role="status" className="meta">
        {state === "copied" ? t("responseCopied") : state === "failed" ? t("responseCopyFailed") : ""}
      </span>
    </>
  );
}
