// SEC-01 (lot 16, ADR 0037) — secrets de double authentification, pour
// l'opérateur (Julien), avec la clé MFA_ENCRYPTION_KEY de l'environnement :
//   pnpm --filter @symbola/auth mfa-secrets -- --seal    chiffre ceux encore en clair
//                                                         (l'app le fait aussi au démarrage)
//   pnpm --filter @symbola/auth mfa-secrets -- --unseal  les remet en clair, seulement
//                                                         avant de relancer une image
//                                                         antérieure au lot 16
// Voir docs/runbooks/deploiement.md (§ Lot 16) et restauration.md (§ 4 bis).
import { createAppConnection } from "@symbola/db/client";
import { sealLegacyTotpSecrets, unsealTotpSecrets } from "../src/service";

async function main() {
  const mode = process.argv.slice(2).find((arg) => arg === "--seal" || arg === "--unseal");
  if (!mode) {
    console.error("Préciser --seal (chiffrer) ou --unseal (remettre en clair avant un retour arrière).");
    process.exitCode = 1;
    return;
  }
  const { sql, db } = createAppConnection();
  try {
    if (mode === "--seal") console.log(`Secrets chiffrés : ${await sealLegacyTotpSecrets(db)}.`);
    else console.log(`Secrets remis en clair : ${await unsealTotpSecrets(db)}. Relancez maintenant l'image antérieure au lot 16.`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? `Erreur : ${error.message}` : error);
  process.exitCode = 1;
});
