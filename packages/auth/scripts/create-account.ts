// Création d'un compte par l'opérateur, sur le serveur (docs/runbooks/deploiement.md,
// « Premiers comptes ») :
//   pnpm --filter @symbola/auth create-account -- --role admin --email <e-mail>
//   pnpm --filter @symbola/auth create-account -- --role owner --email <e-mail> --organization "<nom>"
// Le mot de passe est généré et affiché une seule fois ; la MFA est
// configurée à la première connexion.
import { eq } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { users } from "@symbola/db/schema/hub";
import { AccountCliError, generatePassword, parseAccountArgs } from "../src/account-cli";
import { createOrganization, createUser } from "../src/service";

async function main() {
  const request = parseAccountArgs(process.argv.slice(2));
  const { sql, db } = createAppConnection();
  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, request.email));
    if (existing) throw new AccountCliError("un compte existe déjà avec cet e-mail");
    const password = generatePassword();
    if (request.role === "admin") {
      await createUser(db, { organizationId: null, email: request.email, password, role: "admin" });
      console.log("Compte Admin créé (opérateur de la suite, aucun accès aux données des organisations).");
    } else {
      const organization = await createOrganization(db, request.organization);
      await createUser(db, { organizationId: organization.id, email: request.email, password, role: "owner" });
      console.log(`Organisation « ${organization.name} » créée avec sa titulaire.`);
    }
    console.log(`Connexion : ${request.email}`);
    console.log(`Mot de passe (affiché une seule fois, à ranger dans le gestionnaire de mots de passe) : ${password}`);
    console.log("La double authentification (TOTP) sera configurée à la première connexion.");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof AccountCliError ? `Erreur : ${error.message}` : error);
  process.exitCode = 1;
});
