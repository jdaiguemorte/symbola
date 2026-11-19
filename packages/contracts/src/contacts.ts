// Lot 36a (CRM-03, DAT-12, ARC-03 ; ADR 0069) — le contact unique du hub : une personne, un foyer
// ou une entreprise, qui n'existe qu'une fois dans l'organisation. Les autres modules le lisent et
// le créent par le service du hub ; ils ne gardent que son identifiant.
export type ContactKind = "person" | "household" | "company";

export type ContactCoordinates = {
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string | null;
  // D8 : adresse de facturation, reprise à l'envoi en signature.
  billingAddress: string | null;
};

// Lot 36b (CRM-03, SC-11) : identifiants d'une entreprise, reportés sur le devis et la facture.
export type ContactCompanyIds = {
  // SIREN (9 chiffres) ou SIRET (14 chiffres).
  companyIdNumber: string | null;
  // Numéro de TVA intracommunautaire.
  vatNumber: string | null;
};

export type Contact = {
  id: string;
  kind: ContactKind;
  // Personne : prénom et nom ; foyer ou entreprise : nom.
  firstName: string | null;
  lastName: string | null;
  name: string | null;
  // Nom affiché (« Léa Martin », « Famille Martin », « Société X »).
  displayName: string;
  // Retiré par le RGPD (oubli ou purge) : nom remplacé, coordonnées effacées.
  anonymized: boolean;
  isDemo: boolean;
  createdAt: Date;
  updatedAt: Date;
} & ContactCoordinates &
  ContactCompanyIds;

export type ContactInput = {
  kind?: ContactKind;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
} & Partial<ContactCoordinates> &
  Partial<ContactCompanyIds>;

// Lot 48a (DAT-08, ADR 0093) : une note confidentielle est chiffrée ; son texte (body) n'est rendu
// qu'à la titulaire et à son auteur (readable), vide pour les autres.
export type ContactNote = { id: string; contactId: string; authorUserId: string | null; body: string; createdAt: Date; confidential: boolean; readable: boolean };
export type ContactNoteViewer = { userId: string; role: "owner" | "member" | "admin" };

// Lot 36b (CRM-03, D2) : une personne membre d'un foyer (un couple, une famille) ou d'une entreprise
// (un interlocuteur), avec un rôle libre. `contact` est l'autre bout du lien : la personne vue du
// foyer, ou le foyer vu de la personne.
export type ContactMembership = {
  id: string;
  groupContactId: string;
  memberContactId: string;
  role: string | null;
  contact: Pick<Contact, "id" | "kind" | "displayName" | "email" | "anonymized">;
};
