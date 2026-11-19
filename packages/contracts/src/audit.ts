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

// Lot 26a (ADR 0053) : « link », un tiers agissant par son lien personnel
// (actor_id : le lien).
export const AUDIT_ACTOR_KINDS = ["member", "admin", "operator", "system", "link"] as const;
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
  // Lot 24b (SEC-06) : « Déconnecter tous mes appareils ».
  "hub.sessions.revoked": { category: "connexion", objectType: "user" },
  // Lot 52 (SEC-08, D6) : changement d'adresse, de facteur ou de mot de passe annoncé par le webhook signé
  // du fournisseur d'identité ; appel refusé (signature absente ou fausse). Aucune adresse au journal.
  "hub.identity.changed": { category: "connexion", objectType: "user" },
  "hub.identity_webhook.refused": { category: "connexion", objectType: null },
  // Lot 26a (SEC-17) : un tiers ouvre son lien personnel (objet : l'événement).
  "events.link.opened": { category: "connexion", objectType: "event" },
  // Lot 26b (POR-01) : code à usage unique envoyé, puis bloqué après cinq essais.
  "events.link.code_sent": { category: "connexion", objectType: "event" },
  "events.link.code_locked": { category: "connexion", objectType: "event" },
  // Droits.
  "hub.organization.created": { category: "droits", objectType: "organization" },
  "hub.invitation.resent": { category: "droits", objectType: "organization" },
  // Lot 33b (HUB-03, D12) : la Propriétaire invite une Planner (aucune adresse au journal).
  "hub.invitation.sent": { category: "droits", objectType: "organization" },
  "hub.invitation.accepted": { category: "droits", objectType: "user" },
  "hub.module.enabled": { category: "droits", objectType: "organization" },
  "hub.module.disabled": { category: "droits", objectType: "organization" },
  "hub.user.mfa_reset": { category: "droits", objectType: "user" },
  // Lot 24a (SEC-13, SC-S1) : identifiant introuvable demandé dans une adresse.
  "hub.access.refused": { category: "droits", objectType: null },
  // Lot 24b (SEC-06, décision D3) : la titulaire retire l'accès d'un collaborateur.
  "hub.member.removed": { category: "droits", objectType: "user" },
  // Lot 52 (HUB-04, D1, D2) : transfert de propriété demandé puis confirmé (rôles échangés) ; réglage
  // « toutes les Planners voient tous les évènements ».
  "hub.ownership.transfer_requested": { category: "droits", objectType: "user" },
  "hub.ownership.transferred": { category: "droits", objectType: "user" },
  "hub.ownership.transfer_cancelled": { category: "droits", objectType: "user" },
  "hub.organization.visibility_changed": { category: "droits", objectType: "organization" },
  // Administration de la plateforme (sans organisation).
  "hub.platform_settings.updated": { category: "administration", objectType: null },
  // Lot 31a (FAC-07, décision D4) : liste des mentions requises réglée par l'Admin.
  "hub.required_mentions.updated": { category: "administration", objectType: null },
  // Lot 41 (GC-03, D12) : vérifications de l'assistant de conformité désactivées par l'Admin.
  "hub.compliance_checks.updated": { category: "administration", objectType: null },
  // Exports.
  "hub.privacy_export.created": { category: "export", objectType: "privacy_export" },
  "hub.privacy_export.downloaded": { category: "export", objectType: "privacy_export" },
  // Lot 35a (HUB-13, D4, D5) : export complet de l'organisation demandé par la Propriétaire,
  // préparé en arrière-plan (auteur : le système), puis téléchargé.
  "hub.organization_export.requested": { category: "export", objectType: "organization_export" },
  "hub.organization_export.ready": { category: "export", objectType: "organization_export" },
  "hub.organization_export.downloaded": { category: "export", objectType: "organization_export" },
  // Lot 35b (HUB-13, ADR 0098) : reprise d'un export Symbola dans une organisation vide.
  "hub.organization_import.requested": { category: "export", objectType: "organization_import" },
  "hub.organization_import.completed": { category: "export", objectType: "organization_import" },
  "hub.organization_import.failed": { category: "export", objectType: "organization_import" },
  "vendors.vendors.exported": { category: "export", objectType: null },
  "quotes.e_reporting.exported": { category: "export", objectType: null },
  "quotes.archive.exported": { category: "export", objectType: null },
  // Lot 28c (BUD-10) : export du budget d'un événement (format, nombre de lignes).
  "budget.budget.exported": { category: "export", objectType: "event" },
  // Partages.
  // Comptes des mariés (ADR 0020), retirés au lot 26a : gardés pour relire le journal.
  "events.client_access.granted": { category: "partage", objectType: "event" },
  "events.client_access.revoked": { category: "partage", objectType: "event" },
  // Lot 26a (UX-11, SEC-14, SEC-15 ; ADR 0053) : liens personnels des tiers
  // (détails : identifiant du lien, public ; jamais le jeton ni l'e-mail).
  "events.link.created": { category: "partage", objectType: "event" },
  "events.link.updated": { category: "partage", objectType: "event" },
  "events.link.renewed": { category: "partage", objectType: "event" },
  "events.link.revoked": { category: "partage", objectType: "event" },
  // Lot 52 (EVT-06, D2) : équipe d'un évènement (planner principal, assistant).
  "events.team.changed": { category: "droits", objectType: "event" },
  "events.link.renewal_requested": { category: "partage", objectType: "event" },
  // Lot 27a (CHR-04, D7) : rappel des tâches envoyé au client (nombre de tâches).
  "events.link.reminder_sent": { category: "partage", objectType: "event" },
  // Lot 27b (EVT-09) : décisions demandées au client (identifiants seulement).
  "events.decision.requested": { category: "partage", objectType: "event" },
  "events.decision.answered": { category: "partage", objectType: "event" },
  "events.decision.withdrawn": { category: "partage", objectType: "event" },
  // Lot 44 (CRM-01 ; D1, D4, D5) : formulaire de contact public réglé (ouvert ou fermé), demande reçue
  // (prospect créé) ou mise de côté (« à vérifier ») ; identifiants seulement (SEC-20).
  "events.contact_form.updated": { category: "partage", objectType: null },
  "events.prospect_request.received": { category: "partage", objectType: "event" },
  "events.prospect_request.to_review": { category: "partage", objectType: null },
  // Lot 47 (PAR-05, PRE-03, PRE-04, PRE-09 ; ADR 0085) : prestataires par lien (identifiants, nombres,
  // étape ; jamais un nom, un e-mail ni un montant).
  "events.vendor_brief.sent": { category: "partage", objectType: "event" },
  "events.vendor_brief.reminded": { category: "partage", objectType: "event" },
  "events.vendor.answered": { category: "partage", objectType: "event" },
  "events.vendor.invoice_received": { category: "partage", objectType: "event" },
  "events.vendor_roadmap.sent": { category: "partage", objectType: "event" },
  "events.vendor_roadmap.confirmed": { category: "partage", objectType: "event" },
  "events.decision.engaged": { category: "partage", objectType: "event" },
  "events.vendor_retention.changed": { category: "partage", objectType: "event" },
  // Lot 45 (CRM-05, CRM-06, POR-07 ; D1, D2) : réponse envoyée à un prospect depuis Symbola, relance
  // envoyée (par la planner ou d'elle-même), questionnaire envoyé ; identifiants seulement (SEC-20).
  "events.prospect_message.sent": { category: "partage", objectType: "event" },
  "events.follow_up.sent": { category: "partage", objectType: "event" },
  "events.questionnaire.sent": { category: "partage", objectType: "event" },
  // Lot 45 (CRM-07 ; D4, D5) : deux fiches de contact réunies par la planner (la fiche absorbée
  // disparaît) ; identifiants et noms des champs repris seulement.
  "hub.contact.merged": { category: "suppression", objectType: "contact" },
  // Lot 24b (SEC-22, décision D5) : plafond d'e-mails de l'heure atteint.
  "hub.mail.quota_reached": { category: "partage", objectType: null },
  // Lot 38a (MSG-01, D5) : un e-mail automatique n'est pas parti, une variable du modèle étant vide
  // (nature du modèle et clés des variables seulement).
  "hub.mail.variable_missing": { category: "partage", objectType: "event" },
  "quotes.quote.sent": { category: "partage", objectType: "quote" },
  "quotes.signature.requested": { category: "partage", objectType: "quote" },
  // Lot 34a (FAC-13, D7) : au report confirmé, les échéances d'un devis signé suivent la date.
  "quotes.schedule.shifted": { category: "emission", objectType: "quote" },
  // Lot 31a (FAC-01, décision D2) : options choisies par le client, ou par la planner pour lui.
  "quotes.quote.options_chosen": { category: "partage", objectType: "quote" },
  // Lot 31b (FAC-04, JUR-07 ; D11, D13) : contrat généré ; commande et demande d'exécution
  // anticipée du client (identifiants seulement).
  "quotes.contract.generated": { category: "partage", objectType: "quote" },
  "quotes.contract.ordered": { category: "partage", objectType: "quote" },
  "quotes.contract.early_execution_requested": { category: "partage", objectType: "quote" },
  // Lot 41 (JUR-13, D8) : numéro de bon de commande indiqué par le client depuis son lien.
  "quotes.order_reference.set_by_client": { category: "partage", objectType: "quote" },
  // Lot 41 (GC-03, D12) : points de l'assistant de conformité affichés (clés, sans donnée personnelle).
  "quotes.compliance.shown": { category: "emission", objectType: "quote" },
  // Émissions.
  "quotes.invoice.issued": { category: "emission", objectType: "invoice" },
  "quotes.credit_note.issued": { category: "emission", objectType: "credit_note" },
  // Lot 23b (DOC-08, FAC-14, ADR 0061) : original altéré, anomalie de la chaîne.
  "quotes.original.altered": { category: "emission", objectType: "invoice" },
  "quotes.ledger.anomaly_detected": { category: "emission", objectType: null },
  // Encaissements.
  "quotes.payment.recorded": { category: "encaissement", objectType: "payment_schedule_item" },
  "quotes.payment.cancelled": { category: "encaissement", objectType: "payment_schedule_item" },
  // Lot 27a (SC-06, D6) : règlement d'une échéance de prestataire déclaré par
  // un client (le lien pour auteur), puis confirmé ou refusé par la planner.
  "budget.vendor_payment.declared": { category: "encaissement", objectType: "event" },
  "budget.vendor_payment.declaration_cancelled": { category: "encaissement", objectType: "event" },
  "budget.vendor_payment.declaration_confirmed": { category: "encaissement", objectType: "event" },
  "budget.vendor_payment.declaration_refused": { category: "encaissement", objectType: "event" },
  // Lot 43 (FAC-08 Divergent, FAC-09, FAC-15, SEC-16, BUD-06 ; ADR 0087, ADR 0089) : virement déclaré
  // par le payeur depuis son lien, relances d'une échéance suspendues ou reprises par la planner,
  // validité d'un devis prolongée, code demandé avant de signer, payeurs et leurs parts (identifiants
  // seulement, jamais le nom ni l'IBAN).
  "quotes.transfer.declared": { category: "encaissement", objectType: "payment_schedule_item" },
  "quotes.reminders.suspended": { category: "encaissement", objectType: "payment_schedule_item" },
  "quotes.reminders.resumed": { category: "encaissement", objectType: "payment_schedule_item" },
  "quotes.validity.extended": { category: "partage", objectType: "quote" },
  "quotes.signing_code.verified": { category: "partage", objectType: "quote" },
  "budget.payers.changed": { category: "partage", objectType: "event" },
  "budget.payer_visibility.changed": { category: "partage", objectType: "event" },
  // Suppressions en masse (une ligne de synthèse, pas une par ligne effacée).
  "hub.privacy_erasure.executed": { category: "suppression", objectType: "privacy_erasure" },
  "hub.privacy_purge.executed": { category: "suppression", objectType: "privacy_purge" },
  // Exploitation (SEC-09) : sans organisation, visibles dans chaque journal.
  "ops.database.opened": { category: "exploitation", objectType: null },
  "ops.database.closed": { category: "exploitation", objectType: null },
  "ops.backup.restored": { category: "exploitation", objectType: null },
  // Lot 40a (NFR-07, ARC-14, ADR 0075) : deploy.sh et rollback.sh, avec la version et, pour un
  // correctif urgent hors fenêtre, son motif.
  "ops.deploy.completed": { category: "exploitation", objectType: null },
  "ops.deploy.rolled_back": { category: "exploitation", objectType: null },
  // Lot 49 (module Invités, ADR 0083) : objet l'évènement, jamais l'invité nommé (SEC-20).
  // Partie G : la titulaire confirme avoir complété l'analyse d'impact.
  "guests.impact_assessment.confirmed": { category: "droits", objectType: null },
  // INV-03 (D3, D4) : liens personnels des invités créés, envoyés, retirés ; page ouverte.
  "guests.link.created": { category: "partage", objectType: "event" },
  "guests.link.revoked": { category: "partage", objectType: "event" },
  "guests.invitations.sent": { category: "partage", objectType: "event" },
  "guests.link.opened": { category: "connexion", objectType: "event" },
  // RGP-06 : accord aux régimes donné ou retiré par l'invité (la preuve est dans la table).
  "guests.diet_consent.granted": { category: "droits", objectType: "event" },
  "guests.diet_consent.withdrawn": { category: "droits", objectType: "event" },
  // RGP-08 : opposition d'un invité, report de la purge, purges exécutées.
  "guests.guest.opposed": { category: "suppression", objectType: "event" },
  "guests.purge.postponed": { category: "suppression", objectType: "event" },
  // Lot 60 (L60-PLA-05) : une version du plan de salle d'un évènement diffusée au client et aux prestataires.
  "floorplans.plan.published": { category: "partage", objectType: "event" },
  "guests.purge.executed": { category: "suppression", objectType: "event" },
  // INV-02 : liste importée, import annulé.
  "guests.import.applied": { category: "emission", objectType: "event" },
  "guests.import.undone": { category: "suppression", objectType: "event" },
  // Lot 50 (INV-06, D8) : synthèse pour le traiteur téléchargée (temps fort, version, format ;
  // jamais son contenu, jamais un nom) ; elle n'est rangée nulle part dans Symbola.
  "guests.caterer_summary.downloaded": { category: "export", objectType: "event" },
  // Lot 51 (CHR-08) : chrono importé d'un tableur (nombre de séquences et de temps forts créés).
  "events.program.imported": { category: "emission", objectType: "event" },
  // Lot 51 (JRJ-05) : décalage du jour J validé par la planner, appliqué et diffusé aux prestataires.
  "events.day_shift.applied": { category: "partage", objectType: "event" },
  // Lot 51 (PAR-08, étape 7) : bilan du lendemain exporté en PDF (jamais son contenu).
  "events.day_report.downloaded": { category: "export", objectType: "event" },
  // Lot 48a (PRE-10, SEC-27 ; ADR 0093) : IBAN d'un prestataire changé (par la planner ou par son lien)
  // puis vérifié par un autre canal ; identifiants seulement, jamais l'IBAN, même masqué (SEC-20).
  "vendors.bank_details.changed": { category: "encaissement", objectType: "vendor" },
  "vendors.bank_details.verified": { category: "encaissement", objectType: "vendor" },
  // Lot 48a (PRE-05, D3) : pièce demandée au prestataire, déposée par son lien, vérifiée par la planner.
  "vendors.document.requested": { category: "partage", objectType: "vendor" },
  "vendors.document.received": { category: "partage", objectType: "vendor" },
  "vendors.document.verified": { category: "partage", objectType: "vendor" },
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
