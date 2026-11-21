"use client";

// Lot 63b (HUB-14, UX-15) — « On voit que ça charge » : dès le clic sur « Importer », une fenêtre
// (DESIGN.md, « Fenêtre ») montre les étapes (fichier lu, colonnes reconnues, doublons, aperçu),
// celle en cours et, quand on la connaît, la ligne en cours. Rien n'est encore enregistré ; la
// fermer n'arrête pas l'import. Sur ordinateur, un <dialog> modal (focus gardé dedans, Échap
// ferme) ; sur téléphone, le même contenu en haut de la page (dialog non modal, dans le flux).
import { useEffect, useId, useRef } from "react";
import { useTranslations } from "next-intl";

export type ImportLoadingStep = "file" | "columns" | "matches" | "preview";
const STEPS: ImportLoadingStep[] = ["file", "columns", "matches", "preview"];

export type ImportLoadingProgress = {
  current: ImportLoadingStep;
  // Ce qu'on sait déjà : lignes lues, colonnes reconnues sur le total.
  rows?: number;
  recognized?: number;
  columns?: number;
  // Avancement réel d'un traitement de fond (fiches PDF lues), sinon rien.
  done?: number;
  total?: number;
};

const DESKTOP = "(min-width: 768px)";

export function ImportLoading({ open, fileName, progress, onClose }: { open: boolean; fileName: string | null; progress: ImportLoadingProgress; onClose: () => void }) {
  const t = useTranslations("Import");
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (window.matchMedia(DESKTOP).matches) dialog.showModal();
      else dialog.show();
    }
    if (!open && dialog.open) dialog.close();
  }, [open]);

  const currentIndex = STEPS.indexOf(progress.current);
  const stepText = (step: ImportLoadingStep): string => {
    switch (step) {
      case "file":
        return progress.rows !== undefined ? t("loading.fileDone", { count: progress.rows }) : t("loading.file");
      case "columns":
        return progress.recognized !== undefined && progress.columns !== undefined ? t("loading.columnsDone", { recognized: progress.recognized, total: progress.columns }) : t("loading.columns");
      case "matches":
        return progress.current === "matches" && progress.done !== undefined && progress.total !== undefined ? t("loading.matchesAt", { done: progress.done, total: progress.total }) : t("loading.matches");
      case "preview":
        return t("loading.preview");
    }
  };
  const percent = Math.round(((currentIndex + (progress.done !== undefined && progress.total ? progress.done / progress.total : 0.5)) / STEPS.length) * 100);

  return (
    <dialog ref={ref} className="import-loading" aria-labelledby={titleId} aria-describedby={bodyId} onClose={onClose} onCancel={onClose}>
      <h2 id={titleId}>{t("loading.title")}</h2>
      {fileName ? <p className="meta">{progress.rows !== undefined ? t("loading.fileLine", { fileName, count: progress.rows }) : fileName}</p> : null}
      <progress value={percent} max={100} aria-label={t("loading.progressLabel")} aria-valuetext={stepText(progress.current)} />
      <ol className="import-loading-steps">
        {STEPS.map((step, index) => (
          <li key={step} className={index < currentIndex ? "is-done" : index === currentIndex ? "is-current" : undefined} aria-current={index === currentIndex ? "step" : undefined}>
            <span className="import-loading-mark" aria-hidden="true">
              {index < currentIndex ? "✓" : index + 1}
            </span>
            <span>
              {stepText(step)}
              {index < currentIndex ? <span className="sr-only"> ({t("stepDone")})</span> : null}
            </span>
          </li>
        ))}
      </ol>
      <p id={bodyId} className="meta" role="status" aria-live="polite">
        {t("loading.nothingSaved")}
      </p>
      <form method="dialog" className="import-loading-actions">
        <button type="submit" className="button-secondary">
          {t("loading.close")}
        </button>
      </form>
    </dialog>
  );
}
