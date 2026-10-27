import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Même alias « @/ » que tsconfig.json, pour tester les écrans (app/).
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // JSX des composants rendus côté serveur dans les tests (PDF, EVT-05),
  // comme le fait Next.js.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
});
