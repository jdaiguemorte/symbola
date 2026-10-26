// Script de dev uniquement (SOC-04) : crée une organisation et un
// utilisateur de démonstration pour exercer manuellement le parcours de
// connexion + MFA. Jamais destiné à la production — refuse de s'exécuter
// si NODE_ENV=production.
import { createAppConnection } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { createOrganization, createUser } from "../src/service";

async function main() {
  const env = parseEnv(process.env);
  if (env.NODE_ENV === "production") {
    throw new Error("seed-demo-user ne doit jamais tourner en production");
  }

  const { sql, db } = createAppConnection();

  try {
    const organization = await createOrganization(db, "Organisation de démonstration");
    const email = "demo-planner@symbola.test";
    const password = "mot-de-passe-demo-local";

    await createUser(db, {
      organizationId: organization.id,
      email,
      password,
      role: "owner",
    });

    console.log("Organisation :", organization.name, `(${organization.id})`);
    console.log("Connexion :", email, "/", password);
    console.log("Rôle professionnel : la configuration TOTP sera demandée à la première connexion.");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
