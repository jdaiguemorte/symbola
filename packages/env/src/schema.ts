// Schéma des variables d'environnement du socle (SOC-03). Chaque story qui
// ajoute un service (auth SOC-04, événements SOC-06, fichiers SOC-08…)
// complète ce schéma plutôt que d'en créer un autre : une seule validation,
// un seul point d'échec clair au démarrage.
import { z } from "zod";

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_PORT: z.coerce.number().int().positive().default(3000),

  // PostgreSQL (packages/db, SOC-05)
  POSTGRES_HOST: z.string().min(1).default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().min(1).default("symbola"),
  POSTGRES_USER: z.string().min(1).default("symbola_app"),
  POSTGRES_PASSWORD: z.string().min(1),

  // MinIO / stockage objet (SOC-08)
  MINIO_ENDPOINT: z.string().min(1).default("localhost"),
  MINIO_PORT: z.coerce.number().int().positive().default(9000),
  MINIO_USE_SSL: z.coerce.boolean().default(false),
  MINIO_ACCESS_KEY: z.string().min(1),
  MINIO_SECRET_KEY: z.string().min(1),

  // ClamAV (SOC-08)
  CLAMAV_HOST: z.string().min(1).default("localhost"),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),

  // E-mail de dev (Mailpit) — jamais d'e-mail réel hors production (CLAUDE.md §3)
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
});

export type Env = z.infer<typeof envSchema>;
