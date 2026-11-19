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

// Lot 53 (ADR 0096) : la clé publique est bien celle de la clé privée (une paire mêlée ferait refuser
// chaque envoi par les services de push).
// Le schéma est aussi compilé pour le runtime edge (instrumentation) : pas d'import de node:crypto ; la
// vérification ne se fait que là où Node la fournit (le serveur, les scripts, les tests).
function vapidKeysMatch(publicKey: string, privateKey: string): boolean {
  const nodeCrypto = (globalThis.process as { getBuiltinModule?: (name: string) => unknown } | undefined)?.getBuiltinModule?.("node:crypto") as typeof import("node:crypto") | undefined;
  if (!nodeCrypto) return true;
  try {
    const ecdh = nodeCrypto.createECDH("prime256v1");
    ecdh.setPrivateKey(Buffer.from(privateKey, "base64url"));
    return ecdh.getPublicKey().equals(Buffer.from(publicKey, "base64url"));
  } catch {
    return false;
  }
}

export const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  APP_PORT: z.coerce.number().int().positive().default(3000),
  // URL publique de l'app (PRD-HUB-03) : construit les liens dans les e-mails
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

  // Signature en ligne (DEV-02, ADR 0026 — Documenso). Sans valeur : faux
  // fournisseur hors production, « indisponible » en production tant que
  // Documenso n'est pas configuré par Julien. Le faux fournisseur est
  // interdit en production (seuls les devis d'essai guidé l'utilisent, quel
  // que soit ce réglage). Vide (compose sans valeur) = non renseigné.
  SIGNATURE_PROVIDER: z.preprocess((value) => (value === "" ? undefined : value), z.enum(["none", "fake", "documenso"]).optional()),
  // Documenso envoie le secret du webhook dans cet en-tête, au nom fixe.
  SIGNATURE_WEBHOOK_HEADER: z.string().min(1).default("X-Documenso-Secret"),
  SIGNATURE_WEBHOOK_SECRET: z.string().default(""),
  // API v2 interne de Documenso (ex. http://documenso:3000/api/v2) et sa clé.
  DOCUMENSO_API_URL: z.string().default(""),
  DOCUMENSO_API_KEY: z.string().default(""),
  // Lot 11 (ADR 0031) : géocodage des adresses du carnet de prestataires.
  // « ign » = API Géocodage de la Géoplateforme (gratuite, sans clé),
  // « fake » = points simulés (tests, développement hors ligne, interdit en
  // production), « none » = pas de placement automatique.
  GEOCODER: z.preprocess((value) => (value === "" ? undefined : value), z.enum(["ign", "fake", "none"]).optional()),
  // Dossier du fond de carte (fichier PMTiles et polices), vide = pas de fond.
  MAP_TILES_DIR: z.string().default(""),
  // Lot 23b (FAC-14, ADR 0061) : URL Push d'une sonde Uptime Kuma à part, appelée
  // chaque jour par le contrôle de la chaîne des pièces (« down » en cas
  // d'anomalie). Vide = pas d'alerte externe ; l'anomalie va toujours au journal.
  // Un secret : elle permettrait de simuler un contrôle réussi.
  LEDGER_CHECK_PUSH_URL: z.string().trim().default(""),
  // Lot 40b (Q27, D14, ADR 0077) : adresse (DSN) du projet de suivi des erreurs (GlitchTip), sur le
  // réseau Docker de l'environnement : « http://<clé>@glitchtip:8000/<projet> ». Vide = rien n'est
  // envoyé ; les erreurs restent au journal du serveur, avec leur référence.
  ERROR_TRACKING_DSN: z
    .string()
    .trim()
    .default("")
    .refine((value) => value === "" || /^https?:\/\/[^@\s/]+@[^\s/]+\/\d+\/?$/.test(value), "DSN attendu : http://<clé>@<hôte>/<projet>"),
  // Lot 16 (L16-SEC-01, ADR 0037) : clé de chiffrement des secrets de double
  // authentification, 32 octets en base64 (openssl rand -base64 32). Requise
  // partout : sans elle, aucun compte ne pourrait configurer ni valider son
  // code. Une clé perdue oblige chaque compte à reconfigurer sa double
  // authentification : la garder dans le gestionnaire de mots de passe.
  MFA_ENCRYPTION_KEY: z
    .string()
    .trim()
    .refine((value) => /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, "base64").length === 32, {
      message: "32 octets encodés en base64 (openssl rand -base64 32)",
    }),
  // Socle des lots 46 et 49 (DAT-08, ADR 0079) : clé du chiffrement au niveau du champ
  // (agendas extérieurs, régimes des invités, plus tard IBAN), 32 octets en base64
  // (openssl rand -base64 32), distincte de MFA_ENCRYPTION_KEY. Requise partout. Perdue, les
  // valeurs chiffrées sont perdues : la garder dans le gestionnaire de mots de passe.
  DATA_ENCRYPTION_KEY: z
    .string()
    .trim()
    .refine((value) => /^[A-Za-z0-9+/]+={0,2}$/.test(value) && Buffer.from(value, "base64").length === 32, {
      message: "32 octets encodés en base64 (openssl rand -base64 32)",
    }),
  // Lot 33 (SEC-01, ADR 0067) : fournisseur d'identité (Logto). Adresse publique, émetteur des
  // jetons ; application machine à machine créée par configure-identity (son secret). Requis :
  // sans eux, personne ne se connecte. Depuis le lot 33, MFA_ENCRYPTION_KEY scelle les liens
  // magiques envoyés par Symbola.
  LOGTO_ENDPOINT: z.string().url().default("http://localhost:3001"),
  LOGTO_M2M_APP_ID: z.string().min(1).default("symbola-bootstrap"),
  LOGTO_M2M_SECRET: z.string().min(32, "32 caractères au moins (openssl rand -hex 32)"),
  // Lot 53 (ARC-09, HUB-15 ; D4 ; ADR 0095, ADR 0096) : clés VAPID des notifications push, P-256, en
  // base64url (node apps/symbola/scripts/generate-vapid-keys.mjs). La clé publique (point non
  // compressé, 65 octets) est donnée aux navigateurs ; la clé privée (32 octets) signe chaque envoi.
  // Requises partout. Perdues ou changées, chaque appareil doit réactiver le push.
  VAPID_PUBLIC_KEY: z
    .string()
    .trim()
    .refine((value) => /^[A-Za-z0-9_-]+$/.test(value) && Buffer.from(value, "base64url").length === 65 && Buffer.from(value, "base64url")[0] === 4, {
      message: "clé publique P-256 non compressée (65 octets) en base64url (generate-vapid-keys.mjs)",
    }),
  VAPID_PRIVATE_KEY: z
    .string()
    .trim()
    .refine((value) => /^[A-Za-z0-9_-]+$/.test(value) && Buffer.from(value, "base64url").length === 32, {
      message: "clé privée P-256 (32 octets) en base64url (generate-vapid-keys.mjs)",
    }),
}).superRefine((env, context) => {
  if (!vapidKeysMatch(env.VAPID_PUBLIC_KEY, env.VAPID_PRIVATE_KEY)) {
    context.addIssue({ code: "custom", path: ["VAPID_PUBLIC_KEY"], message: "ne correspond pas à VAPID_PRIVATE_KEY" });
  }
  if (env.DATA_ENCRYPTION_KEY === env.MFA_ENCRYPTION_KEY) {
    context.addIssue({ code: "custom", path: ["DATA_ENCRYPTION_KEY"], message: "doit différer de MFA_ENCRYPTION_KEY" });
  }
  if (env.NODE_ENV === "production" && !env.LOGTO_ENDPOINT.startsWith("https://")) {
    context.addIssue({ code: "custom", path: ["LOGTO_ENDPOINT"], message: "https exigé en production" });
  }
  if (env.NODE_ENV === "production" && env.GEOCODER === "fake") {
    context.addIssue({ code: "custom", path: ["GEOCODER"], message: "le faux géocodage est interdit en production" });
  }
  if (env.NODE_ENV === "production" && env.SIGNATURE_PROVIDER === "fake") {
    context.addIssue({ code: "custom", path: ["SIGNATURE_PROVIDER"], message: "le faux fournisseur de signature est interdit en production" });
  }
  if (env.SIGNATURE_PROVIDER === "documenso") {
    for (const key of ["DOCUMENSO_API_URL", "DOCUMENSO_API_KEY", "SIGNATURE_WEBHOOK_SECRET"] as const) {
      if (env[key].length === 0) context.addIssue({ code: "custom", path: [key], message: "requis avec SIGNATURE_PROVIDER=documenso" });
    }
    if (env.SIGNATURE_WEBHOOK_SECRET.length > 0 && env.SIGNATURE_WEBHOOK_SECRET.length < 32) {
      context.addIssue({ code: "custom", path: ["SIGNATURE_WEBHOOK_SECRET"], message: "32 caractères au moins (openssl rand -hex 32)" });
    }
  }
});

export type Env = z.infer<typeof envSchema>;

// Fournisseur effectif des devis réels (ADR 0026).
export function signatureProviderOf(env: Env): "none" | "fake" | "documenso" {
  return env.SIGNATURE_PROVIDER ?? (env.NODE_ENV === "production" ? "none" : "fake");
}

// Géocodeur effectif (ADR 0031) : l'IGN en production, simulé ailleurs.
export function geocoderOf(env: Env): "ign" | "fake" | "none" {
  return env.GEOCODER ?? (env.NODE_ENV === "production" ? "ign" : "fake");
}
