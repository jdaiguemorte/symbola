// Schéma du socle d'identité (SOC-04, ADR 0013) : organisations,
// utilisateurs, sessions. Pas de Row-Level Security ici — ce sont des
// tables d'identité, pas des tables « métier » au sens de CLAUDE.md §2.4
// (events, budget, quotes le seront). L'isolation entre organisations pour
// ces tables est assurée exclusivement par packages/auth (seule porte
// d'entrée, ADR 0013) : aucun autre code n'y accède directement.
import { boolean, date, integer, pgSchema, primaryKey, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const hubSchema = pgSchema("hub");

export const roleEnum = hubSchema.enum("role", ["owner", "member", "client", "admin"]);
export const languageEnum = hubSchema.enum("language", ["fr", "en"]);
// Valeurs réglementaires fixes (CLAUDE.md §2.5 : pas une liste
// personnalisable par organisation, au même titre que roleEnum).
export const legalFormEnum = hubSchema.enum("legal_form", [
  "ei",
  "eirl",
  "eurl",
  "sarl",
  "sas",
  "sasu",
  "sa",
  "auto_entrepreneur",
  "autre",
]);
export const metierEnum = hubSchema.enum("metier", ["wedding_planner", "autre"]);
export const vatRegimeEnum = hubSchema.enum("vat_regime", ["franchise", "assujetti"]);

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
  // Choix explicite dans le profil (HUB-04) ; nul = pas encore choisi,
  // suit le cookie de langue du navigateur (apps/symbola/middleware.ts).
  language: languageEnum("language"),
  totpSecret: text("totp_secret"),
  mfaEnabled: boolean("mfa_enabled").notNull().default(false),
  // Verrouillage de compte (PRD HUB-01) : 5 mots de passe faux d'affilée
  // bloquent la connexion 15 min, un e-mail part au titulaire. Remis à
  // zéro à chaque connexion réussie.
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  // AIDE-04 : masque la liste « premiers pas » du tableau de bord,
  // choix explicite de l'utilisateur.
  firstStepsHidden: boolean("first_steps_hidden").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// AIDE-01 : une visite guidée se relance à volonté, mais ne s'affiche
// automatiquement qu'à la première ouverture d'un module — une ligne ici
// = déjà vue au moins une fois.
export const userTourSeen = hubSchema.table(
  "user_tour_seen",
  {
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id),
    moduleKey: text("module_key").notNull(),
    seenAt: timestamp("seen_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => [primaryKey({ columns: [table.userId, table.moduleKey] })],
);

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

// Fiche entreprise (PRD ONB-01) : une ligne par organisation, remplie
// progressivement (questionnaire interruptible/reprenable) — toute
// colonne peut rester nulle tant qu'elle n'a pas été répondue.
// completedAt nul = questionnaire pas encore terminé.
export const organizationProfiles = hubSchema.table("organization_profiles", {
  organizationId: uuid("organization_id")
    .primaryKey()
    .references(() => organizations.id),
  siren: text("siren"),
  address: text("address"),
  // Clé de l'objet dans le stockage privé (@symbola/files), jamais l'URL
  // directement — même patron que les pièces jointes du module hello.
  logoKey: text("logo_key"),
  legalForm: legalFormEnum("legal_form"),
  metier: metierEnum("metier"),
  metierPrecision: text("metier_precision"),
  vatRegime: vatRegimeEnum("vat_regime"),
  // Taux par défaut en centièmes de point (2000 = 20,00 %), utilisé
  // seulement si vatRegime = "assujetti".
  vatRateDefaultBasisPoints: integer("vat_rate_default_basis_points"),
  completedAt: timestamp("completed_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

// Historique des changements de régime de TVA (PRD ONB-02) : chaque
// changement est daté d'effet, jamais appliqué rétroactivement aux
// documents déjà émis (devis/factures, lots suivants).
export const vatRegimeChanges = hubSchema.table("vat_regime_changes", {
  id: uuid("id").defaultRandom().primaryKey(),
  organizationId: uuid("organization_id")
    .notNull()
    .references(() => organizations.id),
  previousRegime: vatRegimeEnum("previous_regime"),
  newRegime: vatRegimeEnum("new_regime").notNull(),
  effectiveDate: date("effective_date").notNull(),
  changedByUserId: uuid("changed_by_user_id")
    .notNull()
    .references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

// Seuils de franchise en base de TVA (PRD ONB-02, « jamais une valeur
// dans le code ») : une seule ligne pour toute la plateforme, modifiable
// par l'Admin. Deux seuils (prestations de services / vente de
// marchandises), chacun peut rester nul tant que l'Admin ne l'a pas
// renseigné — aucune valeur par défaut codée en dur.
export const platformSettings = hubSchema.table("platform_settings", {
  id: integer("id").primaryKey().default(1),
  franchiseThresholdServicesCents: integer("franchise_threshold_services_cents"),
  franchiseThresholdGoodsCents: integer("franchise_threshold_goods_cents"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

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
