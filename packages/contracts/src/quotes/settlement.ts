// Lot 43 (FAC-02, FAC-08 Divergent, FAC-09, FAC-15, GC-01, SEC-16, BUD-06, BUD-11 ; ADR 0087, ADR 0089)
// — contrats internes de la proposition en page web, du règlement par virement au RIB, des relances
// et de la répartition par payeur. Aucun paiement en ligne : « régler » veut dire afficher le RIB, le
// montant et une référence, recueillir la déclaration du payeur, puis la confirmation de la planner.
import type { AdvanceKind, ClientQuoteOptions, QuoteTotalsView } from "./service-contract";

export const PROPOSAL_BLOCKS = ["greeting", "organization", "photos", "quote", "schedule", "validity"] as const;
export type ProposalBlock = (typeof PROPOSAL_BLOCKS)[number];

// Modèle de la page de proposition, par type d'évènement (null : pour tous). starter : le modèle de
// départ des données, pas encore enregistré par l'organisation.
export type ProposalTemplateView = {
  id: string | null;
  eventTypeId: string | null;
  greeting: string;
  blocks: ProposalBlock[];
  photoCount: number;
  version: number;
  starter: boolean;
};

export type ProposalTemplateInput = { eventTypeId: string | null; greeting: string; blocks: ProposalBlock[] };

export type ProposalLine = {
  id: string;
  label: string;
  description: string | null;
  quantityMilli: number;
  unit: string;
  // TTC si la TVA s'applique, sinon HT (comme les options du portail).
  amountCents: number;
  isOption: boolean;
  chosen: boolean;
};

export type ProposalStatus = "open" | "expired" | "signed" | "declined" | "superseded";

// La page d'une version envoyée, vue par le client de l'évènement (ou par la planner, en aperçu).
export type ProposalView = {
  quoteId: string;
  versionId: string;
  number: string;
  version: number;
  status: ProposalStatus;
  sentAt: string;
  validUntil: string | null;
  greeting: string | null;
  blocks: ProposalBlock[];
  photoCount: number;
  organization: { name: string; email: string | null; phone: string | null; website: string | null; hasLogo: boolean; color: string | null };
  sections: { title: string | null; lines: ProposalLine[]; subtotalCents: number }[];
  totals: QuoteTotalsView;
  vatApplicable: boolean;
  legalMention: string | null;
  schedule: { id: string; label: string; dueDate: string; amountCents: number }[];
  balanceCents: number;
  advanceKind: AdvanceKind | null;
  // Les options à cocher de la version courante (null : aucune, ou version passée).
  options: ClientQuoteOptions | null;
  // Les versions envoyées, lisibles (la plus récente d'abord).
  versions: { versionId: string; version: number; sentAt: string; current: boolean }[];
};

// L'enchaînement « Accepter et signer », vu par un signataire (son e-mail de lien) : chaque étape
// et son état. step : la première étape qui reste à faire.
export type SigningFlowStep = "options" | "waiting_document" | "code" | "order" | "sign" | "settle" | "done" | "expired" | "declined" | "not_signer";

export type SigningFlowView = {
  step: SigningFlowStep;
  optionsLocked: boolean;
  // SEC-16 : code vérifié depuis moins de LINK_SIGNING_CODE_VALIDITY_MS.
  codeVerified: boolean;
  // Lot 31b (D13) : à distance, la commande avec obligation de paiement, avant le lien de signature.
  orderRequired: boolean;
  ordered: boolean;
  contractId: string | null;
  earlyExecutionText: string | null;
  earlyExecutionRequested: boolean;
  withdrawalApplies: boolean;
  // Le lien de signature (Documenso), seulement une fois le code vérifié et la commande passée.
  signingUrl: string | null;
  ownSigned: boolean;
  allSigned: boolean;
  // Les autres signataires qui n'ont pas encore signé (prénoms seulement).
  waitingFor: string[];
  // L'échéance à régler après la signature (la première de l'échéancier).
  settleScheduleItemId: string | null;
};

