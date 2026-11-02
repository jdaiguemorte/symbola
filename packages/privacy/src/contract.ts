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

export interface PrivacyContractV1 {
  module: string;
  // RGPD-01 : fiches dont un champ personnel correspond à la personne.
  find(search: PrivacySearch): Promise<PrivacyRecord[]>;
  // RGPD-01 : fiches rattachées aux événements de la personne (tâches,
  // budget, devis…), qui sont aussi des données sur elle.
  related(input: { organizationId: string; eventIds: string[] }): Promise<PrivacyRecord[]>;
}
