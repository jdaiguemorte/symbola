import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Lot 40b (NFR-21, décision D13, ADR 0076) — les règles métier : calculs (montants, TVA, budget,
// échéanciers, acomptes), droits (accès, portée et codes des liens personnels, débit) et échéances
// (rétroplanning, rappels, cycle de vie, décisions). Seuil de 80 % des lignes et des branches,
// contrôlé en CI par `pnpm --filter @symbola/app test:coverage`. Un nouveau fichier de règles
// rejoint cette liste.
export const BUSINESS_RULE_FILES = [
  "modules/quotes/amounts.ts",
  "modules/quotes/invoicing.ts",
  "modules/quotes/payment-terms.ts",
  "modules/quotes/schedule.ts",
  "modules/budget/vat.ts",
  "modules/budget/allocation.ts",
  "lib/guards.ts",
  "lib/rate-limit.ts",
  "modules/events/link-tokens.ts",
  "modules/events/link-otp.ts",
  "modules/events/schedule.ts",
  "modules/events/task-reminders.ts",
  "modules/events/lifecycle.ts",
  "modules/events/decisions.ts",
  // Lot 49 : foyers et RSVP, régimes (accord, chiffrement, compteurs), relances, purge, import.
  "modules/guests/rsvp.ts",
  "modules/guests/diets.ts",
  "modules/guests/reminders.ts",
  "modules/guests/purge-rules.ts",
  "modules/guests/import-rules.ts",
  // Lot 46 (RDV-02) : calcul des créneaux libres.
  "modules/appointments/slots.ts",
  // Lot 44 : formulaire de contact (validation, budget, liens, sites autorisés) et pipeline (cartes, ordre).
  "modules/events/contact-form-rules.ts",
  "modules/events/pipeline-rules.ts",
  "lib/csp.ts",
];

export default defineConfig({
  // Même alias « @/ » que tsconfig.json, pour tester les écrans (app/).
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // JSX des composants rendus côté serveur dans les tests (PDF, PRD-EVT-05),
  // comme le fait Next.js.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
    coverage: {
      provider: "v8",
      include: BUSINESS_RULE_FILES,
      reporter: ["text"],
      thresholds: { lines: 80, branches: 80 },
    },
  },
});
