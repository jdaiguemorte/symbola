// Porte d'entrée unique de l'authentification (SOC-04, ADR 0013). Aucun
// autre code ne doit appeler packages/db sur le schéma hub, ni la lib
// d'argon2/otpauth directement : tout passe par les fonctions exportées
// d'ici (createAppUser, login, setupTotp, confirmTotp, requireUser…).
import { and, eq, sql } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { sendMail } from "@symbola/mail";
import { organizations, sessions, users } from "@symbola/db/schema/hub";
import { hashPassword, verifyPassword } from "./password";
import { isProfessionalRole, type Role } from "./roles";
import { generateSessionToken, hashSessionToken } from "./session-token";
import { buildTotpProvisioningUri, generateTotpSecret, verifyTotpToken } from "./totp";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8h sans activité (PRD HUB-01, proposé)
// Verrouillage de compte (PRD HUB-01) : 5 mots de passe faux d'affilée
// bloquent la connexion 15 min, un e-mail part au titulaire.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
  organizationId: string | null;
  // Choix explicite dans le profil (HUB-04) ; nul = pas encore choisi.
  language: "fr" | "en" | null;
  // AIDE-04 : liste « premiers pas » masquée par l'utilisateur.
  firstStepsHidden: boolean;
  // EVT-06 : double authentification activée (obligatoire pour les rôles
  // professionnels, facultative pour un marié).
  mfaEnabled: boolean;
};

export type AuthResult =
  | { status: "unauthenticated" }
  | { status: "mfa_required"; userId: string; hasTotpSecret: boolean }
  | { status: "authenticated"; user: AuthenticatedUser };

export type LoginResult =
  | { outcome: "invalid_credentials" }
  | { outcome: "locked" }
  | { outcome: "success"; sessionToken: string; requiresMfa: boolean };

export async function createOrganization(db: AppDatabase, name: string) {
  const [organization] = await db.insert(organizations).values({ name }).returning();
  if (!organization) throw new Error("création de l'organisation échouée");
  return organization;
}

export async function createUser(
  db: AppDatabase,
  input: { organizationId: string | null; email: string; password: string; role: Role },
) {
  const passwordHash = await hashPassword(input.password);
  const [user] = await db
    .insert(users)
    .values({
      organizationId: input.organizationId,
      email: input.email,
      passwordHash,
      role: input.role,
    })
    .returning();
  if (!user) throw new Error("création de l'utilisateur échouée");
  return user;
}

export async function login(db: AppDatabase, email: string, password: string): Promise<LoginResult> {
  const [user] = await db.select().from(users).where(eq(users.email, email));
  if (!user) return { outcome: "invalid_credentials" };

  if (user.lockedUntil && user.lockedUntil.getTime() > Date.now()) {
    return { outcome: "locked" };
  }

  const validPassword = await verifyPassword(user.passwordHash, password);
  if (!validPassword) {
    const failedAttempts = user.failedLoginAttempts + 1;
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      await db
        .update(users)
        .set({ failedLoginAttempts: 0, lockedUntil: new Date(Date.now() + LOCKOUT_DURATION_MS) })
        .where(eq(users.id, user.id));
      await sendMail({
        to: user.email,
        subject: "Votre compte Symbola a été verrouillé",
        text: "Cinq mots de passe incorrects d'affilée ont été saisis sur votre compte. Il est verrouillé pendant 15 minutes par mesure de sécurité. Si ce n'était pas vous, pensez à changer votre mot de passe dès le déverrouillage.",
      });
      return { outcome: "locked" };
    }

    await db.update(users).set({ failedLoginAttempts: failedAttempts }).where(eq(users.id, user.id));
    return { outcome: "invalid_credentials" };
  }

  if (user.failedLoginAttempts > 0 || user.lockedUntil) {
    await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null }).where(eq(users.id, user.id));
  }

  // Un marié n'y est pas obligé, mais une fois activée elle s'applique à
  // chaque connexion (EVT-06).
  const requiresMfa = isProfessionalRole(user.role) || user.mfaEnabled;
  const sessionToken = generateSessionToken();

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: hashSessionToken(sessionToken),
    mfaVerified: !requiresMfa,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });

  return { outcome: "success", sessionToken, requiresMfa };
}

