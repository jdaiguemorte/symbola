// Schéma des variables d'environnement de l'app (SOC-03). Chaque story qui
// ajoute un service (auth SOC-04, événements SOC-06, fichiers SOC-08…)
// complète ce schéma plutôt que d'en créer un autre : une seule validation,
// un seul point d'échec clair au démarrage.
//
// Note (SOC-05) : seules les variables du rôle applicatif PostgreSQL
// (POSTGRES_APP_*) sont ici — l'app qui tourne ne détient jamais les
// identifiants admin. Les identifiants admin (POSTGRES_ADMIN_*), utilisés
// uniquement pour les migrations et le bootstrap des rôles/RLS, sont
// validés séparément dans packages/db (voir packages/db/src/admin-env.ts) :
// ils n'ont pas besoin d'être présents dans l'environnement de l'app
// déployée.
import { z } from "zod";

// z.coerce.boolean() utilise Boolean(valeur) — "false" (chaîne non vide)
// devient donc `true`, ce qui a cassé S3_USE_SSL (SOC-08, détecté par les
// tests d'intégration : Garage en HTTP forcé en HTTPS). Ce helper traite
// explicitement "false"/"0" comme faux.
const booleanFromEnv = z.preprocess((value) => {
  if (typeof value !== "string") return value;
  return !["false", "0", ""].includes(value.toLowerCase());
}, z.boolean());

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_PORT: z.coerce.number().int().positive().default(3000),

  // PostgreSQL — rôle applicatif uniquement (packages/db, SOC-05)
  POSTGRES_HOST: z.string().min(1).default("localhost"),
  POSTGRES_PORT: z.coerce.number().int().positive().default(5432),
  POSTGRES_DB: z.string().min(1).default("symbola"),
  POSTGRES_APP_USER: z.string().min(1).default("symbola_app"),
  POSTGRES_APP_PASSWORD: z.string().min(1),

  // Stockage objet compatible S3 — Garage en dev/MVP (ADR 0015, remplace
  // MinIO), SOC-08. Noms de variables génériques (S3_*, pas GARAGE_*) pour
  // qu'un futur changement de fournisseur ne touche que le compose.
  S3_ENDPOINT: z.string().min(1).default("localhost"),
  S3_PORT: z.coerce.number().int().positive().default(3900),
  S3_USE_SSL: booleanFromEnv.default(false),
  S3_REGION: z.string().min(1).default("garage"),
  S3_BUCKET: z.string().min(1).default("symbola"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),

  // ClamAV (SOC-08)
  CLAMAV_HOST: z.string().min(1).default("localhost"),
  CLAMAV_PORT: z.coerce.number().int().positive().default(3310),

  // E-mail de dev (Mailpit) — jamais d'e-mail réel hors production (CLAUDE.md §3)
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
});

export type Env = z.infer<typeof envSchema>;
