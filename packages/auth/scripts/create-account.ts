// Création d'un compte par l'opérateur, sur le serveur (docs/runbooks/deploiement.md,
// « Premiers comptes ») :
//   pnpm --filter @symbola/auth create-account -- --role admin --email <e-mail>
//   pnpm --filter @symbola/auth create-account -- --role owner --email <e-mail> --organization "<nom>"
// Lot 33 (SEC-01, ADR 0067) : aucun mot de passe. La personne se connecte par lien magique à
// son adresse ; le compte Symbola est relié à son compte chez le fournisseur à la première
// connexion. La double authentification est exigée pour l'exploitation et la titulaire (D4).
import { eq } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { users } from "@symbola/db/schema/hub";
import { AccountCliError, parseAccountArgs } from "../src/account-cli";
import { createOrganization, createUser } from "../src/service";

async function main() {
  const request = parseAccountArgs(process.argv.slice(2));
  const { sql, db } = createAppConnection();
  try {
    const [existing] = await db.select({ id: users.id }).from(users).where(eq(users.email, request.email));
    if (existing) throw new AccountCliError("un compte existe déjà avec cet e-mail");
    if (request.role === "admin") {
      await createUser(db, { organizationId: null, email: request.email, role: "admin" });
      console.log("Compte d'exploitation créé (aucun accès aux données des organisations).");
    } else {
      const organization = await createOrganization(db, request.organization);
      await createUser(db, { organizationId: organization.id, email: request.email, role: "owner" });
      console.log(`Organisation « ${organization.name} » créée avec sa titulaire.`);
    }
    console.log(`Connexion : « Recevoir un lien de connexion » sur la page de connexion, avec ${request.email}.`);
    console.log("La double authentification sera demandée par le fournisseur d'identité.");
  } finally {
    await sql.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof AccountCliError ? `Erreur : ${error.message}` : error);
  process.exitCode = 1;
});
