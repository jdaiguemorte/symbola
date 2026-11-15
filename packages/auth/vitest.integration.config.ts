import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    exclude: ["**/node_modules/**"],
    // Lot 24a (SEC-20) : aucune donnée personnelle écrite dans la console.
    setupFiles: ["@symbola/privacy/console-guard"],
    // Un fichier à la fois : la reprise des comptes (account-migration, lot 33) relie au
    // fournisseur tous les comptes encore sans identifiant de la base, comme le script de
    // production. En parallèle, elle attrapait un compte qu'un autre fichier venait de créer, dont
    // la connexion était alors refusée (« session attendue »). 21 tests, moins d'une seconde.
    fileParallelism: false,
  },
});
