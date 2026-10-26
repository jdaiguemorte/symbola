// Schéma du socle d'identité (SOC-04, ADR 0013) : organisations,
// utilisateurs, sessions. Pas de Row-Level Security ici — ce sont des
// tables d'identité, pas des tables « métier » au sens de CLAUDE.md §2.4
// (events, budget, quotes le seront). L'isolation entre organisations pour
// ces tables est assurée exclusivement par packages/auth (seule porte
// d'entrée, ADR 0013) : aucun autre code n'y accède directement.
import { boolean, integer, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const hubSchema = pgSchema("hub");

export const roleEnum = hubSchema.enum("role", ["owner", "member", "client", "admin"]);
export const languageEnum = hubSchema.enum("language", ["fr", "en"]);

export const organizations = hubSchema.table("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
  language: languageEnum("language").notNull().default("fr"),
  // Facultatif (PRD HUB-03) : une organisation peut être créée avant
  // d'avoir un SIRET (prospect, structure en cours de création).
  siret: text("siret"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Invitation du titulaire par l'Admin (PRD HUB-03) : valable 7 jours
// (proposé), un seul usage (acceptedAt posé à la première utilisation).
export const invitations = hubSchema.table("invitations", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  email: text("email").notNull(),
  tokenHash: text("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const users = hubSchema.table("users", {
  id: uuid("id").defaultRandom().primaryKey(),
  // Nul pour le rôle admin (opérateur de la suite, sans organisation).
  organizationId: uuid("organization_id").references(() => organizations.id),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: roleEnum("role").notNull(),
  totpSecret: text("totp_secret"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  // Verrouillage de compte (PRD HUB-01) : 5 mots de passe faux d'affilée
  // bloquent la connexion 15 min, un e-mail part au titulaire. Remis à
  // zéro à chaque connexion réussie.
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const sessions = hubSchema.table("sessions", {
  id: uuid("id").defaultRandom().primaryKey(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id),
  tokenHash: text("token_hash").notNull().unique(),
  // Un utilisateur au rôle professionnel doit repasser son code TOTP à
  // chaque nouvelle session (pas seulement à la création du compte) —
  // mfaVerified distingue une session « mot de passe validé » d'une
  // session pleinement authentifiée pour les rôles professionnels.
  mfaVerified: boolean("mfa_verified").notNull().default(false),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Activation d'un module par organisation (PRD HUB-03). Pas de ligne =
// activé par défaut (absence = « jamais désactivé »), pour qu'un nouveau
// module n'ait besoin d'aucune migration de données pour être actif
// partout. Désactiver un module ne supprime jamais ses données.
export const organizationModules = hubSchema.table(
  "organization_modules",
  {
    organizationId: uuid("organization_id")
      .notNull()
      .references(() => organizations.id),
    moduleKey: text("module_key").notNull(),
    enabled: boolean("enabled").notNull().default(true),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.organizationId, table.moduleKey] })],
);

// Journal d'audit des actions Admin (PRD HUB-03, « qui, quoi, quand »).
// targetOrganizationId nul pour une action qui ne vise aucune organisation
// précise.
export const auditLog = hubSchema.table("audit_log", {
  id: uuid("id").defaultRandom().primaryKey(),
  adminUserId: uuid("admin_user_id")
    .notNull()
    .references(() => users.id),
  action: text("action").notNull(),
  targetOrganizationId: uuid("target_organization_id").references(() => organizations.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});
