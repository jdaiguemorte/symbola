// Variables d'environnement du rôle admin PostgreSQL — utilisées
// uniquement par les scripts de migration/bootstrap (SOC-05), jamais par
// l'app qui tourne (voir packages/env, qui ne connaît que le rôle
// applicatif). Schéma séparé : l'app déployée n'a jamais besoin, et ne
// reçoit jamais, ces identifiants.
import { z } from "zod";

const schema = z.object({
  POSTGRES_HOST: z.string().min(1).default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().min(1).default("symbola"),
  POSTGRES_ADMIN_USER: z.string().min(1).default("postgres"),
  POSTGRES_ADMIN_PASSWORD: z.string().min(1),
  POSTGRES_APP_USER: z.string().min(1).default("symbola_app"),
  POSTGRES_APP_PASSWORD: z.string().min(1),
});

export type AdminEnv = z.infer<typeof schema>;

export function parseAdminEnv(source: NodeJS.ProcessEnv): AdminEnv {
  const result = schema.safeParse(source);

  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");
    throw new Error(`Variables d'environnement admin invalides ou manquantes :\n${details}`);
  }

  return result.data;
}
