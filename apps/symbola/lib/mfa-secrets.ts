// L16-SEC-01 (lot 16, ADR 0037) — au démarrage, chiffre les secrets de double
// authentification encore en clair (comptes créés avant le lot 16). Sans effet
// une fois fait ; n'empêche jamais le démarrage (un secret en clair se relit,
// et se chiffre à la prochaine validation de code).
import { sealLegacyTotpSecrets } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";

export async function sealLegacyMfaSecretsAtStartup(): Promise<void> {
  const db = appDatabase();
  try {
    const sealed = await sealLegacyTotpSecrets(db);
    if (sealed > 0) console.info(`double authentification : ${sealed} secret(s) chiffré(s) au repos (L16-SEC-01)`);
  } catch (error) {
    // Journal sans donnée personnelle.
    console.error("double authentification : chiffrement des secrets au démarrage impossible", error instanceof Error ? error.name : "erreur");
  }
}
