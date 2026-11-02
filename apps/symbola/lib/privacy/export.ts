// RGPD-02 — export des données d'une personne (droits d'accès et de
// portabilité, ADR 0023) : sur les fiches que la titulaire a sélectionnées
// parmi le résultat de la recherche transverse, jamais sur « tout ce qui
// contient le terme ». La recherche est relancée côté serveur avec les mêmes
// termes : seules des fiches réellement trouvées dans l'organisation peuvent
// être exportées, quoi que contienne le formulaire. Produit un PDF lisible
// (mise en page dans app/rgpd/export-pdf.tsx) et une archive ZIP
// réutilisable (JSON et un CSV par module).
import { createZip, toCsv, type PersonTerms } from "@symbola/privacy";
import { searchPerson, type SearchRecord } from "./search";

export const MODULE_ORDER = ["events", "budget", "quotes", "hub", "hello"];
export const EXPORT_FORMAT = "symbola.privacy-export/v1";

// Identifiant d'une fiche dans le formulaire : « module:nature:identifiant ».
export function recordKey(record: Pick<SearchRecord, "module" | "kind" | "recordId">): string {
  return `${record.module}:${record.kind}:${record.recordId}`;
}

export type SelectionResult =
  | { status: "ok"; records: SearchRecord[] }
  // Un module n'a pas répondu : l'export serait peut-être incomplet.
  | { status: "incomplete" }
  // Une fiche cochée n'est plus trouvée (modifiée, supprimée, ou étrangère).
  | { status: "changed" }
  | { status: "empty" };

export async function selectRecordsForExport(
  input: { organizationId: string; terms: PersonTerms; selectedKeys: string[] },
  options: Parameters<typeof searchPerson>[1] = {},
): Promise<SelectionResult> {
  const selected = new Set(input.selectedKeys);
  if (selected.size === 0) return { status: "empty" };
  const result = await searchPerson({ organizationId: input.organizationId, terms: input.terms }, options);
  if (!result) return { status: "empty" };
  if (!result.complete) return { status: "incomplete" };
  const records = result.records.filter((record) => selected.has(recordKey(record)));
  if (records.length !== selected.size) return { status: "changed" };
  return { status: "ok", records: sortRecords(records) };
}

function sortRecords(records: SearchRecord[]): SearchRecord[] {
  return [...records].sort(
    (a, b) => MODULE_ORDER.indexOf(a.module) - MODULE_ORDER.indexOf(b.module) || a.kind.localeCompare(b.kind) || a.label.localeCompare(b.label),
  );
}

// Libellés traduits, fournis par l'appelant dans la langue de la titulaire.
export type ExportLabels = {
  title: string;
  intro: string;
  generatedAt: string;
  person: string | null;
  organizationName: string;
  module: (module: string) => string;
  kind: (kind: string) => string;
  field: (field: string) => string;
  noFields: string;
  page: (current: number, total: number) => string;
};

export type ExportPdfModel = {
  language: string;
  title: string;
  intro: string;
  generatedAt: string;
  person: string | null;
  organizationName: string;
  noFields: string;
  page: (current: number, total: number) => string;
  sections: { title: string; records: { heading: string; fields: { label: string; value: string }[] }[] }[];
};

function groupByModule(records: SearchRecord[]): Map<string, SearchRecord[]> {
  const byModule = new Map<string, SearchRecord[]>();
  for (const record of sortRecords(records)) byModule.set(record.module, [...(byModule.get(record.module) ?? []), record]);
  return byModule;
}

export function buildExportPdfModel(records: SearchRecord[], labels: ExportLabels, language: string): ExportPdfModel {
  return {
    language,
    title: labels.title,
    intro: labels.intro,
    generatedAt: labels.generatedAt,
    person: labels.person,
    organizationName: labels.organizationName,
    noFields: labels.noFields,
    page: labels.page,
    sections: [...groupByModule(records)].map(([module, moduleRecords]) => ({
      title: labels.module(module),
      records: moduleRecords.map((record) => ({
        heading: record.label ? `${labels.kind(record.kind)} : ${record.label}` : labels.kind(record.kind),
        fields: Object.entries(record.fields).map(([key, value]) => ({ label: labels.field(key), value })),
      })),
    })),
  };
}

// Archive réutilisable : donnees.json (toutes les fiches), un CSV par module
// (une ligne par champ, intitulés techniques stables) et le PDF lisible.
export function buildExportArchive(input: { records: SearchRecord[]; pdf: Buffer; generatedAt: Date; organizationName: string }): Buffer {
  const byModule = groupByModule(input.records);
  const json = {
    format: EXPORT_FORMAT,
    generatedAt: input.generatedAt.toISOString(),
    organization: input.organizationName,
    modules: Object.fromEntries(
      [...byModule].map(([module, records]) => [
        module,
        records.map((record) => ({ kind: record.kind, id: record.recordId, label: record.label, eventId: record.eventId, fields: record.fields })),
      ]),
    ),
  };
  const csvFiles = [...byModule].map(([module, records]) => {
    const rows: string[][] = [["kind", "id", "label", "event_id", "field", "value"]];
    for (const record of records) {
      const base = [record.kind, record.recordId, record.label, record.eventId ?? ""];
      const fields = Object.entries(record.fields);
      if (fields.length === 0) rows.push([...base, "", ""]);
      for (const [field, value] of fields) rows.push([...base, field, value]);
    }
    return { name: `csv/${module}.csv`, data: toCsv(rows) };
  });
  return createZip(
    [{ name: "donnees.json", data: `${JSON.stringify(json, null, 2)}\n` }, ...csvFiles, { name: "export.pdf", data: input.pdf }],
    input.generatedAt,
  );
}
