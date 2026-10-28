// Next.js appelle register() une seule fois au démarrage du serveur.
// On en profite pour valider les variables d'environnement (SOC-03) avant
// que la moindre requête soit traitée : échec rapide et message clair.
export async function register() {
  await import("@symbola/env/validate-on-import");
  // AIDE-02 : purge horaire des essais abandonnés ; lot 5 : purge horaire
  // des imports en cours expirés. Côté Node seulement (pas dans le runtime
  // edge du middleware).
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { scheduleDemoPurge } = await import("./lib/demo-purge");
    scheduleDemoPurge();
    const { scheduleImportPurge } = await import("./lib/import-purge");
    scheduleImportPurge();
  }
}
