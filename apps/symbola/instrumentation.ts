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
  }
}
