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
} & ContactCoordinates;

export type ContactInput = {
  kind?: ContactKind;
  firstName?: string | null;
  lastName?: string | null;
  name?: string | null;
} & Partial<ContactCoordinates>;

export type ContactNote = { id: string; contactId: string; authorUserId: string | null; body: string; createdAt: Date };
