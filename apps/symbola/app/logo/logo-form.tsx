"use client";

// Lot 17 (DEV-08) — logo des documents : aperçu, envoi par la route dédiée
// (/logo, SEC-02), retrait. Sur Paramètres › Ventes › Documents et sur
// Entreprise et TVA (décision A).
import { useId } from "react";
import { useTranslations } from "next-intl";
import { useUploadAction } from "@/app/ui/use-upload";
import type { UploadState } from "@/lib/uploads/state";
import { removeLogoAction } from "./actions";

// version : partie opaque de la clé du logo, pour rafraîchir l'image après un
// remplacement ; null s'il n'y a pas de logo.
export function LogoForm({ version }: { version: string | null }) {
  const t = useTranslations("Documents");
  const [state, action, pending] = useUploadAction<UploadState>("/logo");
  const fieldId = useId();

  return (
    <div className="logo-form">
      {version ? (
        // Image privée servie par l'app après contrôle de la session (ADR 0027).
        <img className="logo-preview" src={`/logo?v=${encodeURIComponent(version)}`} alt={t("logoAlt")} />
      ) : (
        <p className="meta">{t("logoNone")}</p>
      )}
      <form action={action} className="logo-upload">
        <label htmlFor={fieldId}>{t("logoField")}</label>
        <input id={fieldId} type="file" name="logo" accept="image/png,image/jpeg" required />
        <button type="submit" disabled={pending}>
          {t("logoSubmit")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
      </form>
      {version ? (
        <form action={removeLogoAction}>
          <button type="submit" className="button-ghost">
            {t("logoRemove")}
          </button>
        </form>
      ) : null}
      <p className="meta">{t("logoHint")}</p>
    </div>
  );
}
