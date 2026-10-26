import { envSchema, type Env } from "./schema";

export function parseEnv(source: NodeJS.ProcessEnv): Env {
  const result = envSchema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(
      `Variables d'environnement invalides ou manquantes :\n${details}\n` +
        "Voir .env.example pour la liste complète.",
    );
  }

  return result.data;
}
