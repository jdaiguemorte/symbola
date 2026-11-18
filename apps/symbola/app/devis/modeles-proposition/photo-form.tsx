"use client";

// Lot 43 (FAC-02, D2) — les photos d'un modèle de proposition (trois au plus) : envoi par la route
// dédiée aux fichiers, retrait.
import { useId } from "react";
import { useTranslations } from "next-intl";
import { useUploadAction } from "@/app/ui/use-upload";
import type { UploadState } from "@/lib/uploads/state";
import { removeProposalPhotoAction } from "./actions";

export function ProposalPhotosForm({ templateId, count, version }: { templateId: string; count: number; version: number }) {
  const t = useTranslations("ProposalTemplates");
  const [state, action, pending] = useUploadAction<UploadState>(`/devis/modeles-proposition/${templateId}/photos`);
  const fieldId = useId();
  return (
    <div className="proposal-photos-form">
      {count > 0 ? (
        <ul className="proposal-photos">
          {Array.from({ length: count }, (_, index) => (
            <li key={index}>
              <img src={`/devis/modeles-proposition/${templateId}/photos/${index + 1}?v=${version}`} alt={t("photoAlt", { number: index + 1 })} />
              <form action={removeProposalPhotoAction}>
                <input type="hidden" name="templateId" value={templateId} />
                <input type="hidden" name="index" value={index} />
                <button type="submit" className="button-ghost">
                  {t("photoRemove", { number: index + 1 })}
                </button>
              </form>
            </li>
          ))}
        </ul>
      ) : (
        <p className="meta">{t("photosNone")}</p>
      )}
      {count < 3 ? (
        <form action={action}>
          <label htmlFor={fieldId}>{t("photoField")}</label>
          <input id={fieldId} type="file" name="photo" accept="image/png,image/jpeg" required />
          <button type="submit" disabled={pending}>
            {t("photoSubmit")}
          </button>
          {state.error ? <p role="alert">{state.error}</p> : null}
          {state.success ? <p role="status">{t("photoAdded")}</p> : null}
        </form>
      ) : null}
      <p className="meta">{t("photosHint")}</p>
    </div>
  );
}
