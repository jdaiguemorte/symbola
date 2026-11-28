// Lot 73d — la fiche d'un prestataire (spécification du lot 73, § 5.4, critères 7 à 10 ; P3, P4, P9 ; C-48).
import { describe, expect, it } from "vitest";
import type { VendorDocument, VendorDocumentKind, VendorHistoryEntry } from "@symbola/contracts";
import { documentsToSettle, historyAmount, historyRating, historyStage, kindName, sheetAlerts, sheetFacts, sheetHistoryRows, usualKindsToRequest } from "./vendor-sheet-model";

const TODAY = "2026-11-28";

function entry(overrides: Partial<VendorHistoryEntry>): VendorHistoryEntry {
  return { eventId: "e1", eventNames: "Léa & Maxime", eventDate: "2027-06-12", slotId: "s1", slotLabel: "Traiteur", status: "retained", outcome: "selected", quotedCents: 960000, finalCents: 960000, ...overrides };
}

function document(overrides: Partial<VendorDocument>): VendorDocument {
  return {
    id: "d1",
    vendorId: "v1",
    kindId: "k-insurance",
    kindLabel: "Attestation d'assurance responsabilité civile",
    status: "verified",
    fileName: "assurance-2026.pdf",
    mime: "application/pdf",
    sizeBytes: 1000,
    validUntil: "2027-03-03",
    uploadedBy: "planner",
    uploadedAt: "2025-11-03T10:00:00.000Z",
    requestedAt: null,
    verifiedAt: "2025-11-03T10:00:00.000Z",
    alert: "valid",
    ...overrides,
  };
}

const kinds: VendorDocumentKind[] = [
  { id: "k-insurance", label: "Attestation d'assurance responsabilité civile", shortLabel: "Assurance", requestedByDefault: true, expires: true, starterKey: "insurance", position: 0 },
  { id: "k-kbis", label: "Extrait Kbis ou avis de situation Insee", shortLabel: "Kbis", requestedByDefault: true, expires: true, starterKey: "registration", position: 1 },
  { id: "k-plan", label: "Plan du lieu", shortLabel: null, requestedByDefault: false, expires: false, starterKey: "venue_plan", position: 2 },
];

describe("PRE-08 — « Avec vous » : un mariage par ligne, un seul montant (lot 73d, critère 8 ; P9, C-48)", () => {
  it("un prestataire retenu montre le montant du poste ; jamais deux prix sur la même ligne", () => {
    expect(historyAmount(entry({ quotedCents: 960000, finalCents: 960000 }))).toEqual({ kind: "amount", cents: 960000 });
  });

  it("soldé, le montant est celui calculé pour le poste (le total réglé), pas le devis", () => {
    expect(historyAmount(entry({ status: "paid_off", quotedCents: 980000, finalCents: 940000 }))).toEqual({ kind: "amount", cents: 940000 });
  });

  it("un prestataire seulement en comparaison, ou non retenu, montre son devis, étiqueté « devis »", () => {
    expect(historyAmount(entry({ status: "quote_received", outcome: "pending", quotedCents: 890000, finalCents: null }))).toEqual({ kind: "quote", cents: 890000 });
    expect(historyAmount(entry({ status: "dismissed", outcome: "not_selected", quotedCents: 980000, finalCents: null }))).toEqual({ kind: "quote", cents: 980000 });
    expect(historyAmount(entry({ status: "shortlisted", outcome: "pending", quotedCents: null, finalCents: null }))).toEqual({ kind: "none" });
  });

  it("où il en est se dit en mots : en comparaison, devis reçu, retenu contrat non signé, contrat signé, soldé, non retenu", () => {
    expect((["shortlisted", "contacted", "quote_received", "retained", "contract_signed", "paid_off", "dismissed"] as const).map(historyStage)).toEqual([
      "comparing",
      "comparing",
      "quoteReceived",
      "retainedUnsigned",
      "contractSigned",
      "paidOff",
      "notRetained",
    ]);
  });

  it("l'évaluation : notée à la clôture, « après le jour J » avant le mariage, rien pour un non retenu", () => {
    const ratings = new Map([["passe", 5]]);
    expect(historyRating(entry({ eventId: "passe", eventDate: "2026-09-19" }), ratings, TODAY)).toEqual({ kind: "rated", rating: 5 });
    expect(historyRating(entry({ eventDate: "2027-06-12" }), ratings, TODAY)).toEqual({ kind: "afterDay" });
    expect(historyRating(entry({ eventDate: "2026-07-04" }), ratings, TODAY)).toEqual({ kind: "notRated" });
    expect(historyRating(entry({ outcome: "not_selected", status: "dismissed" }), ratings, TODAY)).toEqual({ kind: "none" });
  });

  it("les lignes vont du mariage le plus récent au plus ancien, chacune avec son poste", () => {
    const rows = sheetHistoryRows([entry({ eventId: "old", eventDate: "2026-06-06", slotId: "s-old" }), entry({})], new Map(), TODAY);
    expect(rows.map((row) => [row.eventId, row.slotId])).toEqual([
      ["e1", "s1"],
      ["old", "s-old"],
    ]);
  });
});

