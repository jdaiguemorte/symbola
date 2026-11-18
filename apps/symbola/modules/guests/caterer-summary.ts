// Lot 50 (INV-06 ; D5 à D8) — règles pures de la synthèse pour le traiteur, par temps fort à table :
// totaux (couverts, repas par type, régimes et allergènes), puis chaque table dans l'ordre du plan et
// les présents encore sans table ; les personnes « en attente de réponse » et les repas des
// prestataires à part, jamais dans les couverts. Version nominative (la titulaire) ou agrégée, avec
// des nombres exacts (D6 : un traiteur ne sert pas « moins de 3 » assiettes). Rien n'est stocké (D8).
import type { CatererCount, CatererGroup, CatererPerson, CatererSummary, CatererSummaryVersion, CatererTable, SeatingMoment, SeatingShape } from "@symbola/contracts";

export type CatererSummaryInput = {
  version: CatererSummaryVersion;
  eventId: string;
  keyMoment: SeatingMoment;
  generatedAt: Date;
  dietsPurged: boolean;
  // null : pas de plan pour ce temps fort (totaux seulement).
  tables: { id: string; name: string; shape: SeatingShape; capacity: number }[] | null;
  people: { id: string; name: string; status: "present" | "pending"; tableId: string | null; mealTypeId: string | null; dietOptionIds: string[] }[];
  // Liste de l'organisation, dans son ordre.
  mealTypes: { id: string; label: string; hidden: boolean }[];
  dietOptions: { id: string; label: string; kind: "diet" | "allergen" }[];
  vendorMeals: number;
  vendorMealTypeId: string | null;
  vendorLabel?: string;
};

type Person = CatererSummaryInput["people"][number];

function counts(people: readonly Person[], columns: readonly { id: string; label: string }[], pick: (person: Person) => readonly (string | null)[]): CatererCount[] {
  const tally = new Map<string, number>();
  for (const person of people) for (const id of new Set(pick(person))) if (id) tally.set(id, (tally.get(id) ?? 0) + 1);
  return columns.flatMap((column) => (tally.get(column.id) ? [{ id: column.id, label: column.label, count: tally.get(column.id)! }] : []));
}

export function buildCatererSummary(input: CatererSummaryInput): CatererSummary {
  const nominative = input.version === "nominative";
  const present = input.people.filter((person) => person.status === "present");
  const pending = input.people.filter((person) => person.status === "pending");
  const usedMeals = new Set(input.people.map((person) => person.mealTypeId));
  const mealTypes = input.mealTypes.filter((type) => !type.hidden || usedMeals.has(type.id) || type.id === input.vendorMealTypeId).map(({ id, label }) => ({ id, label }));
  const usedDiets = new Set(input.people.flatMap((person) => person.dietOptionIds));
  const dietOptions = input.dietOptions.filter((option) => usedDiets.has(option.id));
  const mealLabel = new Map(input.mealTypes.map((type) => [type.id, type.label]));
  const dietLabel = new Map(input.dietOptions.map((option) => [option.id, option.label]));
  const dietOrder = new Map(input.dietOptions.map((option, index) => [option.id, index]));

  const person = (entry: Person): CatererPerson => ({
    name: entry.name,
    mealType: entry.mealTypeId ? (mealLabel.get(entry.mealTypeId) ?? "") : "",
    diets: [...new Set(entry.dietOptionIds)].filter((id) => dietLabel.has(id)).sort((a, b) => dietOrder.get(a)! - dietOrder.get(b)!).map((id) => dietLabel.get(id)!),
  });
  const group = (people: readonly Person[]): CatererGroup => ({
    covers: people.length,
    meals: counts(people, mealTypes, (entry) => [entry.mealTypeId]),
    diets: counts(people, dietOptions, (entry) => entry.dietOptionIds),
    people: nominative ? people.map(person) : null,
  });

  const tables: CatererTable[] = [];
  if (input.tables) {
    for (const table of input.tables) {
      tables.push({ id: table.id, name: table.name, shape: table.shape, capacity: table.capacity, ...group(present.filter((entry) => entry.tableId === table.id)) });
    }
    const known = new Set(input.tables.map((table) => table.id));
    const unplaced = present.filter((entry) => !entry.tableId || !known.has(entry.tableId));
    if (unplaced.length > 0) tables.push({ id: null, name: "", shape: null, capacity: null, ...group(unplaced) });
  }

  return {
    version: input.version,
    eventId: input.eventId,
    keyMoment: input.keyMoment,
    generatedAt: input.generatedAt.toISOString(),
    planComposed: input.tables !== null,
    dietsPurged: input.dietsPurged,
    mealTypes,
    dietOptions,
    totals: group(present),
    tables,
    vendorMeals: { count: input.vendorMeals, label: (input.vendorMealTypeId ? mealLabel.get(input.vendorMealTypeId) : undefined) ?? input.vendorLabel ?? "", mealTypeId: input.vendorMealTypeId },
    pending: group(pending),
  };
}

export type CatererCsvLabels = {
  table: string;
  name: string;
  mealType: string;
  diets: string;
  count: string;
  response: string;
  covers: string;
  unplaced: string;
  total: string;
  vendorMeals: string;
  pending: string;
  present: string;
};

// D7 : CSV (séparateur « ; », marque d'ordre des octets et neutralisation : toCsv de @symbola/privacy).
// Agrégé : une ligne par table, une colonne par type de repas et par régime ; nominatif : une ligne
// par personne (présents, puis repas prestataires, puis personnes en attente). Nombres en chiffres.
export function catererCsvTable(summary: CatererSummary, labels: CatererCsvLabels): string[][] {
  const tableName = (table: CatererTable) => (table.id === null ? labels.unplaced : table.name);
  if (summary.version === "nominative") {
    const rows: string[][] = [[labels.table, labels.name, labels.mealType, labels.diets, labels.count, labels.response]];
    const groups = summary.planComposed ? summary.tables.map((table) => ({ name: tableName(table), people: table.people ?? [] })) : [{ name: "", people: summary.totals.people ?? [] }];
    for (const entry of groups) for (const person of entry.people) rows.push([entry.name, person.name, person.mealType, person.diets.join(", "), "1", labels.present]);
    if (summary.vendorMeals.count > 0) rows.push([labels.vendorMeals, "", summary.vendorMeals.label, "", String(summary.vendorMeals.count), ""]);
    for (const person of summary.pending.people ?? []) rows.push(["", person.name, person.mealType, person.diets.join(", "), "1", labels.pending]);
    return rows;
  }
  const line = (name: string, group: Pick<CatererGroup, "covers" | "meals" | "diets">) => [
    name,
    String(group.covers),
    ...summary.mealTypes.map((type) => String(group.meals.find((count) => count.id === type.id)?.count ?? 0)),
    ...summary.dietOptions.map((option) => String(group.diets.find((count) => count.id === option.id)?.count ?? 0)),
  ];
  const vendorId = summary.vendorMeals.mealTypeId;
  const rows: string[][] = [[labels.table, labels.covers, ...summary.mealTypes.map((type) => type.label), ...summary.dietOptions.map((option) => option.label)]];
  for (const table of summary.tables) rows.push(line(tableName(table), table));
  rows.push(line(labels.total, summary.totals));
  rows.push(line(labels.vendorMeals, { covers: summary.vendorMeals.count, meals: vendorId ? [{ id: vendorId, label: summary.vendorMeals.label, count: summary.vendorMeals.count }] : [], diets: [] }));
  rows.push(line(labels.pending, summary.pending));
  return rows;
}
