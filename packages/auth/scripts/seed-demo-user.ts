// Script de dev uniquement (SOC-04) : crée une organisation et un
// utilisateur de démonstration pour exercer manuellement le parcours de
// connexion (lien magique, lot 33). Jamais destiné à la production — refuse
// de s'exécuter si NODE_ENV=production.
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

    await createUser(db, { organizationId: organization.id, email, role: "owner" });

    console.log("Organisation :", organization.name, `(${organization.id})`);
    console.log("Connexion : lien magique envoyé à", email, "(Mailpit, http://localhost:8025).");
  } finally {
    await sql.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
