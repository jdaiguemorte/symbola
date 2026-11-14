// Lot 33 (SEC-01, D3, ADR 0067) — reprise des comptes chez le fournisseur d'identité, une fois au
// déploiement, rejouable (docs/runbooks/deploiement.md, § Fournisseur d'identité) :
//   pnpm --filter @symbola/auth migrate-accounts
// Affiche des nombres seulement, jamais une adresse.
import { createAppConnection } from "@symbola/db/client";
import { z } from "zod";
import { migrateAccounts } from "../src/identity/account-migration";
import { createManagementClient, identityConnectionFromEnv } from "../src/identity/management";

const env = z
  .object({
    LOGTO_ENDPOINT: z.string().url(),
    LOGTO_M2M_APP_ID: z.string().min(1).default("symbola-bootstrap"),
    LOGTO_M2M_SECRET: z.string().min(32),
  })
  .parse(process.env);

async function main(): Promise<void> {
  const { sql, db } = createAppConnection();
  try {
    const report = await migrateAccounts(db, createManagementClient(identityConnectionFromEnv(env)));
    console.log(`Comptes reliés : ${report.linked} (dont ${report.created} créés chez le fournisseur, ${report.relinked} inconnus de lui et reliés de nouveau) ; déjà reliés : ${report.alreadyLinked}.`);
    console.log(`Double authentification exigée (titulaires et Exploitation) : ${report.mfaRequired}.`);
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
