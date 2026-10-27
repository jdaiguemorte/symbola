import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // Même alias « @/ » que tsconfig.json (lib/ importe les modules par lui).
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  // JSX des PDF rendus par les routes appelées en test (DEV-01), comme le
  // fait Next.js.
  esbuild: { jsx: "automatic" },
  test: {
    environment: "node",
    include: ["**/*.integration.test.ts"],
    exclude: ["**/node_modules/**"],
  },
});
