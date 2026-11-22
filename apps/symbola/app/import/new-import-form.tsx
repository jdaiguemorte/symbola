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
}: {
  entityTypes: ImportEntityType[];
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
        {sheets ? (
          <>
            <label>
              {t("sheetsLabel")}
              <input key="sheets" type="file" name="file" accept=".pdf,application/pdf" multiple required aria-describedby="import-file-hint" />
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
