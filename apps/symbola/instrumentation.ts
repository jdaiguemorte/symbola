// Next.js appelle register() une seule fois au démarrage du serveur.
// On en profite pour valider les variables d'environnement (SOC-03) avant
// que la moindre requête soit traitée : échec rapide et message clair.
export async function register() {
  await import("@symbola/env/validate-on-import");
  // AIDE-02 : purge horaire des essais abandonnés ; lot 5 : purge horaire
  // des imports en cours expirés ; lot 6 : purge horaire des exports RGPD
  // expirés. Côté Node seulement (pas dans le runtime
  // edge du middleware).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { scheduleDemoPurge } = await import("./lib/demo-purge");
    scheduleDemoPurge();
    const { scheduleImportPurge } = await import("./lib/import-purge");
    scheduleImportPurge();
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
    // Lot 16 (SEC-01, ADR 0037) : secrets de double authentification chiffrés
    // au repos ; ceux d'avant le lot 16 le sont une fois, au démarrage.
    const { sealLegacyMfaSecretsAtStartup } = await import("./lib/mfa-secrets");
    void sealLegacyMfaSecretsAtStartup();
  }
}
