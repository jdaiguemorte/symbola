// Lot 55 (MSG-04 révisée, MSG-05 ; D1, D2 ; ADR 0101) — l'adresse d'expédition de l'organisation et
// le journal des envois. Le statut arrive par le webhook signé du service d'envoi (SEC-19), traduit
// par un adaptateur ; le journal ne garde ni le contenu ni le corps, seulement l'objet et le statut,
// 13 mois.
export const EMAIL_DELIVERY_STATUSES = ["sent", "delivered", "bounced", "complained"] as const;
export type EmailDeliveryStatus = (typeof EMAIL_DELIVERY_STATUSES)[number];

// Motif d'un rejet, en codes fermés (traduits à l'affichage) ; jamais le texte brut du serveur.
export const EMAIL_BOUNCE_REASONS = ["mailbox_not_found", "mailbox_full", "blocked", "spam_complaint", "other"] as const;
export type EmailBounceReason = (typeof EMAIL_BOUNCE_REASONS)[number];

export type EmailDeliveryView = {
  id: string;
  recipient: string | null;
  subject: string;
  kind: string | null;
  eventId: string | null;
  status: EmailDeliveryStatus;
  reason: EmailBounceReason | null;
  sentAt: string;
  statusAt: string;
};

// L'alerte sur un contact (critère de MSG-05) : son adresse est rejetée.
export type ContactDeliveryAlert = { status: "bounced" | "complained"; reason: EmailBounceReason | null; at: string };

// Ce que rend un adaptateur de webhook, après vérification de la signature.
export type EmailDeliveryEvent = { reference: string; status: Exclude<EmailDeliveryStatus, "sent">; reason: EmailBounceReason | null; occurredAt: Date };

export type SenderAddressView = { localPart: string; domain: string; address: string; mode: "shared" | "organization"; replyTo: string | null };

// Partie locale : minuscules, chiffres, points et tirets, 2 à 40 caractères, ni début ni fin en
// ponctuation, pas de ponctuation doublée.
export const SENDER_LOCAL_PART_PATTERN = /^[a-z0-9](?:[a-z0-9]|[.-](?=[a-z0-9])){1,39}$/;
