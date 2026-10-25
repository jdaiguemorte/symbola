// Préréglage ESLint partagé (flat config). Chaque app/package l'étend et
// ajoute ses propres règles. La règle de frontière entre modules (ADR 0011)
// est appliquée séparément par tools/boundaries/check-module-boundaries.mjs,
// car elle dépend de la structure de fichiers (modules/<x>/service.ts),
// pas seulement des imports TypeScript.
import tseslint from "typescript-eslint";

/** @type {import("eslint").Linter.Config[]} */
export const baseConfig = [
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
];

export default baseConfig;
