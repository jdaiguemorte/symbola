import { defineConfig } from "drizzle-kit";

// Config drizzle-kit (SOC-05). La connexion utilisée pour générer/appliquer
// les migrations est celle du rôle admin (packages/db/scripts/admin-env.ts),
// jamais celle du rôle applicatif — qui n'est pas propriétaire des tables.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/*.ts",
  out: "./drizzle",
});