describe("PRE-05, PRE-10 — Les alertes sous l'en-tête (lot 73d, critère 7)", () => {
  it("une pièce dont la fin de validité est passée est à renouveler, avec le nombre de mariages à venir où il est retenu", () => {
    const alerts = sheetAlerts({
      documents: [document({ validUntil: "2026-10-31", alert: "expired" })],
      retainedEvents: [
        { eventId: "e1", eventDate: "2027-06-12" },
        { eventId: "e2", eventDate: "2027-05-08" },
      ],
      today: TODAY,
      ibanPending: false,
    });
    expect(alerts).toEqual([{ kind: "renew", documentId: "d1", kindId: "k-insurance", label: "Attestation d'assurance responsabilité civile", validUntil: "2026-10-31", upcomingRetained: 2 }]);
  });

  it("une pièce qui finit avant un mariage où il est retenu monte, avec le mariage le plus proche", () => {
    const alerts = sheetAlerts({
      documents: [document({ validUntil: "2027-05-30" })],
      retainedEvents: [
        { eventId: "late", eventDate: "2027-09-01" },
        { eventId: "e1", eventDate: "2027-06-12" },
      ],
      today: TODAY,
      ibanPending: false,
    });
    expect(alerts).toEqual([{ kind: "beforeEvent", documentId: "d1", kindId: "k-insurance", label: "Attestation d'assurance responsabilité civile", validUntil: "2027-05-30", eventId: "e1", eventDate: "2027-06-12" }]);
  });

  it("une pièce valable après tous ses mariages, une pièce demandée, ou sans date de fin, ne monte pas", () => {
    const alerts = sheetAlerts({
      documents: [document({ validUntil: "2027-12-31" }), document({ id: "d2", status: "requested", validUntil: null, fileName: null }), document({ id: "d3", validUntil: null })],
      retainedEvents: [{ eventId: "e1", eventDate: "2027-06-12" }],
      today: TODAY,
      ibanPending: false,
    });
    expect(alerts).toEqual([]);
  });

  it("un IBAN changé monte en alerte", () => {
    expect(sheetAlerts({ documents: [], retainedEvents: [], today: TODAY, ibanPending: true })).toEqual([{ kind: "iban" }]);
  });

  it("le bloc « Pièces » compte ce qui reste à régler : demandée, à vérifier, à renouveler", () => {
    expect(documentsToSettle([document({}), document({ id: "x", status: "requested" }), document({ id: "y", status: "to_verify" }), document({ id: "z", validUntil: "2026-10-31" })], TODAY)).toBe(3);
  });
});

describe("PRE-05 — Les pièces demandées d'habitude (lot 73d, critère 10 ; P3, P4)", () => {
  it("une fiche neuve propose les natures demandées d'habitude", () => {
    expect(usualKindsToRequest(kinds, [], TODAY).map((kind) => kind.id)).toEqual(["k-insurance", "k-kbis"]);
  });

  it("une nature déjà demandée, ou reçue et encore valable, n'est pas redemandée ; une expirée l'est", () => {
    expect(usualKindsToRequest(kinds, [document({ kindId: "k-kbis", status: "requested", validUntil: null })], TODAY).map((kind) => kind.id)).toEqual(["k-insurance"]);
    expect(usualKindsToRequest(kinds, [document({ kindId: "k-insurance", validUntil: "2026-10-31" })], TODAY).map((kind) => kind.id)).toEqual(["k-insurance", "k-kbis"]);
  });

  it("sans réglage, rien n'est proposé en un bouton (la fiche dit « Demander une pièce… »)", () => {
    expect(usualKindsToRequest(kinds.map((kind) => ({ ...kind, requestedByDefault: false })), [], TODAY)).toEqual([]);
  });

  it("le nom court d'une pièce sert dans une phrase ; sans nom court, son libellé", () => {
    expect(kinds.map(kindName)).toEqual(["Assurance", "Kbis", "Plan du lieu"]);
  });
});

describe("PRE-01 — Une fiche neuve dit pourquoi ou quoi faire (lot 73d, critère 9)", () => {
  it("chaque valeur absente porte sa raison ou son « Ajouter », jamais un tiret", () => {
    const facts = sheetFacts({ indicativePrices: null, rating: null, siret: null, website: null, addressLine: null, postalCode: null, city: "Niort" });
    expect(facts).toEqual([
      { key: "prices", missing: "prices", add: true },
      { key: "rating", missing: "rating", add: false },
      { key: "siret", missing: "siret", add: true },
      { key: "website", missing: "website", add: true },
      { key: "address", missing: "address", add: true },
    ]);
    expect(JSON.stringify(facts)).not.toContain("—");
  });

  it("une fiche remplie montre ses valeurs", () => {
    const facts = sheetFacts({ indicativePrices: "85 à 110 € par invité", rating: 5, siret: "00000000000000", website: "https://maison-haddad.example", addressLine: "12 rue des Carmes", postalCode: "86000", city: "Poitiers" });
    expect(facts.find((fact) => fact.key === "address")).toEqual({ key: "address", value: "12 rue des Carmes, 86000 Poitiers" });
    expect(facts.every((fact) => "value" in fact)).toBe(true);
  });
});
