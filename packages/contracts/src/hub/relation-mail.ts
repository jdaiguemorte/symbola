// Lot 65d (MSG-01, HUB-20, HUB-28 ; décisions de Julien du 22/11/2026 ; ADR 0110) — les messages de la
// relation : par défaut préparés par Symbola et envoyés par la planner de sa messagerie ; envoyés par
// Symbola si l'organisation le choisit. Les modèles techniques partent toujours de Symbola.
import type { EmailTemplateKind, EmailValues } from "../emails";

// « planner » : « Je les envoie de ma messagerie » (par défaut) ; « symbola » : « Symbola les envoie
// pour moi » (pièces jointes, relances automatiques, adresse de l'ADR 0102).
export const RELATION_MAIL_SENDERS = ["planner", "symbola"] as const;
export type RelationMailSender = (typeof RELATION_MAIL_SENDERS)[number];

// Le destinataire, désigné par son identifiant (jamais par son adresse) : un lien personnel de
// l'évènement (client, prestataire), un contact du hub (prospect), un signataire d'un devis.
export const PREPARED_EMAIL_RECIPIENT_TYPES = ["event_link", "contact", "quote_signer"] as const;
export type PreparedEmailRecipientType = (typeof PREPARED_EMAIL_RECIPIENT_TYPES)[number];

export const PREPARED_EMAIL_STATUSES = ["to_send", "sent", "dismissed"] as const;
export type PreparedEmailStatus = (typeof PREPARED_EMAIL_STATUSES)[number];

// Les références d'un message préparé : des identifiants seulement (devis, version, échéance, poste…),
// jamais un texte ni une adresse.
export type PreparedEmailRef = Record<string, string>;

export type PreparedEmailView = {
  id: string;
  kind: EmailTemplateKind;
  eventId: string | null;
  recipientType: PreparedEmailRecipientType;
  recipientId: string;
  ref: PreparedEmailRef;
  origin: "gesture" | "automation";
  automationKey: string | null;
  status: PreparedEmailStatus;
  createdAt: string;
  sentAt: string | null;
  sentByUserId: string | null;
};

// Ce que la fenêtre « Préparer l'e-mail » montre : le message recomposé à l'ouverture, avec les liens
// personnels déjà insérés. renewedLink : un nouveau lien personnel vient d'être créé pour ce message
// (l'ancien ne fonctionne plus). pdfHref : « Télécharger le PDF », à joindre à la main.
export type PreparedEmailDraft = {
  id: string;
  kind: EmailTemplateKind;
  eventId: string | null;
  to: string;
  recipientName: string;
  subject: string;
  body: string;
  renewedLink: boolean;
  pdfHref: string | null;
  // « missing_variable » : le modèle emploie une variable vide (Paramètres › Modèles d'e-mails) ;
  // « unavailable » : le message n'a plus lieu d'être.
  problem: "missing_variable" | "unavailable" | null;
};

// Ce qu'un module rend pour recomposer un message préparé : le destinataire (adresse lue à l'ouverture,
// jamais gardée), la langue, les variables du modèle (ou le texte de la planner pour un prospect).
// null : le message n'a plus lieu d'être (lien retiré, échéance réglée…).
export type RelationDraft = {
  to: string;
  recipientName: string;
  locale: "fr" | "en";
  values: EmailValues;
  // Le texte déjà rendu (réponse ou relance d'un prospect, écrites par la planner).
  text?: { subject: string; body: string };
  renewedLink?: boolean;
  pdfHref?: string | null;
};
