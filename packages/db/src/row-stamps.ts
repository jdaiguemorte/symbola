// Lot 23 (DAT-06, SEC-19, ADR 0060) — quelles tables portent quoi.
//
// Par défaut, chaque table a created_at, created_by, updated_at et
// updated_by, remplis par core.stamp_row(), et ses suppressions vont au
// journal d'audit (core.journal_deletion()). Les exceptions, motivées, sont
// listées ici ; le test row-stamps.integration.test.ts parcourt toutes les
// tables de la base et vérifie qu'aucune n'y échappe.

// Tables techniques : ni horodatage par ligne, ni journal des suppressions.
export const TECHNICAL_TABLES: Record<string, string> = {
  "core.audit_entries": "le journal lui-même (occurred_at, actor_id)",
  "core.domain_events": "événements internes, écrits par le système (occurred_at)",
  "core.domain_event_consumers": "suivi d'idempotence du worker",
  "core.usage_counters": "compteurs agrégés par jour, sans auteur",
  "core.rate_limit_events": "tentatives limitées, effacées sous 24 heures",
  "hub.sessions": "jeton de session d'un compte : l'auteur est le compte",
  "hub.password_resets": "jeton de réinitialisation d'un compte",
  "hub.trusted_devices": "jeton d'appareil de confiance d'un compte",
  "hub.backup_runs": "suivi des sauvegardes, écrit par l'exploitation",
  "hub.help_progress": "progression d'un compte dans l'aide : l'auteur est le compte",
  "hub.user_tour_seen": "visite guidée vue par un compte",
  "hub.connection_traces": "adresses IP des connexions, illisibles par l'app, purgées (décision D5)",
  "quotes.number_series": "compteur de numérotation, verrouillé en transaction",
  "quotes.signature_webhook_log": "trace technique des appels du fournisseur de signature (received_at)",
};

// Tables en ajout seul : une ligne ne change jamais. Auteur (created_by) et
// date de création ; la date peut être une date métier existante.
export const APPEND_ONLY_TABLES: Record<string, { createdAtColumn: string }> = {
  "budget.budget_line_history": { createdAtColumn: "changed_at" },
  "events.event_status_history": { createdAtColumn: "changed_at" },
  "events.event_activities": { createdAtColumn: "created_at" },
  "hub.vat_regime_changes": { createdAtColumn: "created_at" },
  "hub.privacy_erasures": { createdAtColumn: "created_at" },
  "hub.privacy_purges": { createdAtColumn: "created_at" },
  "quotes.invoices": { createdAtColumn: "issued_at" },
  "quotes.credit_notes": { createdAtColumn: "issued_at" },
};

// Tables horodatées dont les suppressions ne vont pas au journal : la
// plateforme elle-même (aucune organisation).
export const DELETION_NOT_JOURNALED: Record<string, string> = {
  "hub.organizations": "une organisation n'est jamais supprimée par l'app",
  "hub.platform_settings": "réglages de la plateforme, une seule ligne",
};
