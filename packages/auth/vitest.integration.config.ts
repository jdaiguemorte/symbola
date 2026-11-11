import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    exclude: ["**/node_modules/**"],
    // Lot 24a (SEC-20) : aucune donnée personnelle écrite dans la console.
    setupFiles: ["@symbola/privacy/console-guard"],
  },
});
