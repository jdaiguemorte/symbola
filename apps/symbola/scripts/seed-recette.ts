// Lot 24a (DAT-10, décision D7) — charge le jeu fictif de recette
// (docs/recette/symbola-synthetic-users.json) dans la base de l'environnement
// (variables POSTGRES_*). Refusé en production, et sur une base où le jeu est
// déjà chargé. Les comptes créés et leurs mots de passe vont dans un fichier
// local hors du dépôt, lisible par son seul propriétaire ; rien de personnel
// n'est affiché. Usage : pnpm --filter @symbola/app seed:recette [-- --comptes <fichier>]
import { readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { closeAppDatabase } from "@symbola/db/client";
import { loadRecette, RecetteRefusedError } from "@/lib/recette/load";

const REPOSITORY = fileURLToPath(new URL("../../..", import.meta.url));
const DATASET = join(REPOSITORY, "docs/recette/symbola-synthetic-users.json");

function accountsFile(args: string[]): string {
  const index = args.indexOf("--comptes");
  const chosen = index >= 0 ? args[index + 1] : undefined;
  const file = resolve(chosen ?? join(tmpdir(), "symbola-recette-comptes.txt"));
  if (!relative(REPOSITORY, file).startsWith("..")) {
    throw new Error("le fichier des comptes doit être hors du dépôt (il contient des mots de passe et des liens personnels)");
  }
  return file;
}

async function main(): Promise<void> {
  const file = accountsFile(process.argv.slice(2).filter((argument) => argument !== "--"));
  const result = await loadRecette(JSON.parse(readFileSync(DATASET, "utf8")));
  const lines = [
    "Jeu fictif de recette : comptes créés (données fictives, ne pas diffuser).",
    "organisation | rôle | nom | e-mail | mot de passe",
    ...result.accounts.map((account) => [account.organisation, account.role, account.nom, account.email, account.password].join(" | ")),
    "",
    // Lot 26a : liens personnels des clients et des payeurs, montrés une seule fois.
    "Liens personnels (à ouvrir dans un navigateur sans session de l'équipe).",
    "organisation | événement | profil | nom | e-mail | lien",
    ...result.links.map((link) => [link.organisation, link.evenement, link.profil, link.nom, link.email, link.url].join(" | ")),
  ];
  writeFileSync(file, `${lines.join("\n")}\n`, { mode: 0o600 });
  for (const organization of result.organizations) {
    console.log(`${organization.name} (${organization.id}) : ${organization.events} événement(s).`);
  }
  console.log(`${result.accounts.length} compte(s) et ${result.links.length} lien(s) personnel(s) ; identifiants dans ${file}.`);
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof RecetteRefusedError ? `Refusé : ${error.message}.` : error instanceof Error ? `Erreur : ${error.message}` : error);
    process.exitCode = 1;
  })
  .finally(() => closeAppDatabase());
