// Next.js appelle register() une seule fois au démarrage du serveur.
// On en profite pour valider les variables d'environnement (SOC-03) avant
// que la moindre requête soit traitée : échec rapide et message clair.
export async function register() {
  // Lot 24a (SEC-20) : avant tout le reste, les journaux du serveur masquent
  // les adresses e-mail et les numéros de téléphone.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { installLogRedaction } = await import("./lib/log-redaction");
    installLogRedaction();
  }
  await import("@symbola/env/validate-on-import");
  // AIDE-02 : purge horaire des essais abandonnés ; lot 5 : purge horaire
  // des imports en cours expirés ; lot 6 : purge horaire des exports RGPD
  // expirés. Côté Node seulement (pas dans le runtime
  // edge du middleware). Lot 40b (ARC-10, ADR 0076) : les tâches périodiques
  // ne démarrent que dans le processus qui tient le verrou en base.
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { whenSchedulerLockHeld } = await import("./lib/scheduler-lock");
    whenSchedulerLockHeld(() => void startScheduledTasks());
  }
}

// Les imports restent sous la condition « nodejs » : Next.js ne les retire du build « edge » que là.
async function startScheduledTasks() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { scheduleDemoPurge } = await import("./lib/demo-purge");
    scheduleDemoPurge();
    const { scheduleImportPurge } = await import("./lib/import-purge");
    scheduleImportPurge();
    // Lot 39a (DAT-03, ADR 0073) : purge horaire de la corbeille (éléments après dix minutes, objets
    // après 30 jours).
    const { scheduleTrashPurge } = await import("./lib/trash");
    scheduleTrashPurge();
    const { schedulePrivacyExportPurge } = await import("./lib/privacy/export-purge");
    schedulePrivacyExportPurge();
    // Lot 6 : worker continu des événements internes (ADR 0014).
    const { scheduleEventWorker } = await import("./lib/event-worker");
    scheduleEventWorker();
    // Lot 15 (ADR 0035) : traitements de fond des imports (lecture des fiches
    // PDF, placement des prestataires sur la carte).
    const { scheduleImportJobs } = await import("./lib/import-jobs");
    scheduleImportJobs();
    // Lot 8 (ADR 0026) : rattrapage des signatures dont le webhook s'est perdu.
    const { scheduleSignatureReconciliation } = await import("./lib/signature-reconciliation");
    scheduleSignatureReconciliation();
    // Lot 16 (L16-SEC-02, ADR 0044) : tentatives limitées oubliées au bout d'un jour.
    const { scheduleRateLimitPurge } = await import("./lib/rate-limit");
    scheduleRateLimitPurge();
    // Lot 23b (FAC-14, ADR 0061) : contrôle quotidien de la chaîne des pièces.
    const { scheduleLedgerCheck } = await import("./lib/ledger-check");
    scheduleLedgerCheck();
    // Lot 23 (décision D5) : adresses IP des connexions oubliées après la durée réglée.
    const { scheduleConnectionTracePurge } = await import("./lib/connection-traces-purge");
    scheduleConnectionTracePurge();
    // Lot 27a (CHR-04) : rappels par e-mail des tâches confiées au client.
    const { scheduleClientTaskReminders } = await import("./lib/client-task-reminders");
    scheduleClientTaskReminders();
    // Lot 46 (RDV-02, RDV-03 ; D2, D10 ; ADR 0082) : agendas extérieurs relus toutes les quinze minutes,
    // rappels des rendez-vous.
    const { scheduleAppointmentJobs } = await import("./lib/appointment-jobs");
    scheduleAppointmentJobs();
    // Lot 45 (CRM-06, CRM-07 ; D2 ; ADR 0090) : relances des prospects préparées chaque heure (envoyées
    // seules si l'organisation l'a réglé), doublons de contacts cherchés chaque nuit.
    const { scheduleProspectTasks } = await import("./lib/prospect-follow-ups");
    scheduleProspectTasks();
    // Lot 31b (FAC-05, D6) : factures d'acompte émises d'elles-mêmes (fin du délai de rétractation).
    const { scheduleDepositInvoiceIssuance } = await import("./lib/deposit-invoices");
    scheduleDepositInvoiceIssuance();
    // Lot 35a (HUB-13, D4, ADR 0068) : préparation en arrière-plan des exports complets, et
    // purge horaire de leurs archives expirées.
    const { scheduleOrganizationExportPurge, scheduleOrganizationExports } = await import("./lib/export/organization-export-jobs");
    scheduleOrganizationExports();
    scheduleOrganizationExportPurge();
    // Lot 37b (DOC-12, D12, ADR 0071) : relevé mensuel du stockage de chaque organisation.
    const { scheduleStorageSnapshots } = await import("./lib/storage-snapshots");
    scheduleStorageSnapshots();
    // Lot 40b (ARC-10, ADR 0076) : e-mails repris quand le serveur d'envoi n'a pas répondu.
    const { scheduleJobs } = await import("./lib/jobs");
    scheduleJobs();
    // Lot 49 (INV-04, RGP-08 ; ADR 0083) : purge des invités avec préavis, puis relances.
    const { scheduleGuestTasks } = await import("./lib/guest-tasks");
    scheduleGuestTasks();
    // Lot 44 (CRM-01, D4) : demandes « à vérifier » du formulaire de contact non traitées, à 30 jours.
    const { scheduleProspectRequestPurge } = await import("./lib/prospect-request-purge");
    scheduleProspectRequestPurge();
    // Lot 47 (PAR-05 ; D2, D8 ; ADR 0085) : relance des briefs la veille, feuilles de route J-30 et J-7.
    const { scheduleVendorCoordinationTasks } = await import("./lib/vendor-coordination-tasks");
    scheduleVendorCoordinationTasks();
    // Lot 43 (FAC-09, FAC-15, JUR-07 ; ADR 0089) : relance avant expiration, RIB du 8e jour hors
    // établissement, relances d'impayés.
    const { scheduleSettlementJobs } = await import("./lib/settlement-jobs");
    scheduleSettlementJobs();
  }
}

// Lot 39b (NFR-16 ; D9 ; ADR 0074) : toute erreur du serveur est notée avec sa référence courte — celle
// que montre l'écran d'erreur —, la route et le nom de l'erreur ; jamais son message (il peut contenir
// une donnée personnelle, SEC-20).
export async function onRequestError(error: unknown, _request: unknown, context: { routePath?: string; routeType?: string }) {
  const { errorReference } = await import("./lib/error-reference");
  const digest = (error as { digest?: unknown }).digest;
  const name = error instanceof Error ? error.name : "inconnue";
  const reference = errorReference(typeof digest === "string" ? digest : name);
  console.error("erreur serveur", JSON.stringify({ reference, route: context.routePath ?? null, type: context.routeType ?? null, name }));
  // Lot 40b (Q27, D14, ADR 0077) : au suivi des erreurs aussi (sans message ni personne), si son
  // adresse est réglée.
  const { reportError } = await import("./lib/error-tracking");
  await reportError({ reference, name, stack: error instanceof Error ? (error.stack ?? null) : null, route: context.routePath ?? null, source: "serveur", release: process.env.APP_VERSION ?? "dev" });
}
