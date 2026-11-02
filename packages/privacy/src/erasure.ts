// RGPD-03 — outils communs aux modules pour l'oubli (ADR 0023).
import { randomUUID } from "node:crypto";
import type { PrivacyRecordRef } from "./contract";

// Valeur de remplacement d'un champ texte obligatoire anonymisé (registre de
// données : « Remplacé par « [anonymisé] » »). Marqueur technique stable,
// jamais un nom.
export const ANONYMIZED = "[anonymisé]";

// E-mail de remplacement non réversible, au domaine réservé « .invalid »
// (RFC 2606) : aucun envoi possible, aucune trace de l'adresse d'origine.
export function anonymizedEmail(): string {
  return `anonymise-${randomUUID()}@anonymise.invalid`;
}

// Généralisation d'une date (cahier des charges § 6) : ramenée au 1er du mois.
export function monthStart(date: string): string {
  return `${date.slice(0, 7)}-01`;
}

// Identifiants des fiches d'une nature donnée, sans doublon, au format UUID
// (un identifiant mal formé n'atteint jamais la base).
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function idsOfKind(records: PrivacyRecordRef[], kind: string): string[] {
  return [...new Set(records.filter((record) => record.kind === kind && UUID.test(record.recordId)).map((record) => record.recordId))];
}
