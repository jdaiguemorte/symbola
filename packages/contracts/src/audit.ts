// Lot 23 (SEC-19, ARC-16, ADR 0060) — catalogue des actions du journal
// d'audit commun. Nom : <module>.<objet>.<action> au passé, comme les
// événements internes. Chaque action a sa famille (SEC-19 : connexions,
// droits, exports, partages, émissions, encaissements, suppressions ; plus
// l'exploitation de SEC-09 et l'administration de la plateforme) et le type
// de l'objet visé. Les suppressions sont écrites par un déclencheur
// générique, sous la forme <schéma>.<table>.deleted : elles ne figurent pas
// ici (voir isDeletionAction).

export const AUDIT_CATEGORIES = [
  "connexion",
  "droits",
  "export",
  "partage",
  "emission",
  "encaissement",
  "suppression",
  "exploitation",
  "administration",
] as const;
export type AuditCategory = (typeof AUDIT_CATEGORIES)[number];

export const AUDIT_ACTOR_KINDS = ["member", "admin", "operator", "system"] as const;
export type AuditActorKind = (typeof AUDIT_ACTOR_KINDS)[number];

type ActionSpec = { category: AuditCategory; objectType: string | null };

export const AUDIT_ACTIONS = {
  // Connexions (objet : le compte).
  "hub.session.opened": { category: "connexion", objectType: "user" },
  "hub.session.failed": { category: "connexion", objectType: "user" },
  "hub.session.closed": { category: "connexion", objectType: "user" },
  "hub.account.locked": { category: "connexion", objectType: "user" },
  "hub.password.reset": { category: "connexion", objectType: "user" },
  "hub.mfa.configured": { category: "connexion", objectType: "user" },
  "hub.trusted_devices.forgotten": { category: "connexion", objectType: "user" },
  // Droits.
  "hub.organization.created": { category: "droits", objectType: "organization" },
  "hub.invitation.resent": { category: "droits", objectType: "organization" },
  "hub.invitation.accepted": { category: "droits", objectType: "user" },
  "hub.module.enabled": { category: "droits", objectType: "organization" },
  "hub.module.disabled": { category: "droits", objectType: "organization" },
  "hub.user.mfa_reset": { category: "droits", objectType: "user" },
  // Administration de la plateforme (sans organisation).
  "hub.platform_settings.updated": { category: "administration", objectType: null },
  // Exports.
  "hub.privacy_export.created": { category: "export", objectType: "privacy_export" },
  "hub.privacy_export.downloaded": { category: "export", objectType: "privacy_export" },
  "vendors.vendors.exported": { category: "export", objectType: null },
  "quotes.e_reporting.exported": { category: "export", objectType: null },
  "quotes.archive.exported": { category: "export", objectType: null },
  // Partages.
  "events.client_access.granted": { category: "partage", objectType: "event" },
  "events.client_access.revoked": { category: "partage", objectType: "event" },
  "quotes.quote.sent": { category: "partage", objectType: "quote" },
  "quotes.signature.requested": { category: "partage", objectType: "quote" },
  // Émissions.
  "quotes.invoice.issued": { category: "emission", objectType: "invoice" },
  "quotes.credit_note.issued": { category: "emission", objectType: "credit_note" },
  // Lot 23b (DOC-08, FAC-14, ADR 0061) : original altéré, anomalie de la chaîne.
  "quotes.original.altered": { category: "emission", objectType: "invoice" },
  "quotes.ledger.anomaly_detected": { category: "emission", objectType: null },
  // Encaissements.
  "quotes.payment.recorded": { category: "encaissement", objectType: "payment_schedule_item" },
  "quotes.payment.cancelled": { category: "encaissement", objectType: "payment_schedule_item" },
  // Suppressions en masse (une ligne de synthèse, pas une par ligne effacée).
  "hub.privacy_erasure.executed": { category: "suppression", objectType: "privacy_erasure" },
  "hub.privacy_purge.executed": { category: "suppression", objectType: "privacy_purge" },
  // Exploitation (SEC-09) : sans organisation, visibles dans chaque journal.
  "ops.database.opened": { category: "exploitation", objectType: null },
  "ops.database.closed": { category: "exploitation", objectType: null },
  "ops.backup.restored": { category: "exploitation", objectType: null },
} as const satisfies Record<string, ActionSpec>;

export type AuditAction = keyof typeof AUDIT_ACTIONS;

export function auditActionSpec(action: AuditAction): ActionSpec {
  return AUDIT_ACTIONS[action];
}

// <schéma>.<table>.deleted, écrit par le déclencheur core.journal_deletion.
export function isDeletionAction(action: string): boolean {
  return /^[a-z_]+\.[a-z_]+\.deleted$/.test(action);
}

// Détails d'une ligne : identifiants, numéros, montants, codes. Jamais de
// nom, d'e-mail ni de téléphone (SEC-20).
export type AuditDetails = Record<string, string | number | boolean | null>;
