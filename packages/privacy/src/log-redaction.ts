// Lot 24a (SEC-20) — aucune donnée personnelle dans les journaux techniques :
// repérer et masquer les adresses e-mail et les numéros de téléphone dans un
// texte libre (message de journal, erreur affichée). Le repérage est prudent
// sur les chiffres : un identifiant (UUID), une date ou une durée ne sont pas
// pris pour un téléphone.

export type PersonalDataKind = "email" | "phone";
export type PersonalDataFinding = { kind: PersonalDataKind; index: number };

const PATTERNS: { kind: PersonalDataKind; pattern: RegExp; label: string }[] = [
  { kind: "email", pattern: /[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(?:\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}/g, label: "[e-mail]" },
  // Numéros français (06 12 34 56 78, 06.12.34.56.78, 0612345678, +33 6 12 34 56 78),
  // jamais au milieu d'un mot, d'un identifiant ou d'une suite de chiffres.
  { kind: "phone", pattern: /(?<![\w.+-])(?:\+33[\s.-]?(?:\(0\)[\s.-]?)?|0)[1-9](?:[\s.-]?\d{2}){4}(?![\w])/g, label: "[téléphone]" },
  // Autres indicatifs (+44 20 7946 0958, +32 470 12 34 56).
  { kind: "phone", pattern: /(?<![\w.+-])\+(?!33)[1-9]\d{0,2}(?:[\s.-]?\d){7,12}(?![\w])/g, label: "[téléphone]" },
];

export function findPersonalData(text: string): PersonalDataFinding[] {
  return PATTERNS.flatMap(({ kind, pattern }) => [...text.matchAll(pattern)].map((match) => ({ kind, index: match.index })))
    .sort((a, b) => a.index - b.index);
}

export function redactPersonalData(text: string): string {
  return PATTERNS.reduce((current, { pattern, label }) => current.replace(pattern, label), text);
}
