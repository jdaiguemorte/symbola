// IMP-03/IMP-04 — lecture des lignes selon les correspondances validées
// (IMP-02) : chaque valeur est convertie au type de son champ (date ISO,
// centimes, points de base, booléen, valeur d'une liste de choix). Une ligne
// dont un champ obligatoire manque ou dont une valeur est invalide porte ses
// motifs : elle sera rejetée au rapport des écarts (IMP-04), jamais écrite.
import { normalizeLabel, profileColumn, type MappableField } from "./mapping";
import { parseAmountCents, parseDate, parsePercentageBasisPoints } from "./values";

export type ImportValue = string | number | boolean | null;

export type RowErrorCode =
  | "required_missing"
  | "invalid_date"
  | "invalid_amount"
  | "invalid_percentage"
  | "invalid_boolean"
  | "invalid_choice";

export type RowError = { fieldKey: string; code: RowErrorCode; value: string };

export type ParsedImportRow = {
  rowIndex: number;
  lineNumber: number;
  // Valeur typée par clé de champ ; null pour une cellule vide.
  values: Record<string, ImportValue>;
  // Colonnes « sans équivalent » : intitulé → texte brut (champs libres, IMP-04).
  extra: Record<string, string>;
  errors: RowError[];
};

export type RowFieldDefinition = MappableField & { required?: true; choices?: readonly string[] };

export type ColumnAssignment = { columnIndex: number; fieldKey: string | null; target: "field" | "none" | "ignore" };

export type ValueSynonyms = {
  choices: Record<string, Record<string, string[]>>;
  booleans: { true: string[]; false: string[] };
};

function normalized(value: string): string {
  return normalizeLabel(value).join(" ");
}

export function parseImportRows(input: {
  headers: string[];
  rows: string[][];
  sourceLineNumbers: number[];
  assignments: ColumnAssignment[];
  fields: readonly RowFieldDefinition[];
  synonyms: ValueSynonyms;
}): ParsedImportRow[] {
  const fieldsByKey = new Map(input.fields.map((field) => [field.key, field]));
  const mapped = input.assignments.filter(
    (assignment): assignment is ColumnAssignment & { fieldKey: string } =>
      assignment.target === "field" && assignment.fieldKey !== null && fieldsByKey.has(assignment.fieldKey),
  );
  const freeColumns = input.assignments.filter((assignment) => assignment.target === "none");

  // Format des dates et des montants déduit de la colonne entière (IMP-02).
  const profiles = new Map(
    mapped.map((assignment) => [assignment.columnIndex, profileColumn(input.rows.map((row) => row[assignment.columnIndex] ?? ""))]),
  );
  const booleanTrue = new Set(input.synonyms.booleans.true.map(normalized));
  const booleanFalse = new Set(input.synonyms.booleans.false.map(normalized));

  return input.rows.map((row, rowIndex) => {
    const values: Record<string, ImportValue> = {};
    const errors: RowError[] = [];

    for (const assignment of mapped) {
      const field = fieldsByKey.get(assignment.fieldKey) as RowFieldDefinition;
      const raw = (row[assignment.columnIndex] ?? "").trim();
      if (raw === "") {
        values[field.key] = null;
        continue;
      }
      const profile = profiles.get(assignment.columnIndex);
      switch (field.kind) {
        case "text":
          values[field.key] = raw;
          break;
        case "date": {
          const date = parseDate(raw, profile?.dateOrder);
          if (date === null) errors.push({ fieldKey: field.key, code: "invalid_date", value: raw });
          values[field.key] = date;
          break;
        }
        case "amount": {
          const cents = parseAmountCents(raw, profile?.decimalStyle);
          if (cents === null) errors.push({ fieldKey: field.key, code: "invalid_amount", value: raw });
          values[field.key] = cents;
          break;
        }
        case "percentage": {
          const basisPoints = parsePercentageBasisPoints(raw);
          if (basisPoints === null) errors.push({ fieldKey: field.key, code: "invalid_percentage", value: raw });
          values[field.key] = basisPoints;
          break;
        }
        case "boolean": {
          const key = normalized(raw);
          if (booleanTrue.has(key)) values[field.key] = true;
          else if (booleanFalse.has(key)) values[field.key] = false;
          else {
            errors.push({ fieldKey: field.key, code: "invalid_boolean", value: raw });
            values[field.key] = null;
          }
          break;
        }
        case "choice": {
          const key = normalized(raw);
          const choices = input.synonyms.choices[field.key] ?? {};
          const choice = (field.choices ?? []).find(
            (candidate) => normalized(candidate) === key || (choices[candidate] ?? []).some((synonym) => normalized(synonym) === key),
          );
          if (!choice) errors.push({ fieldKey: field.key, code: "invalid_choice", value: raw });
          values[field.key] = choice ?? null;
          break;
        }
      }
    }

    for (const field of input.fields) {
      if (!field.required) continue;
      const value = values[field.key];
      const alreadyInvalid = errors.some((error) => error.fieldKey === field.key);
      if ((value === null || value === undefined) && !alreadyInvalid) {
        errors.push({ fieldKey: field.key, code: "required_missing", value: "" });
      }
    }

    const extra: Record<string, string> = {};
    for (const assignment of freeColumns) {
      const raw = (row[assignment.columnIndex] ?? "").trim();
      if (raw !== "") extra[input.headers[assignment.columnIndex] || `#${assignment.columnIndex + 1}`] = raw;
    }

    return { rowIndex, lineNumber: input.sourceLineNumbers[rowIndex] ?? rowIndex + 1, values, extra, errors };
  });
}
