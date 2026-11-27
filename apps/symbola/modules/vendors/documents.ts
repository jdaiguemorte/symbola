// Lot 48a (PRE-05 ; D3, ADR 0093) — échéance des pièces d'un prestataire, sans base. Dates en
// « AAAA-MM-JJ » (jours calendaires de Paris) : la pièce vaut jusqu'à son dernier jour inclus.
// - « expiring » : à N jours ou moins de la fin (N = réglage de l'organisation, 30 proposés) ;
// - « expired » : le dernier jour est passé ;
// - une pièce signalée sur un évènement : sa fin tombe avant la date de l'évènement.

import type { VendorDocumentReason, VendorDocumentState, VendorDocumentStateKind } from "@symbola/contracts";

export type DocumentAlert = "valid" | "expiring" | "expired" | "no_expiry";

function dayNumber(day: string): number {
  return Math.round(Date.UTC(Number(day.slice(0, 4)), Number(day.slice(5, 7)) - 1, Number(day.slice(8, 10))) / 86_400_000);
}

export function documentAlert(document: { validUntil: string | null }, today: string, alertDays: number): DocumentAlert {
  if (!document.validUntil) return "no_expiry";
  const left = dayNumber(document.validUntil) - dayNumber(today);
  if (left < 0) return "expired";
  return left <= alertDays ? "expiring" : "valid";
}

// Pièces déposées (pas seulement demandées) dont la validité s'arrête avant le jour de l'évènement.
export function documentsLapsingBefore<T extends { validUntil: string | null; status: "requested" | "to_verify" | "verified" }>(documents: T[], eventDate: string): T[] {
  return documents.filter((document) => document.status !== "requested" && document.validUntil !== null && document.validUntil < eventDate);
}

// Lot 73a (PRE-05 ; spécification du lot 73, § 4.2 ; P3) — l'état résumé des pièces d'une fiche, du plus
// pressant au plus calme : à renouveler (fin passée) > bientôt (fin dans le délai d'alerte, ou avant un
// mariage à venir où le prestataire est retenu) > à recevoir (demandée) > à vérifier (déposée par son lien)
// > à jour > aucune demandée. « À jour » demande au moins une pièce vérifiée et aucune à régler. Une pièce
// finie remplacée par une pièce valable de la même nature ne compte plus. Sans base : l'appelant donne les
// pièces, le jour et les mariages où la fiche est retenue (lus dans le module Évènements).

export type StateDocument = {
  documentId: string;
  kindId: string;
  label: string;
  shortLabel: string | null;
  status: "requested" | "to_verify" | "verified";
  validUntil: string | null;
  // Horodatages ISO (demande, dépôt).
  requestedAt: string | null;
  uploadedAt: string | null;
};
export type StateRetainedEvent = { eventId: string; eventDate: string; couple: string | null };

const STATE_RANK: Record<VendorDocumentStateKind, number> = { expired: 0, expiring: 1, requested: 2, to_verify: 3, up_to_date: 4, none_requested: 5 };
const TO_SETTLE = new Set<VendorDocumentStateKind>(["expired", "expiring", "requested", "to_verify"]);

type Assessed = { document: StateDocument; state: VendorDocumentStateKind; reason: VendorDocumentReason | null; sortDate: string };

function assess(document: StateDocument, today: string, alertDays: number, upcoming: StateRetainedEvent[]): Assessed | null {
  if (document.status === "requested") return { document, state: "requested", reason: { code: "requested_on", date: document.requestedAt }, sortDate: document.requestedAt ?? "" };
  const alert = documentAlert(document, today, alertDays);
  if (alert === "expired") return { document, state: "expired", reason: { code: "valid_until", date: document.validUntil!, upcomingRetained: upcoming.length }, sortDate: document.validUntil! };
  // Le premier mariage à venir qui tombe après sa fin (le jour même, elle vaut encore).
  const lapsed = document.validUntil ? upcoming.find((event) => event.eventDate > document.validUntil!) : undefined;
  if (lapsed) return { document, state: "expiring", reason: { code: "before_event", eventId: lapsed.eventId, eventDate: lapsed.eventDate, couple: lapsed.couple }, sortDate: document.validUntil! };
  if (alert === "expiring") return { document, state: "expiring", reason: { code: "expires_on", date: document.validUntil! }, sortDate: document.validUntil! };
  if (document.status === "to_verify") return { document, state: "to_verify", reason: { code: "uploaded_by_link", at: document.uploadedAt }, sortDate: document.uploadedAt ?? "" };
  return null;
}

export function documentState(input: { documents: StateDocument[]; today: string; alertDays: number; retainedEvents: StateRetainedEvent[] }): VendorDocumentState & { sortDate: string } {
  const upcoming = input.retainedEvents.filter((event) => event.eventDate >= input.today).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  // Une nature qui a une pièce déposée et encore valable n'a plus de pièce finie à renouveler.
  const validKinds = new Set(
    input.documents.filter((document) => document.status !== "requested" && documentAlert(document, input.today, input.alertDays) !== "expired").map((document) => document.kindId),
  );
  const assessed = input.documents
    .flatMap((document) => {
      const result = assess(document, input.today, input.alertDays, upcoming);
      if (result?.state === "expired" && validKinds.has(document.kindId)) return [];
      return result ? [result] : [];
    })
    .sort((a, b) => STATE_RANK[a.state] - STATE_RANK[b.state] || a.sortDate.localeCompare(b.sortDate));
  const first = assessed[0];
  if (first) {
    const { document } = first;
    return {
      state: first.state,
      document: { documentId: document.documentId, kindId: document.kindId, label: document.label, shortLabel: document.shortLabel, validUntil: document.validUntil },
      othersToSettle: assessed.length - 1,
      reason: first.reason,
      sortDate: first.sortDate,
    };
  }
  const verified = input.documents.some((document) => document.status === "verified");
  return { state: verified ? "up_to_date" : "none_requested", document: null, othersToSettle: 0, reason: null, sortDate: "" };
}

// « Pièces à régler » : dans l'ordre des états, puis par date (la plus ancienne d'abord).
export function compareDocumentStates(a: VendorDocumentState & { sortDate?: string }, b: VendorDocumentState & { sortDate?: string }): number {
  return STATE_RANK[a.state] - STATE_RANK[b.state] || (a.sortDate ?? "").localeCompare(b.sortDate ?? "");
}

export function documentStateNeedsAction(state: VendorDocumentState): boolean {
  return TO_SETTLE.has(state.state);
}
