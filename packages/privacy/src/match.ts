// RGPD-01 — correspondance d'un texte avec les termes d'une recherche de
// personne (ADR 0023) : insensible à la casse et aux accents ; un nom
// correspond si chacun de ses mots apparaît ; un téléphone est comparé sur ses
// seuls chiffres, indicatif +33 ramené à 0. Les modules l'appliquent à leurs
// champs personnels déclarés au registre.
import type { PersonTerms } from "./contract";

export function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function phoneDigits(value: string): string {
  let digits = value.replace(/\D/g, "");
  if (digits.startsWith("0033")) digits = `0${digits.slice(4)}`;
  else if (digits.startsWith("33") && digits.length === 11) digits = `0${digits.slice(2)}`;
  return digits;
}

// Un téléphone de moins de 6 chiffres ne désigne personne.
const MIN_PHONE_DIGITS = 6;
// Un mot de nom d'une lettre (« A. ») ne suffit pas à reconnaître quelqu'un.
const MIN_NAME_WORD = 2;

export type PreparedTerms = { email: string | null; phone: string | null; nameWords: string[] };

export function prepareTerms(terms: PersonTerms): PreparedTerms {
  const email = terms.email ? normalizeText(terms.email) : "";
  const phone = terms.phone ? phoneDigits(terms.phone) : "";
  const nameWords = terms.name
    ? normalizeText(terms.name)
        .split(/[^a-z0-9]+/)
        .filter((word) => word.length >= MIN_NAME_WORD)
    : [];
  return {
    email: email.length >= 3 ? email : null,
    phone: phone.length >= MIN_PHONE_DIGITS ? phone : null,
    nameWords,
  };
}

export function hasTerms(terms: PreparedTerms): boolean {
  return terms.email !== null || terms.phone !== null || terms.nameWords.length > 0;
}

// Le texte correspond-il à au moins un des termes ?
export function matchesTerms(text: string | null | undefined, terms: PreparedTerms): boolean {
  if (!text) return false;
  const normalized = normalizeText(text);
  if (terms.email && normalized.includes(terms.email)) return true;
  if (terms.phone) {
    const digits = phoneDigits(text);
    if (digits.length >= MIN_PHONE_DIGITS && digits.includes(terms.phone)) return true;
    // Un téléphone écrit au milieu d'un texte (« appeler le 06 12 34 56 78 ») :
    // chaque suite de chiffres et séparateurs est comparée.
    for (const chunk of text.match(/\+?[\d][\d\s.\-()]{4,}\d/g) ?? []) {
      if (phoneDigits(chunk).includes(terms.phone)) return true;
    }
  }
  if (terms.nameWords.length > 0) {
    const words = new Set(normalized.split(/[^a-z0-9]+/));
    if (terms.nameWords.every((word) => words.has(word))) return true;
  }
  return false;
}

// Plusieurs champs d'une même fiche (prénom, nom…) : un nom en deux mots
// correspond même s'ils sont dans deux champs distincts.
export function recordMatches(values: (string | null | undefined)[], terms: PreparedTerms): boolean {
  const present = values.filter((value): value is string => Boolean(value));
  return present.some((value) => matchesTerms(value, terms)) || (terms.nameWords.length > 1 && matchesTerms(present.join(" "), { ...terms, email: null, phone: null }));
}
