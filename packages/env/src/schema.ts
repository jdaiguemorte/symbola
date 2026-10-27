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
  // URL publique de l'app (HUB-03) : construit les liens dans les e-mails
  // (invitation…). Dérivée de APP_DOMAIN par le compose de déploiement.
  APP_PUBLIC_URL: z.string().min(1).default("http://localhost:3000"),
  // Version déployée, affichée par /health (SOC-11) : SHA du commit gravé
  // dans l'image par la CI, « dev » en local.
  APP_VERSION: z.string().min(1).default("dev"),

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

  // E-mail de dev (Mailpit) — jamais d'e-mail réel hors production (CLAUDE.md §3).
  // Mailpit n'exige pas d'authentification : SMTP_USER/PASSWORD restent
  // vides en dev, remplis en staging/production (compte Ionos réel).
  SMTP_HOST: z.string().min(1).default("localhost"),
  SMTP_PORT: z.coerce.number().int().positive().default(1025),
  SMTP_USER: z.string().default(""),
  SMTP_PASSWORD: z.string().default(""),
  SMTP_FROM: z.string().min(1).default("Symbola <no-reply@symbola.test>"),

  // Signature en ligne (DEV-02, ADR 0021). Sans valeur : faux fournisseur
  // hors production, « indisponible » en production tant que DocuSeal n'est
  // pas configuré par Julien. Le faux fournisseur est interdit en production
  // (seuls les devis d'essai guidé l'utilisent, quel que soit ce réglage).
  // Vide (compose sans valeur) = non renseigné.
  SIGNATURE_PROVIDER: z.preprocess((value) => (value === "" ? undefined : value), z.enum(["none", "fake", "docuseal"]).optional()),
  SIGNATURE_WEBHOOK_HEADER: z.string().min(1).default("X-Symbola-Webhook-Secret"),
  SIGNATURE_WEBHOOK_SECRET: z.string().default(""),
  // API interne (ex. http://docuseal:3000/api) et URL publique des pages de
  // signature (sous-domaine servi par Caddy).
  DOCUSEAL_API_URL: z.string().default(""),
  DOCUSEAL_API_KEY: z.string().default(""),
  DOCUSEAL_PUBLIC_URL: z.string().default(""),
}).superRefine((env, context) => {
  if (env.NODE_ENV === "production" && env.SIGNATURE_PROVIDER === "fake") {
    context.addIssue({ code: "custom", path: ["SIGNATURE_PROVIDER"], message: "le faux fournisseur de signature est interdit en production" });
  }
  if (env.SIGNATURE_PROVIDER === "docuseal") {
    for (const key of ["DOCUSEAL_API_URL", "DOCUSEAL_API_KEY", "DOCUSEAL_PUBLIC_URL", "SIGNATURE_WEBHOOK_SECRET"] as const) {
      if (env[key].length === 0) context.addIssue({ code: "custom", path: [key], message: "requis avec SIGNATURE_PROVIDER=docuseal" });
    }
    if (env.SIGNATURE_WEBHOOK_SECRET.length > 0 && env.SIGNATURE_WEBHOOK_SECRET.length < 32) {
      context.addIssue({ code: "custom", path: ["SIGNATURE_WEBHOOK_SECRET"], message: "32 caractères au moins (openssl rand -hex 32)" });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

// Fournisseur effectif des devis réels (ADR 0021).
export function signatureProviderOf(env: Env): "none" | "fake" | "docuseal" {
  return env.SIGNATURE_PROVIDER ?? (env.NODE_ENV === "production" ? "none" : "fake");
}
