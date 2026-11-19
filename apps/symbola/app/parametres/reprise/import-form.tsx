"use client";

// Lot 35b (HUB-13, D6) — dépôt de l'archive à reprendre, par la route dédiée aux fichiers ; le
// retour (déposée, déjà en cours, refusée) est annoncé aux lecteurs d'écran.
import { useTranslations } from "next-intl";
import { useUploadAction } from "@/app/ui/use-upload";
import type { UploadState } from "@/lib/uploads/state";

export function ImportArchiveForm({ maxSizeLabel }: { maxSizeLabel: string }) {
  const t = useTranslations("OrganizationImport");
  const [state, action, pending] = useUploadAction<UploadState>("/parametres/reprise/envoi");
  return (
    <form action={action} aria-label={t("uploadTitle")} className="stack">
      <label>
        {t("fileLabel")}
        <input type="file" name="archive" accept=".zip,application/zip" required aria-describedby="import-archive-hint" />
      </label>
      <p id="import-archive-hint" className="meta">
        {t("fileHint", { max: maxSizeLabel })}
      </p>
      <button type="submit" disabled={pending}>
        {t("submit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      <p role="status">{state.success ? t("requested") : ""}</p>
    </form>
  );
}
