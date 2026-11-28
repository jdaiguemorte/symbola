// Lot 73d (PRE-01, PRE-05, PRE-08, PRE-10 ; spécification du lot 73, § 5.4, critères 7 à 10 ; P3, P4, P9 ;
// C-48 ; maquette 20, « La fiche », « Une fiche neuve ») — les règles pures de la fiche d'un prestataire.
//
// - « Avec vous » : une ligne par mariage, où il en est en mots (P2, P5), un seul montant (P9) : pour un
//   prestataire retenu, le réel du poste ou, soldé, le total réglé (calculé par getVendorHistory, le même
//   que la colonne « Réel » du budget) ; pour un prestataire seulement en comparaison ou non retenu, son
//   devis, étiqueté « devis » ; l'évaluation après le jour J.
// - Les alertes sous l'en-tête : une pièce à renouveler (fin de validité passée), une pièce qui finit avant
//   un mariage à venir où il est retenu, un IBAN changé à vérifier.
// - Les valeurs absentes d'une fiche : chacune dit pourquoi ou quoi faire, jamais « — » (critère 9).
// - Les pièces « demandées d'habitude » à proposer en un bouton sur une fiche neuve (P4, critère 10).
import type { VendorCandidateStatus, VendorDocument, VendorDocumentKind, VendorHistoryEntry, VendorRetainedEvent } from "@symbola/contracts";

export type HistoryStage = "comparing" | "quoteReceived" | "retainedUnsigned" | "contractSigned" | "paidOff" | "notRetained";

// Où en est le prestataire sur ce mariage, en mots (P2 : « en comparaison » ; P5 : « Retenu, contrat non
// signé »).
export function historyStage(status: VendorCandidateStatus): HistoryStage {
  switch (status) {
    case "quote_received":
      return "quoteReceived";
    case "retained":
      return "retainedUnsigned";
    case "contract_signed":
      return "contractSigned";
    case "paid_off":
      return "paidOff";
    case "dismissed":
      return "notRetained";
    default:
      return "comparing";
  }
}

// P9 : un seul montant par mariage. « amount » : le réel du poste (ou le total réglé une fois soldé) ;
// « quote » : le devis d'un prestataire qui n'est pas retenu, écrit « devis 9 800,00 € » ; « none » : rien
// à montrer.
export type HistoryAmount = { kind: "amount"; cents: number } | { kind: "quote"; cents: number } | { kind: "none" };

export function historyAmount(entry: Pick<VendorHistoryEntry, "outcome" | "quotedCents" | "finalCents">): HistoryAmount {
  if (entry.outcome === "selected") return entry.finalCents !== null ? { kind: "amount", cents: entry.finalCents } : { kind: "none" };
  return entry.quotedCents !== null ? { kind: "quote", cents: entry.quotedCents } : { kind: "none" };
}

// L'évaluation d'un mariage : notée à la clôture ; pour un prestataire retenu, « après le jour J » tant que
// le mariage n'est pas passé, « non noté » ensuite ; rien pour un prestataire qui n'a pas été retenu.
export type HistoryRating = { kind: "rated"; rating: number } | { kind: "afterDay" } | { kind: "notRated" } | { kind: "none" };

export function historyRating(entry: Pick<VendorHistoryEntry, "eventId" | "eventDate" | "outcome">, ratings: Map<string, number>, today: string): HistoryRating {
  const rating = ratings.get(entry.eventId);
  if (rating !== undefined) return { kind: "rated", rating };
  if (entry.outcome !== "selected") return { kind: "none" };
  return entry.eventDate === null || entry.eventDate >= today ? { kind: "afterDay" } : { kind: "notRated" };
}

export type SheetHistoryRow = {
  key: string;
  eventId: string;
  slotId: string;
  eventNames: string;
  eventDate: string | null;
  slotLabel: string;
  stage: HistoryStage;
  amount: HistoryAmount;
  rating: HistoryRating;
};

// Les deux historiques d'avant réunis (critère 8) : une ligne par mariage et par poste, le plus récent
// d'abord (les mariages sans date en dernier).
export function sheetHistoryRows(entries: VendorHistoryEntry[], ratings: Map<string, number>, today: string): SheetHistoryRow[] {
  return entries
    .map((entry) => ({
      key: `${entry.eventId}-${entry.slotId}`,
      eventId: entry.eventId,
      slotId: entry.slotId,
      eventNames: entry.eventNames,
      eventDate: entry.eventDate,
      slotLabel: entry.slotLabel,
      stage: historyStage(entry.status),
      amount: historyAmount(entry),
      rating: historyRating(entry, ratings, today),
    }))
    .sort((a, b) => (b.eventDate ?? "").localeCompare(a.eventDate ?? "") || a.slotLabel.localeCompare(b.slotLabel));
}

