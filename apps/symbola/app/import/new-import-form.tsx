"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { ImportEntityType } from "@/modules/hub/service";
import { useUploadAction } from "@/app/ui/use-upload";
import type { StartImportFormState } from "./actions";
import { ImportLoading } from "./import-loading";

export function NewImportForm({
  entityTypes,
  maxSizeLabel,
  maxSheets,
  defaultEntityType = null,
  target = null,
  takeover = null,
}: {
  entityTypes: ImportEntityType[];
  // Lot 65g (HUB-14, BUD-04) : l'évènement d'où l'import est lancé ; toutes les lignes y vont.
  target?: { eventId: string; names: string } | null;
  // Lot 71b (HUB-14) : la ligne de reprise d'où vient le fichier ; l'import y est rattaché.
  takeover?: { takeoverId: string; kind: string } | null;
  maxSizeLabel: string;
  maxSheets: number;
  // Lot 14 (IMP-09) : type choisi depuis une carte de reprise.
  defaultEntityType?: ImportEntityType | null;
}) {
  const t = useTranslations("Import");
  // Lot 16 (L16-SEC-02) : le fichier part par sa route dédiée, pas par une action serveur.
  const [state, formAction, pending] = useUploadAction<StartImportFormState>("/import/envoi");
  // Lot 14c (IMP-08) : des fiches événement PDF, plusieurs à la fois.
  const [entityType, setEntityType] = useState<ImportEntityType | "">(defaultEntityType ?? (entityTypes.length === 1 ? entityTypes[0]! : ""));
  const sheets = entityType === "event_sheets";
  // Lot 71e : un PDF de prestataires retenus ou de programme, un seul fichier.
  const pdf = entityType === "event_vendors" || entityType === "program";
  // Lot 63b (HUB-14, UX-15) : la fenêtre de chargement s'ouvre au clic, avant la réponse.
  const [loading, setLoading] = useState<{ fileName: string | null } | null>(null);
  // Une erreur rendue par la route ferme la fenêtre : le message s'affiche sous le formulaire.
  const wasPending = useRef(false);
  useEffect(() => {
    if (wasPending.current && !pending && state.error) setLoading(null);
    wasPending.current = pending;
  }, [pending, state.error]);

  return (
    <>
      {/* Lot 63b : la fenêtre est à côté du formulaire, jamais dedans (pas de formulaire imbriqué). */}
      <ImportLoading
        open={loading !== null}
        fileName={loading?.fileName ?? null}
        progress={state.reading && !pending ? { current: sheets ? "file" : "matches", rows: state.reading.rows, recognized: state.reading.recognized, columns: state.reading.columns } : { current: "file" }}
        onClose={() => setLoading(null)}
      />
      <form
        action={formAction}
        id="import-form"
        onSubmit={(event) => {
          const input = event.currentTarget.querySelector<HTMLInputElement>('input[type="file"]');
          const files = input?.files ? Array.from(input.files) : [];
          setLoading({ fileName: files.length > 1 ? t("loading.files", { count: files.length }) : (files[0]?.name ?? null) });
        }}
      >
        {/* Lot 16 (IMP-11) : une reprise choisie par sa tuile n'a plus de choix à faire. */}
        {takeover ? (
          <>
            <input type="hidden" name="takeoverId" value={takeover.takeoverId} />
            <input type="hidden" name="takeoverKind" value={takeover.kind} />
          </>
        ) : null}
        {target ? (
          <>
            <input type="hidden" name="targetEventId" value={target.eventId} />
            <p className="notice">{t("targetEvent", { names: target.names })}</p>
          </>
        ) : null}
        {entityTypes.length === 1 ? (
          <input type="hidden" name="entityType" value={entityTypes[0]} />
        ) : (
          <fieldset>
            <legend>{t("entityTypeLegend")}</legend>
            {entityTypes.map((type) => (
              <label key={type}>
                <input type="radio" name="entityType" value={type} required defaultChecked={type === defaultEntityType} onChange={() => setEntityType(type)} />
                {t(`entityType.${type}`)}
              </label>
            ))}
          </fieldset>
        )}
        {pdf ? (
          <>
            <label>
              {t("pdfFileLabel")}
              <input key="pdf" type="file" name="file" accept=".pdf,application/pdf" required aria-describedby="import-file-hint" />
            </label>
            <p id="import-file-hint">{t("pdfFileHint", { maxSize: maxSizeLabel })}</p>
          </>
        ) : sheets ? (
          <>
            <label>
              {t("sheetsLabel")}
              <input key="sheets" type="file" name="file" accept=".pdf,application/pdf" multiple={maxSheets > 1} required aria-describedby="import-file-hint" />
            </label>
            <p id="import-file-hint">{t("sheetsHint", { maxSize: maxSizeLabel, count: maxSheets })}</p>
          </>
        ) : (
          <>
            <label>
              {t("fileLabel")}
              <input
                key="table"
                type="file"
                name="file"
                accept=".csv,.txt,.tsv,.xlsx,.json,text/csv,text/plain,application/json,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                required
                aria-describedby="import-file-hint"
              />
            </label>
            <p id="import-file-hint">{t("fileHint", { maxSize: maxSizeLabel })}</p>
            {/* Lot 67a (HUB-14 ; recette du 24/11, R07) : dire quels PDF se lisent, et où. */}
            <p className="meta">{t("pdfHint")}</p>
          </>
        )}
        <button type="submit" disabled={pending}>
          {pending ? t("reading") : t("startImport")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
      </form>
    </>
  );
}