// L'écran « Régler l'acompte » (ADR 0087).
export type SettlementView = {
  scheduleItemId: string;
  quoteId: string;
  quoteNumber: string;
  label: string;
  dueDate: string;
  amountCents: number;
  state:
    | { kind: "awaiting_signatures" }
    | { kind: "not_before"; date: string }
    | { kind: "open"; notice: "distance" | "off_premises" | null }
    | { kind: "declared"; paidOn: string; declaredAt: string; byName: string }
    | { kind: "paid"; paidOn: string };
  // Seulement quand le règlement est ouvert (jamais avant le 8e jour hors établissement).
  transfer: { beneficiary: string; iban: string; bic: string | null; reference: string; qrSvg: string | null } | null;
  // Texte de l'écran selon le canal (contract-rules.json), déjà rempli ; null s'il n'y en a pas.
  notice: string | null;
  // Le payeur désigné peut seul déclarer ; false : un autre payeur règle cette échéance.
  canDeclare: boolean;
  // Le RIB n'est pas renseigné dans les réglages des documents : la planner doit le compléter.
  bankDetailsMissing: boolean;
  isDemo: boolean;
};

// La déclaration à confirmer, côté planner (« Aujourd'hui », fiche du devis).
export type TransferDeclarationView = {
  scheduleItemId: string;
  quoteId: string;
  quoteNumber: string;
  eventId: string;
  label: string;
  amountCents: number;
  reference: string;
  declaredPaidOn: string;
  declaredAt: string;
  byName: string;
};

// Le règlement d'une échéance, vu par la planner sur la fiche du devis.
export type ScheduleItemSettlement = {
  scheduleItemId: string;
  reference: string | null;
  declaration: { paidOn: string; declaredAt: string; byName: string } | null;
  remindersSuspended: { at: string; reason: string } | null;
  remindersSent: { rank: number; sentAt: string }[];
};

// Lot 43 (FAC-09, FAC-15 ; D1, D7) : réglages des relances. null : la valeur de départ des données.
export type ReminderSettings = {
  expiryReminderDays: number;
  paymentReminderDays: number[];
  // Taux de la clause de pénalités d'un particulier, en points de base ; null : aucune (AV-7).
  consumerLatePenaltyBasisPoints: number | null;
};

// Lot 43 (BUD-06, BUD-11 ; D8, D9).
export const EVENT_PAYER_KINDS = ["couple", "family_one", "family_two", "company", "other"] as const;
export type EventPayerKind = (typeof EVENT_PAYER_KINDS)[number];

export type EventPayer = {
  id: string;
  eventId: string;
  name: string;
  kind: EventPayerKind;
  linkId: string | null;
  ownShareOnly: boolean;
};

export type PayerShareInput = { payerId: string; percentageBasisPoints: number | null; amountCents: number | null };

// La part d'un payeur, ligne par ligne, sur le montant de référence (engagé, sinon devisé, sinon prévu).
export type PayerShareView = {
  payerId: string;
  lines: { lineId: string; slotLabel: string; label: string; amountCents: number }[];
  totalCents: number;
};

export type CashCalendarEntry = {
  id: string;
  source: "planner" | "vendor";
  label: string;
  counterpart: string;
  amountCents: number;
  dueOn: string;
  payerId: string;
  payerName: string;
  status: "upcoming" | "declared" | "paid";
  // Échéance de la planner : l'écran « Régler » s'ouvre depuis le calendrier.
  settleScheduleItemId: string | null;
};

export type CashCalendarMonth = { month: string; entries: CashCalendarEntry[]; totalCents: number; remainingCents: number };

// Une échéance de la planner (échéancier de la version courante d'un devis envoyé ou signé), pour le
// calendrier des sorties d'argent (BUD-11).
export type PlannerInstalment = {
  scheduleItemId: string;
  quoteId: string;
  quoteNumber: string;
  label: string;
  dueDate: string;
  amountCents: number;
  status: "upcoming" | "declared" | "paid";
  organizationName: string;
};