export async function setupTotp(db: AppDatabase, userId: string) {
  const secret = generateTotpSecret();
  const [user] = await db
    .update(users)
    .set({ totpSecret: secret })
    .where(eq(users.id, userId))
    .returning();
  if (!user) throw new Error("utilisateur introuvable");

  return { secret, provisioningUri: buildTotpProvisioningUri({ secret, email: user.email }) };
}

/**
 * Vérifie un code TOTP pour la session en cours et, s'il est valide, marque
 * cette session comme pleinement authentifiée (mfaVerified = true). Sert à
 * la fois à la configuration initiale et aux connexions suivantes.
 */
export async function confirmTotp(
  db: AppDatabase,
  params: { sessionToken: string; token: string },
): Promise<boolean> {
  const tokenHash = hashSessionToken(params.sessionToken);
  const [row] = await db
    .select({ userId: sessions.userId, totpSecret: users.totpSecret })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash));

  if (!row || !row.totpSecret) return false;
  if (!verifyTotpToken({ secret: row.totpSecret, token: params.token })) return false;

  await db
    .update(sessions)
    .set({ mfaVerified: true })
    .where(eq(sessions.tokenHash, tokenHash));
  await db.update(users).set({ mfaEnabled: true }).where(eq(users.id, row.userId));

  return true;
}

/**
 * Seule porte d'entrée pour résoudre une session en utilisateur authentifié
 * (SOC-04). Renvoie "mfa_required" pour un rôle professionnel dont la
 * session n'a pas encore passé l'étape TOTP — avec ou sans secret déjà
 * configuré, pour que l'app sache proposer la configuration ou la
 * vérification.
 */
export async function requireUser(
  db: AppDatabase,
  sessionToken: string | undefined,
): Promise<AuthResult> {
  if (!sessionToken) return { status: "unauthenticated" };

  const tokenHash = hashSessionToken(sessionToken);
  const [row] = await db
    .select({
      userId: users.id,
      email: users.email,
      role: users.role,
      organizationId: users.organizationId,
      language: users.language,
      firstStepsHidden: users.firstStepsHidden,
      totpSecret: users.totpSecret,
      mfaEnabled: users.mfaEnabled,
      mfaVerified: sessions.mfaVerified,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(and(eq(sessions.tokenHash, tokenHash)));

  if (!row) return { status: "unauthenticated" };
  if (row.expiresAt.getTime() < Date.now()) return { status: "unauthenticated" };

  // Session glissante (PRD HUB-01, « 8h sans activité ») : chaque appel
  // réussi repousse l'expiration, plutôt qu'une durée fixe depuis la
  // connexion.
  await db
    .update(sessions)
    .set({ expiresAt: new Date(Date.now() + SESSION_DURATION_MS) })
    .where(eq(sessions.tokenHash, tokenHash));

  if ((isProfessionalRole(row.role) || row.mfaEnabled) && !row.mfaVerified) {
    return { status: "mfa_required", userId: row.userId, hasTotpSecret: row.totpSecret !== null };
  }

  return {
    status: "authenticated",
    user: {
      id: row.userId,
      email: row.email,
      role: row.role,
      organizationId: row.organizationId,
      language: row.language,
      firstStepsHidden: row.firstStepsHidden,
      mfaEnabled: row.mfaEnabled,
    },
  };
}

// EVT-06 — invitation d'un marié : savoir si l'e-mail a déjà un compte, et
// lequel (rôle, organisation), sans exposer le reste du compte.
export async function findAccountByEmail(
  db: AppDatabase,
  email: string,
): Promise<{ id: string; role: Role; organizationId: string | null } | null> {
  const [user] = await db
    .select({ id: users.id, role: users.role, organizationId: users.organizationId })
    .from(users)
    .where(sql`lower(${users.email}) = lower(${email.trim()})`);
  return user ?? null;
}

export async function destroySession(db: AppDatabase, sessionToken: string): Promise<void> {
  await db.delete(sessions).where(eq(sessions.tokenHash, hashSessionToken(sessionToken)));
}

// HUB-04 — « Quand il choisit FR ou EN dans son profil, toutes les apps
// s'affichent dans cette langue. »
export async function setUserLanguage(db: AppDatabase, userId: string, language: "fr" | "en"): Promise<void> {
  await db.update(users).set({ language }).where(eq(users.id, userId));
}
