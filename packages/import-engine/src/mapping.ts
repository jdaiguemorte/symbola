// IMP-02 — proposition de correspondance des colonnes vers les champs du
// type d'éléments choisi, avec un indice de confiance (0-100), d'après le
// nom de la colonne (synonymes FR/EN, données traduisibles) et son contenu
// (dates, montants, e-mails, téléphones). Chaque champ n'est proposé qu'une
// fois ; une colonne sous le seuil de confiance n'est jamais appliquée sans
// validation (l'écran l'exige).
import {
  detectDateOrder,
  detectDecimalStyle,
  looksLikeEmail,
  looksLikePhone,
  parseAmountCents,
  parseDate,
  parsePercentageBasisPoints,
  type DateOrder,
  type DecimalStyle,
} from "./values";

export const LOW_CONFIDENCE_THRESHOLD = 70;

export type MappableField = {
  key: string;
  kind: "text" | "date" | "amount" | "percentage" | "boolean" | "choice";
};

export type ColumnProfile = {
  filled: number;
  dateRatio: number;
  amountRatio: number;
  percentageRatio: number;
  emailRatio: number;
  phoneRatio: number;
  booleanRatio: number;
  dateOrder: DateOrder;
  decimalStyle: DecimalStyle;
};

export type ColumnProposal = {
  columnIndex: number;
  fieldKey: string | null;
  confidence: number;
  profile: ColumnProfile;
};

// Minuscules, sans accents ni ponctuation, mots séparés (camelCase compris),
// pluriels simples retirés : « Prénom Mariée », « prenom_mariee » et
// « clients.1.firstName » se comparent mot à mot.
export function normalizeLabel(label: string): string[] {
  return label
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(" ")
    .filter((word) => word !== "")
    .map((word) => (word.length > 3 && word.endsWith("s") ? word.slice(0, -1) : word));
}

function nameScore(header: string, synonyms: string[]): number {
  const words = normalizeLabel(header);
  if (words.length === 0) return 0;
  const joined = words.join(" ");
  let best = 0;
  for (const synonym of synonyms) {
    const target = normalizeLabel(synonym);
    if (target.length === 0) continue;
    if (target.join(" ") === joined) return 100;
    const headerSet = new Set(words);
    const shared = target.filter((word) => headerSet.has(word)).length;
    if (shared === target.length) {
      // Tous les mots du synonyme sont dans l'intitulé (« Date du mariage
      // prévue ») : très probable, moins sûr que l'égalité.
      best = Math.max(best, words.length - target.length <= 1 ? 85 : 75);
    } else if (shared > 0) {
      const overlap = shared / new Set([...words, ...target]).size;
      if (overlap >= 0.5) best = Math.max(best, Math.round(40 + overlap * 30));
    }
  }
  return best;
}

const BOOLEAN_WORDS = new Set(["oui", "non", "yes", "no", "x", "vrai", "faux", "true", "false", "o", "n", "y"]);

export function profileColumn(values: string[]): ColumnProfile {
  const filled = values.map((value) => value.trim()).filter((value) => value !== "");
  const dateOrder = detectDateOrder(filled);
  const decimalStyle = detectDecimalStyle(filled);
  const ratio = (predicate: (value: string) => boolean) =>
    filled.length === 0 ? 0 : filled.filter(predicate).length / filled.length;
  return {
    filled: filled.length,
    dateRatio: ratio((value) => parseDate(value, dateOrder) !== null),
    amountRatio: ratio((value) => parseAmountCents(value, decimalStyle) !== null),
    percentageRatio: ratio((value) => /%$/.test(value) || parsePercentageBasisPoints(value) !== null),
    emailRatio: ratio(looksLikeEmail),
    phoneRatio: ratio(looksLikePhone),
    booleanRatio: ratio((value) => BOOLEAN_WORDS.has(value.toLowerCase())),
    dateOrder,
    decimalStyle,
  };
}