// Les alertes sous l'en-tête (critère 7). « renew » : la fin de validité est passée (avec le nombre de
// mariages à venir où il est retenu) ; « beforeEvent » : la pièce finit avant un mariage à venir où il est
// retenu (le plus proche) ; « iban » : l'IBAN a changé et attend d'être vérifié par un autre canal.
export type SheetAlert =
  | { kind: "renew"; documentId: string; kindId: string; label: string; validUntil: string; upcomingRetained: number }
  | { kind: "beforeEvent"; documentId: string; kindId: string; label: string; validUntil: string; eventId: string; eventDate: string }
  | { kind: "iban" };

export function sheetAlerts(input: { documents: VendorDocument[]; retainedEvents: VendorRetainedEvent[]; today: string; ibanPending: boolean }): SheetAlert[] {
  const upcoming = input.retainedEvents.filter((event) => event.eventDate >= input.today).sort((a, b) => a.eventDate.localeCompare(b.eventDate));
  const alerts: SheetAlert[] = [];
  for (const document of input.documents) {
    if (document.status === "requested" || !document.validUntil) continue;
    if (document.validUntil < input.today) {
      alerts.push({ kind: "renew", documentId: document.id, kindId: document.kindId, label: document.kindLabel, validUntil: document.validUntil, upcomingRetained: upcoming.length });
      continue;
    }
    const before = upcoming.find((event) => document.validUntil! < event.eventDate);
    if (before) alerts.push({ kind: "beforeEvent", documentId: document.id, kindId: document.kindId, label: document.kindLabel, validUntil: document.validUntil, eventId: before.eventId, eventDate: before.eventDate });
  }
  if (input.ibanPending) alerts.push({ kind: "iban" });
  return alerts;
}

// Les pièces à régler du bloc « Pièces » (« 1 à régler ») : demandées, à vérifier, à renouveler.
export function documentsToSettle(documents: VendorDocument[], today: string): number {
  return documents.filter((document) => document.status !== "verified" || (document.validUntil !== null && document.validUntil < today)).length;
}

// P4 : les natures « demandées d'habitude » que la fiche n'a ni demandées, ni reçues encore valables ; le
// bouton « Demander … » les demande d'un geste. Vide : la fiche propose « Demander une pièce… ».
export function usualKindsToRequest(kinds: VendorDocumentKind[], documents: VendorDocument[], today: string): VendorDocumentKind[] {
  const covered = new Set(documents.filter((document) => document.status === "requested" || document.validUntil === null || document.validUntil >= today).map((document) => document.kindId));
  return kinds.filter((kind) => kind.requestedByDefault && !covered.has(kind.id));
}

// Le nom d'une pièce dans une phrase : son nom court, sinon son libellé (P3, aucun accord).
export function kindName(kind: Pick<VendorDocumentKind, "label" | "shortLabel">): string {
  return kind.shortLabel ?? kind.label;
}

// Les caractéristiques de la fiche, chacune avec sa valeur ou ce qu'il faut savoir de son absence
// (critère 9) : « missing » porte la clé du texte (VendorSheet.missing.*) et dit si un lien « Ajouter »
// ouvre la fenêtre de modification.
export type SheetFact = { key: string; value: string } | { key: string; missing: string; add: boolean };

export function sheetFacts(vendor: { indicativePrices: string | null; rating: number | null; siret: string | null; website: string | null; addressLine: string | null; postalCode: string | null; city: string | null }): SheetFact[] {
  const address = [vendor.addressLine, [vendor.postalCode, vendor.city].filter(Boolean).join(" ")].filter(Boolean).join(", ");
  return [
    vendor.indicativePrices ? { key: "prices", value: vendor.indicativePrices } : { key: "prices", missing: "prices", add: true },
    vendor.rating !== null ? { key: "rating", value: String(vendor.rating) } : { key: "rating", missing: "rating", add: false },
    vendor.siret ? { key: "siret", value: vendor.siret } : { key: "siret", missing: "siret", add: true },
    vendor.website ? { key: "website", value: vendor.website } : { key: "website", missing: "website", add: true },
    vendor.addressLine ? { key: "address", value: address } : { key: "address", missing: "address", add: true },
  ];
}
