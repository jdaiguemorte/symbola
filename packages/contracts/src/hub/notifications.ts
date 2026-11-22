// Lot 53 (HUB-15, UX-16, ARC-09, HUB-28, GC-02 ; D1 à D5, D7 ; ADR 0095) — notifications de l'équipe,
// automatismes prêts à activer et radar des risques : des catalogues fermés, comme les natures
// d'e-mails (EMAIL_TEMPLATE_KINDS). Chaque entrée est liée au code qui la produit ; ses valeurs de
// départ (canaux, immédiat, seuils) sont des données (packages/starter-templates, notifications.json
// et risk-radar.json), réglables par l'organisation ou par la personne.
import { z } from "zod";

// --- Notifications (HUB-15, UX-16) ---

export const NOTIFICATION_CHANNELS = ["app", "email", "push"] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];

// Les sortes de notification. Les deux du lot 48 (IBAN à vérifier, pièce qui expire) existent dès ce
// lot pour leurs réglages ; rien ne les produit tant que le lot 48 n'est pas fusionné (ARC-07).
export const NOTIFICATION_TYPES = [
  "prospect_request",
  "quote_signed",
  "quote_expired",
  "transfer_declared",
  "client_decision",
  "vendor_answer",
  "iban_to_verify",
  "document_expiring",
  "task_overdue",
  "milestone_late",
  "risk_alert",
  "day_of_alert",
  // Lot 55 (MSG-03, POR-06, MSG-05) : un client ou un prestataire écrit sur un sujet ; un e-mail est
  // rejeté (adresse inexistante, boîte pleine) ou signalé comme indésirable.
  "client_message",
  "email_bounced",
  // Lot 63g (HUB-06, HUB-15 ; ADR 0108) : l'app demandée pendant le pilote est activée.
  "module_activated",
] as const;
export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

// Réglages de départ d'une sorte : canaux gardés, « immédiat » (part tout de suite au lieu
// d'attendre le récapitulatif) et « jour J » (passe outre les plages de silence le jour d'un
// évènement, si la personne le garde).
export type NotificationTypeDefaults = { immediate: boolean; dayOf: boolean; channels: Record<NotificationChannel, boolean> };

// Paramètres d'une notification : des libellés courts, rendus par les traductions à l'affichage.
// Jamais d'adresse, de téléphone ni de message (SEC-20) ; ils ne sortent jamais dans un push ou dans
// l'objet d'un e-mail, qui ne disent que la sorte.
export const notificationParamsSchema = z.record(z.string().max(40), z.union([z.string().max(200), z.number()]));
export type NotificationParams = z.infer<typeof notificationParamsSchema>;

export type NotificationView = {
  id: string;
  type: NotificationType;
  eventId: string | null;
  params: NotificationParams;
  // L'écran où agir (chemin interne, commence par « / »).
  href: string;
  createdAt: string;
  readAt: string | null;
};

export type NotificationPreferenceView = { type: NotificationType; channel: NotificationChannel; enabled: boolean };

// Récapitulatif, plages de silence et jour J, par personne. Heures en minutes depuis minuit, dans le
// fuseau de l'organisation (IANA).
export type NotificationSettingsView = {
  digestEnabled: boolean;
  digestHour: number;
  quietEnabled: boolean;
  quietStartMinute: number;
  quietEndMinute: number;
  quietSundays: boolean;
  dayOfOverride: boolean;
  timeZone: string;
};

export const notificationSettingsSchema = z.object({
  digestEnabled: z.boolean(),
  digestHour: z.number().int().min(0).max(23),
  quietEnabled: z.boolean(),
  quietStartMinute: z.number().int().min(0).max(1439),
  quietEndMinute: z.number().int().min(0).max(1439),
  quietSundays: z.boolean(),
  dayOfOverride: z.boolean(),
});

// Un appareil abonné au push (ARC-09, D4) : jamais l'adresse du service de push dans un écran.
export type PushDeviceView = { id: string; label: string; createdAt: string; lastUsedAt: string | null };

// Abonnement envoyé par le navigateur (PushSubscription.toJSON()). L'adresse est celle du service de
// push du navigateur, en https.
export const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(1000).refine((value) => value.startsWith("https://"), "https exigé"),
  keys: z.object({
    p256dh: z.string().regex(/^[A-Za-z0-9_-]{80,100}$/),
    auth: z.string().regex(/^[A-Za-z0-9_-]{16,32}$/),
  }),
});
export type PushSubscriptionInput = z.infer<typeof pushSubscriptionSchema>;

// Ce que reçoit le service worker : la sorte en mots et l'écran à ouvrir, rien d'autre.
export type PushMessage = { title: string; body: string; url: string; tag: string };

