"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { PersonSearchResult, SearchRecord } from "@/lib/privacy/search";
import { searchPersonAction, type SearchFormState, type SearchTerms } from "./actions";
import { previewErasureAction, type ErasurePreviewState } from "./erasure-actions";
import { ErasurePreview, type ErasableRequest } from "./erasure-preview";
import { exportRecordsAction, type ExportFormState } from "./export-actions";

const MODULE_ORDER = ["events", "budget", "quotes", "hub", "hello"];

export type ExportableRequest = { id: string; label: string };

function fieldLabel(t: ReturnType<typeof useTranslations>, key: string): string {
  if (key.startsWith("imported:")) return t("importedField", { name: key.slice("imported:".length) });
  return t.has(`field.${key}`) ? t(`field.${key}`) : key;
}

function recordKey(record: SearchRecord): string {
  return `${record.module}:${record.kind}:${record.recordId}`;
}

export function SearchForm({ exportRequests, erasureRequests }: { exportRequests: ExportableRequest[]; erasureRequests: ErasableRequest[] }) {
  const t = useTranslations("Privacy");
  const initialState: SearchFormState = {};
  const [state, formAction, pending] = useActionState(searchPersonAction, initialState);

  return (
    <>
      <form action={formAction}>
        <p>{t("searchIntro")}</p>
        <label>
          {t("emailLabel")}
          <input type="email" name="email" autoComplete="off" />
        </label>
        <label>
          {t("phoneLabel")}
          <input type="tel" name="phone" autoComplete="off" />
        </label>
        <label>
          {t("nameLabel")}
          <input type="text" name="name" autoComplete="off" />
        </label>
        <button type="submit" disabled={pending}>
          {pending ? t("searching") : t("search")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
      </form>

      {state.result ? <SearchResults key={state.searchId} result={state.result} terms={state.terms ?? {}} exportRequests={exportRequests} erasureRequests={erasureRequests} /> : null}
    </>
  );
}

// RGPD-01 : résultat groupé par module. RGPD-02 : la titulaire coche les
// fiches qui concernent bien la personne (homonymes), puis lance l'export.
function SearchResults({
  result,
  terms,
  exportRequests,
  erasureRequests,
}: {
  result: PersonSearchResult;
  terms: SearchTerms;
  exportRequests: ExportableRequest[];
  erasureRequests: ErasableRequest[];
}) {
  const t = useTranslations("Privacy");
  const initialExport: ExportFormState = {};
  const [exportState, exportAction, exporting] = useActionState(exportRecordsAction, initialExport);
  const initialPreview: ErasurePreviewState = {};
  const [previewState, previewAction, previewing] = useActionState(previewErasureAction, initialPreview);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const byModule = new Map<string, SearchRecord[]>();
  for (const record of result.records) byModule.set(record.module, [...(byModule.get(record.module) ?? []), record]);
  const modules = [...byModule.keys()].sort((a, b) => MODULE_ORDER.indexOf(a) - MODULE_ORDER.indexOf(b));

  const toggle = (key: string, checked: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      if (checked) next.add(key);
      else next.delete(key);
      return next;
    });
  };

  return (
    <section aria-labelledby="privacy-results">
      <h2 id="privacy-results">{t("resultsTitle", { count: result.records.length })}</h2>
      {!result.complete ? (
        <div role="alert">
          <p>{t("incomplete")}</p>
          <ul>
            {result.outcomes
              .filter((outcome) => outcome.status === "failed")
              .map((outcome) => (
                <li key={outcome.module}>{t(`module.${outcome.module}`)}</li>
              ))}
          </ul>
        </div>
      ) : null}
      {result.records.length === 0 ? <p>{result.complete ? t("noData") : t("noDataIncomplete")}</p> : null}

      <form action={exportAction}>
        {/* Termes de la recherche, renvoyés en POST (jamais dans l'URL) pour la relancer côté serveur. */}
        {terms.email ? <input type="hidden" name="email" value={terms.email} /> : null}
        {terms.phone ? <input type="hidden" name="phone" value={terms.phone} /> : null}
        {terms.name ? <input type="hidden" name="name" value={terms.name} /> : null}

        {result.records.length > 0 ? (
          <p>
            {t("selectIntro")}{" "}
            <button type="button" onClick={() => setSelected(new Set(result.records.map(recordKey)))}>
              {t("selectAll")}
            </button>{" "}
            <button type="button" onClick={() => setSelected(new Set())}>
              {t("selectNone")}
            </button>
          </p>
        ) : null}

        {modules.map((module) => (
          <section key={module} aria-labelledby={`privacy-${module}`}>
            <h3 id={`privacy-${module}`}>{t(`module.${module}`)}</h3>
            <ul>
              {byModule.get(module)!.map((record) => {
                const key = recordKey(record);
                return (
                  <li key={key}>
                    <label>
                      <input type="checkbox" name="record" value={key} checked={selected.has(key)} onChange={(event) => toggle(key, event.target.checked)} />{" "}
                      <strong>
                        {t(`kind.${record.kind}`)}
                        {record.label ? ` : ${record.label}` : ""}
                      </strong>
                    </label>{" "}
                    <small>{record.direct ? t("directMatch") : t("relatedMatch")}</small>
                    {Object.keys(record.fields).length > 0 ? (
                      <dl>
                        {Object.entries(record.fields).map(([field, value]) => (
                          <div key={field}>
                            <dt>{fieldLabel(t, field)}</dt>
                            <dd>{value}</dd>
                          </div>
                        ))}
                      </dl>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}

        {result.records.length > 0 ? (
          <fieldset>
            <legend>{t("exportTitle")}</legend>
            <p>{t("exportIntro", { count: selected.size })}</p>
            {exportRequests.length > 0 ? (
              <label>
                {t("exportRequestLabel")}
                <select name="requestId" defaultValue="">
                  <option value="">{t("exportNoRequest")}</option>
                  {exportRequests.map((request) => (
                    <option key={request.id} value={request.id}>
                      {request.label}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <p role="note">
              <strong>{t("exportWarning")}</strong>
            </p>
            <label>
              <input type="checkbox" name="notesAcknowledged" required /> {t("exportConfirm")}
            </label>
            <button type="submit" disabled={exporting || selected.size === 0 || !result.complete}>
              {exporting ? t("exporting") : t("exportSubmit")}
            </button>
            {exportState.error ? <p role="alert">{exportState.error}</p> : null}
            {exportState.exportId ? (
              <div role="status">
                <p>{t("exportDone", { count: exportState.recordCount ?? 0 })}</p>
                <p>
                  <a href={`/rgpd/exports/${exportState.exportId}/pdf`}>{t("downloadPdf")}</a> ·{" "}
                  <a href={`/rgpd/exports/${exportState.exportId}/archive`}>{t("downloadArchive")}</a>
                </p>
              </div>
            ) : null}
          </fieldset>
        ) : null}

        {result.records.length > 0 ? (
          <fieldset>
            <legend>{t("erasurePreviewTitle")}</legend>
            <p>{t("erasurePreviewIntro")}</p>
            {/* Aperçu seulement : rien n'est modifié, l'avertissement de l'export ne s'applique pas. */}
            <button type="submit" formAction={previewAction} formNoValidate disabled={previewing || selected.size === 0 || !result.complete}>
              {previewing ? t("erasurePreviewing") : t("erasurePreviewButton")}
            </button>
            {previewState.error ? <p role="alert">{previewState.error}</p> : null}
          </fieldset>
        ) : null}
      </form>
      {previewState.items ? <ErasurePreview key={previewState.selectedKeys?.join(",")} preview={previewState} terms={terms} erasureRequests={erasureRequests} /> : null}
    </section>
  );
}
