// Lot 48a (PRE-06 ; D4, ADR 0093) — contrôles du chrono par les contraintes d'un lieu, sans base.
// Les règles (sens des champs, contrôle, séquences visées, fin de la nuit) viennent des données de
// départ (venue-rules.json) ; les valeurs, de la fiche du lieu (champs porteurs d'une règle). Un
// contrôle ne bloque jamais : il signale, et l'écran explique la règle (« Le château demande la fin
// de la musique à 1 h »). Heures « HH:MM » ; avant la fin de la nuit (6 h), une heure compte pour le
// lendemain : 1 h vient après 23 h.
import type { VenueRules } from "@symbola/starter-templates";

export type VenueValues = Partial<Record<string, string | number | boolean>>;
export type VenueConstraints = { vendorId: string; name: string; values: VenueValues };

// Une séquence du programme, déjà qualifiée : jouée par un prestataire « musique », ou avec au
// moins un prestataire.
export type VenueSequence = { id: string; startTime: string; endTime: string | null; music: boolean; withVendors: boolean };

export type VenueFinding = { itemId: string; ruleKey: string; venueName: string; vendorId: string; limit: string };
export type CapacityFinding = { ruleKey: string; venueName: string; vendorId: string; limit: number; guests: number };

const TIME = /^([01]\d|2[0-3]):([0-5]\d)(?::\d\d)?$/;

function minutes(value: string): number | null {
  const match = TIME.exec(value);
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

function nightAware(value: number, nightEnd: number): number {
  return value < nightEnd ? value + 1440 : value;
}

export function checkProgramAgainstVenue(venue: VenueConstraints, sequences: VenueSequence[], rules: VenueRules): VenueFinding[] {
  const nightEnd = minutes(rules.nightEndsAt) ?? 360;
  const findings: VenueFinding[] = [];
  for (const sequence of sequences) {
    const startRaw = minutes(sequence.startTime);
    if (startRaw === null) continue;
    const start = nightAware(startRaw, nightEnd);
    const endRaw = sequence.endTime ? minutes(sequence.endTime) : null;
    let end = endRaw === null ? start : nightAware(endRaw, nightEnd);
    if (end < start) end += 1440;
    for (const rule of rules.rules) {
      if (rule.check !== "end_after" && rule.check !== "start_before") continue;
      if (rule.appliesTo === "music" && !sequence.music) continue;
      if (rule.appliesTo === "vendors" && !sequence.withVendors) continue;
      const value = venue.values[rule.key];
      const limitRaw = typeof value === "string" ? minutes(value) : null;
      if (limitRaw === null || typeof value !== "string") continue;
      const limit = nightAware(limitRaw, nightEnd);
      const broken = rule.check === "end_after" ? end > limit : start < limit;
      if (broken) findings.push({ itemId: sequence.id, ruleKey: rule.key, venueName: venue.name, vendorId: venue.vendorId, limit: value.slice(0, 5) });
    }
  }
  return findings;
}

// Invités (confirmés, sinon estimés) au-delà de la capacité : la première capacité saisie, dans
// l'ordre des règles (assise, puis debout).
export function checkCapacity(venue: VenueConstraints, guests: number | null, rules: VenueRules): CapacityFinding | null {
  if (guests === null) return null;
  for (const rule of rules.rules.filter((candidate) => candidate.check === "capacity")) {
    const value = venue.values[rule.key];
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) continue;
    return guests > value ? { ruleKey: rule.key, venueName: venue.name, vendorId: venue.vendorId, limit: value, guests } : null;
  }
  return null;
}