// --- Automatismes (HUB-28 ; D5) ---

export const AUTOMATION_KEYS = [
  "quote_signed_confirm_event",
  "payment_due_reminder",
  "rsvp_reminder",
  "client_task_reminder",
  "invoice_reminder",
  "proposal_expiry_reminder",
  "prospect_follow_up",
  "vendor_roadmap",
  "risk_radar",
] as const;
export type AutomationKey = (typeof AUTOMATION_KEYS)[number];

// Lot 66a (HUB-28 ; D1 ; ADR 0112) : les automatismes qui envoient un e-mail à une heure du jour ;
// chacun a son heure (« Envoi à »), sinon l'heure par défaut de l'organisation.
export const SEND_TIME_AUTOMATIONS = ["payment_due_reminder", "proposal_expiry_reminder", "invoice_reminder", "client_task_reminder", "rsvp_reminder", "vendor_roadmap", "prospect_follow_up"] as const satisfies readonly AutomationKey[];
export type SendTimeAutomation = (typeof SEND_TIME_AUTOMATIONS)[number];
// « HH:MM », au quart d'heure.
export const sendTimeSchema = z.string().regex(/^([01]\d|2[0-3]):(00|15|30|45)$/);

// Ce qui ne se coupe pas : affiché « toujours actif », avec sa raison.
export const ALWAYS_ON_AUTOMATIONS = ["privacy_purge", "ledger_check"] as const;
export type AlwaysOnAutomation = (typeof ALWAYS_ON_AUTOMATIONS)[number];

export const AUTOMATION_RESULTS = ["sent", "skipped", "failed", "done"] as const;
export type AutomationResult = (typeof AUTOMATION_RESULTS)[number];

export type AutomationRunView = {
  id: string;
  ranAt: string;
  result: AutomationResult;
  // L'objet en mots courts (numéro de devis, intitulé de tâche…) et son écran.
  objectLabel: string | null;
  href: string | null;
};

export type AutomationView = {
  key: AutomationKey;
  // Le module dont il dépend ; fermé, l'automatisme est « indisponible » (ARC-06).
  module: string;
  available: boolean;
  enabled: boolean;
  // Réglage en jours, quand il en a un (J-7 du rappel avant échéance).
  days: number | null;
  resumedAt: string | null;
  // Lot 66a : l'heure propre de l'automatisme (null : l'heure par défaut) et l'heure qui s'applique ;
  // null pour un automatisme qui n'envoie pas à heure fixe.
  sendTime: string | null;
  effectiveSendTime: string | null;
  runs: AutomationRunView[];
};

export const automationDaysSchema = z.number().int().min(1).max(60);

// --- Radar des risques (GC-02 ; D7) ---

export const RISK_RULES = [
  "vendor_without_contract",
  "decision_overdue",
  "document_expired",
  "payment_overdue",
  "milestone_late",
  "iban_to_verify",
  "roadmap_unconfirmed",
] as const;
export type RiskRuleKey = (typeof RISK_RULES)[number];

export type RiskRuleView = { rule: RiskRuleKey; module: string; available: boolean; enabled: boolean; thresholdDays: number };

export const riskThresholdSchema = z.number().int().min(0).max(365);

// Une alerte du radar : sa règle, son objet, ses faits (pour l'explication) et l'écran où agir.
export type RiskAlert = {
  rule: RiskRuleKey;
  key: string;
  eventId: string | null;
  eventNames: string | null;
  label: string;
  // Faits chiffrés de l'explication (« retenu depuis 21 jours ; seuil : 14 jours avant »).
  facts: Record<string, string | number>;
  thresholdDays: number;
  href: string;
};

// Ce qu'un module reçoit de l'automatisme qui le lance (D5) : notBefore, le jour (Paris, « AAAA-MM-JJ »)
// de la remise en route — un envoi prévu avant ne part pas, rien n'est rattrapé ; onRun, la trace de
// chaque exécution, sans donnée personnelle (un identifiant, un libellé de pièce, l'écran).
export type AutomationRunReport = { objectKey: string; objectLabel?: string | null; href?: string | null; result: AutomationResult };
// Lot 66a (D1 ; ADR 0112) : isSendTime dit si l'heure d'envoi de l'automatisme est venue, dans le fuseau
// donné (celui de l'évènement ; Europe/Paris sans évènement). Absent : pas de contrainte d'heure.
export type AutomationHooks = { notBefore?: string | null; onRun?: (run: AutomationRunReport) => Promise<void>; isSendTime?: (now: Date, timeZone?: string) => boolean };
