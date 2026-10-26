// Next.js appelle register() une seule fois au démarrage du serveur.
// On en profite pour valider les variables d'environnement (SOC-03) avant
// que la moindre requête soit traitée : échec rapide et message clair.
export async function register() {
  await import("@symbola/env/validate-on-import");
}
