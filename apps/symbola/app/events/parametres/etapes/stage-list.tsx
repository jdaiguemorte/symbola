"use client";

// Lot 62b (UX-13, D1) — les étapes du pipeline en tableau éditable : le nom s'enregistre à la sortie
// du champ ; « Monter », « Descendre » et « Retirer » sont des actions de ligne (le nom de l'étape est
// dans leur nom accessible). Une étape qui contient des cartes ouvre la ligne, le temps de choisir
// l'étape où elles passent. Une carte par étape et son bouton « Renommer » : plus maintenant.
import { useState } from "react";
import { useTranslations } from "next-intl";
import { AutosaveList, useAutosaveList, useAutosaveRow } from "@/app/ui/autosave-list";
import { moveStageAction, removeStageAction, renameStageAction } from "./actions";

export type StageLine = { id: string; label: string; cardCount: number };

function data(values: Record<string, string>): FormData {
  const form = new FormData();
  for (const [name, value] of Object.entries(values)) form.set(name, value);
  return form;
}

function StageRow({ stage, index, stages, removable, removing, onRemoving }: { stage: StageLine; index: number; stages: StageLine[]; removable: boolean; removing: boolean; onRemoving: (open: boolean) => void }) {
  const t = useTranslations("Pipeline.settings");
  const { run } = useAutosaveList();
  const { ref, rowProps } = useAutosaveRow((form) => renameStageAction(form), { label: stage.label });
  const others = stages.filter((other) => other.id !== stage.id);
  const [destination, setDestination] = useState(others[0]?.id ?? "");

  const move = (direction: "up" | "down") =>
    void run({
      apply: () => moveStageAction(data({ stageId: stage.id, direction })),
      revert: () => moveStageAction(data({ stageId: stage.id, direction: direction === "up" ? "down" : "up" })),
    });
  const remove = (destinationId: string | null) =>
    void run({ apply: () => removeStageAction(data({ stageId: stage.id, ...(destinationId ? { destinationId } : {}) })) }).then((done) => {
      if (done) onRemoving(false);
    });

  return (
    <>
      <div className="edit-row" role="row" ref={ref} {...rowProps}>
        <input type="hidden" name="stageId" value={stage.id} />
        <span role="cell" className="edit-cell-rank num">
          {index + 1}
        </span>
        <span role="cell" className="edit-cell">
          <input type="text" name="label" required maxLength={60} defaultValue={stage.label} aria-label={t("stageLabel", { position: index + 1 })} />
        </span>
        <span role="cell" className="edit-cell-meta">
          {t("cards", { count: stage.cardCount })}
        </span>
        <span role="cell" className="row-actions">
          <button type="button" className="button-ghost" disabled={index === 0} aria-label={t("upLabel", { stage: stage.label })} onClick={() => move("up")}>
            {t("up")}
          </button>
          <button type="button" className="button-ghost" disabled={index === stages.length - 1} aria-label={t("downLabel", { stage: stage.label })} onClick={() => move("down")}>
            {t("down")}
          </button>
          {removable ? (
            <button type="button" className="button-ghost" aria-label={t("removeLabel", { stage: stage.label })} aria-expanded={stage.cardCount > 0 ? removing : undefined} onClick={() => (stage.cardCount > 0 ? onRemoving(!removing) : remove(null))}>
              {t("remove")}
            </button>
          ) : null}
        </span>
      </div>
      {removing ? (
        <div className="edit-row-open" role="row">
          <div role="cell" className="form-inline">
            <label>
              {t("destinationFor", { stage: stage.label })}
              <select value={destination} onChange={(event) => setDestination(event.target.value)}>
                {others.map((other) => (
                  <option key={other.id} value={other.id}>
                    {other.label}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="button-danger" disabled={destination === ""} onClick={() => remove(destination)}>
              {t("removeConfirm")}
            </button>
            <button type="button" className="button-ghost" onClick={() => onRemoving(false)}>
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function StageList({ stages, minimum }: { stages: StageLine[]; minimum: number }) {
  const t = useTranslations("Pipeline.settings");
  // Une seule ligne ouverte à la fois.
  const [removingId, setRemovingId] = useState<string | null>(null);
  return (
    <AutosaveList>
      <div className="edit-list-scroll settings-list">
        <div className="edit-list pipeline-stages-list" role="table" aria-label={t("tableLabel")}>
          <div className="edit-list-head" role="row">
            <span role="columnheader">{t("columnRank")}</span>
            <span role="columnheader">{t("columnStage")}</span>
            <span role="columnheader">{t("columnCards")}</span>
            <span role="columnheader">
              <span className="sr-only">{t("columnActions")}</span>
            </span>
          </div>
          {stages.map((stage, index) => (
            <StageRow key={stage.id} stage={stage} index={index} stages={stages} removable={stages.length > minimum} removing={removingId === stage.id} onRemoving={(open) => setRemovingId(open ? stage.id : null)} />
          ))}
        </div>
      </div>
    </AutosaveList>
  );
}