// Ajustement selon le contenu : un contenu conforme au type du champ
// renforce la proposition, un contenu contraire l'affaiblit fortement (une
// colonne d'e-mails n'est jamais un prénom, même nommée « Contact »).
function contentAdjustment(field: MappableField, profile: ColumnProfile): number {
  if (profile.filled === 0) return -10;
  const textLike = 1 - Math.max(profile.dateRatio, profile.amountRatio, profile.emailRatio, profile.phoneRatio);
  switch (field.kind) {
    case "date":
      return profile.dateRatio >= 0.8 ? 10 : profile.dateRatio >= 0.5 ? -15 : -45;
    case "amount":
      return profile.amountRatio >= 0.8 ? 10 : profile.amountRatio >= 0.5 ? -15 : -45;
    case "percentage":
      return profile.percentageRatio >= 0.8 ? 10 : -40;
    case "boolean":
      return profile.booleanRatio >= 0.8 ? 10 : -20;
    case "choice":
      return textLike >= 0.8 ? 0 : -30;
    case "text":
      if (profile.emailRatio >= 0.5 || profile.phoneRatio >= 0.5) return -50;
      return profile.dateRatio >= 0.8 || profile.amountRatio >= 0.8 ? -30 : 0;
  }
}

// Sans intitulé reconnu, le contenu seul suggère un champ de date ou de
// montant, s'il n'y en a qu'un : proposition sous le seuil, à valider.
const CONTENT_ONLY_CONFIDENCE = 50;

export function proposeMapping(input: {
  headers: string[];
  rows: string[][];
  fields: readonly MappableField[];
  synonyms: Record<string, string[]>;
}): ColumnProposal[] {
  const profiles = input.headers.map((_, index) => profileColumn(input.rows.map((row) => row[index] ?? "")));

  const candidates: { columnIndex: number; fieldKey: string; confidence: number }[] = [];
  input.headers.forEach((header, columnIndex) => {
    const profile = profiles[columnIndex] as ColumnProfile;
    for (const field of input.fields) {
      const byName = nameScore(header, input.synonyms[field.key] ?? []);
      let confidence = byName > 0 ? Math.max(0, Math.min(100, byName + contentAdjustment(field, profile))) : 0;
      if (byName === 0 && profile.filled > 0) {
        const sameKind = input.fields.filter((other) => other.kind === field.kind);
        const matchesKind =
          (field.kind === "date" && profile.dateRatio >= 0.9) || (field.kind === "amount" && profile.amountRatio >= 0.9 && profile.dateRatio < 0.5);
        if (matchesKind && sameKind.length === 1) confidence = CONTENT_ONLY_CONFIDENCE;
      }
      if (confidence > 0) candidates.push({ columnIndex, fieldKey: field.key, confidence });
    }
  });

  // Attribution gloutonne : la meilleure confiance d'abord ; à égalité, la
  // colonne la plus à gauche (« Prénom » avant « Prénom 2 »).
  candidates.sort((a, b) => b.confidence - a.confidence || a.columnIndex - b.columnIndex);
  const byColumn = new Map<number, { fieldKey: string; confidence: number }>();
  const usedFields = new Set<string>();
  for (const candidate of candidates) {
    if (byColumn.has(candidate.columnIndex) || usedFields.has(candidate.fieldKey)) continue;
    // Sous 30, la ressemblance est trop faible pour être proposée.
    if (candidate.confidence < 30) continue;
    byColumn.set(candidate.columnIndex, { fieldKey: candidate.fieldKey, confidence: candidate.confidence });
    usedFields.add(candidate.fieldKey);
  }

  return input.headers.map((_, columnIndex) => {
    const chosen = byColumn.get(columnIndex);
    return {
      columnIndex,
      fieldKey: chosen?.fieldKey ?? null,
      confidence: chosen?.confidence ?? 0,
      profile: profiles[columnIndex] as ColumnProfile,
    };
  });
}
