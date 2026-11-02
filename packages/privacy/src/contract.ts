// Contrat privacy/v1 (SOC-07, PRD §8), révisé au lot 6 (ADR 0023) : chaque
// module recherche une personne dans ses propres données et renvoie des
// fiches ; le hub orchestre la recherche transverse (RGPD-01), puis l'export
// (RGPD-02), l'oubli (RGPD-03) et la purge (RGPD-05) sur les fiches que la
// titulaire a sélectionnées — jamais sur « tout ce qui contient un terme ».
// Les opérations sur les fiches s'ajoutent story par story.

// Ce que la titulaire connaît de la personne : au moins un des trois.
export type PersonTerms = {
  email?: string | null | undefined;
  phone?: string | null | undefined;
  name?: string | null | undefined;
};

export type PrivacySearch = {
  organizationId: string;
  terms: PersonTerms;
};

// Une fiche d'un module qui concerne la personne : un client d'événement,
// un accès marié, un signataire de devis, une facture…
export type PrivacyRecord = {
  module: string;
  // Nature de la fiche, propre au module (event_client, quote_signer…).
  kind: string;
  recordId: string;
  // Libellé lisible pour la titulaire (« Élodie Durand », « Devis D-2027-0004 »).
  label: string;
  // Champs personnels de la fiche (intitulé technique → valeur), pour
  // reconnaître la personne parmi des homonymes.
  fields: Record<string, string>;
  // Événement de la fiche, s'il y en a un : sert à rassembler les données liées.
  eventId: string | null;
};

export interface PrivacyContractV1 extends PrivacyErasureV1 {
  module: string;
  // RGPD-01 : fiches dont un champ personnel correspond à la personne.
  find(search: PrivacySearch): Promise<PrivacyRecord[]>;
  // RGPD-01 : fiches rattachées aux événements de la personne (tâches,
  // budget, devis…), qui sont aussi des données sur elle.
  related(input: { organizationId: string; eventIds: string[] }): Promise<PrivacyRecord[]>;
}

// —— RGPD-03 : oubli ——————————————————————————————————————————————————————

// Fiche désignée à un module (le module est celui qui reçoit l'appel).
export type PrivacyRecordRef = { kind: string; recordId: string };

// Sort d'une fiche à l'oubli (PRD RGPD-03) : supprimée, anonymisée (les
// statistiques restent justes) ou conservée pour un motif légal jusqu'à une
// date de fin, puis anonymisée par la purge (RGPD-05).
export type ErasureFate = "deleted" | "anonymized" | "kept";
// Motifs légaux de conservation, traduits à l'écran et dans la preuve.
export type ErasureLegalBasis = "accounting" | "contract_proof";

export type ErasurePlanItem = PrivacyRecordRef & {
  fate: ErasureFate;
  legalBasis: ErasureLegalBasis | null;
  // Date (AAAA-MM-JJ) de fin de conservation, pour une fiche conservée.
  keptUntil: string | null;
};

// Durées de conservation de l'organisation qui décident d'une conservation.
export type ErasureRules = {
  accountingRetentionMonths: number;
  signedQuoteRetentionMonths: number;
};

// today (AAAA-MM-JJ, Paris) : une fiche conservée dont la date de fin est
// atteinte n'est plus conservée mais anonymisée (RGPD-05).
export type ErasureInput = { organizationId: string; records: PrivacyRecordRef[]; rules: ErasureRules; today: string };

// Implémenté par chaque module qui détient des données personnelles. Une
// fiche inconnue, d'une autre organisation ou d'un essai guidé est ignorée.
export interface PrivacyErasureV1 {
  // Aperçu : le sort de chaque fiche, sans rien modifier.
  planErasure(input: ErasureInput): Promise<ErasurePlanItem[]>;
  // Exécution, idempotente : renvoie l'accusé (ce qui a été fait).
  erase(input: ErasureInput): Promise<ErasurePlanItem[]>;
}
