// Schéma du socle d'identité (SOC-04, ADR 0013) : organisations,
// utilisateurs, sessions. Pas de Row-Level Security ici — ce sont des
// tables d'identité, pas des tables « métier » au sens de CLAUDE.md §2.4
// (events, budget, quotes le seront). L'isolation entre organisations pour
// ces tables est assurée exclusivement par packages/auth (seule porte
// d'entrée, ADR 0013) : aucun autre code n'y accède directement.
import { boolean, integer, pgSchema, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const hubSchema = pgSchema("hub");

export const roleEnum = hubSchema.enum("role", ["owner", "member", "client", "admin"]);

export const organizations = hubSchema.table("organizations", {
  id: uuid("id").defaultRandom().primaryKey(),
  name: text("name").notNull(),
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
