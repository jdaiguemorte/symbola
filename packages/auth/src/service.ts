// Porte d'entrée unique de l'authentification (SOC-04, ADR 0013). Aucun
// autre code ne doit appeler packages/db sur le schéma hub, ni la lib
// d'argon2/otpauth directement : tout passe par les fonctions exportées
// d'ici (createAppUser, login, setupTotp, confirmTotp, requireUser…).
import { and, eq, gt, gte, isNotNull, isNull, like, lt, lte, not, or, sql, inArray } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { sendMail } from "@symbola/mail";
import { organizations, sessions, trustedDevices, users } from "@symbola/db/schema/hub";
import { hashPassword, verifyPassword } from "./password";
import { isProfessionalRole, type Role } from "./roles";
import { generateSessionToken, hashSessionToken } from "./session-token";
import { isSealedTotpSecret, openTotpSecret, readMfaEncryptionKey, sealTotpSecret } from "./secret-box";
import { buildTotpProvisioningUri, generateTotpSecret, matchTotpStep } from "./totp";

const SESSION_DURATION_MS = 8 * 60 * 60 * 1000; // 8h sans activité (PRD PRD-HUB-01, proposé)
// Verrouillage de compte (PRD PRD-HUB-01) : 5 mots de passe faux d'affilée
// bloquent la connexion 15 min, un e-mail part au titulaire.
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000;
// L16-SEC-01 (lot 16, ADR 0037) : même règle pour le code de double
// authentification, comptée par compte (une nouvelle connexion ne la remet
// pas à zéro).
const MFA_MAX_FAILED_ATTEMPTS = 5;
const MFA_LOCKOUT_DURATION_MS = 15 * 60 * 1000;
// L16-SEC-03 (lot 16, ADR 0038) : un appareil de confiance est dispensé du code
// pendant 90 jours (décision de Julien du 08/11/2026), jamais pour l'Admin.
const TRUSTED_DEVICE_DURATION_MS = 90 * 24 * 60 * 60 * 1000;

export type AuthenticatedUser = {
  id: string;
  email: string;
  role: Role;
  organizationId: string | null;
  // Choix explicite dans le profil (PRD-HUB-04) ; nul = pas encore choisi.
  language: "fr" | "en" | null;
  // AIDE-04 : liste « premiers pas » masquée par l'utilisateur.
  firstStepsHidden: boolean;
  // PRD-EVT-06 : double authentification activée (obligatoire pour les rôles
  // professionnels, facultative pour un marié).
  mfaEnabled: boolean;
};

export type AuthResult =
  | { status: "unauthenticated" }
  // totpConfirmed : un code a déjà été validé avec la clé enregistrée ; sinon
  // la configuration est à (re)prendre, jamais seulement à vérifier.
  | { status: "mfa_required"; userId: string; role: Role; totpConfirmed: boolean }
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

export type LoginOptions = {
  // L16-SEC-03 : jeton du cookie d'appareil de confiance de ce navigateur, s'il y en a un.
  trustedDeviceToken?: string | undefined;
  // Horloge simulée (tests) pour l'échéance de l'appareil de confiance.
  now?: Date | undefined;
};

export async function login(db: AppDatabase, email: string, password: string, options: LoginOptions = {}): Promise<LoginResult> {
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

  // RGPD-05 : dernière connexion réussie, pour la suppression des comptes de
  // mariés inactifs (registre de données).
  await db.update(users).set({ failedLoginAttempts: 0, lockedUntil: null, lastLoginAt: new Date() }).where(eq(users.id, user.id));

  // Un marié n'y est pas obligé, mais une fois activée elle s'applique à
  // chaque connexion (PRD-EVT-06).
  // L16-SEC-03 : un appareil de confiance encore valide de ce compte dispense du code.
  const mfaExpected = isProfessionalRole(user.role) || user.mfaEnabled;
  const trusted = mfaExpected && (await useTrustedDevice(db, user, options));
  const requiresMfa = mfaExpected && !trusted;
  const sessionToken = generateSessionToken();

  await db.insert(sessions).values({
    userId: user.id,
    tokenHash: hashSessionToken(sessionToken),
    mfaVerified: !requiresMfa,
    expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
  });

  return { outcome: "success", sessionToken, requiresMfa };
}

async function useTrustedDevice(
  db: AppDatabase,
  user: { id: string; role: Role; mfaEnabled: boolean; totpSecret: string | null },
  options: LoginOptions,
): Promise<boolean> {
  if (!options.trustedDeviceToken || user.role === "admin" || !user.mfaEnabled || !user.totpSecret) return false;
  const now = options.now ?? new Date();
  // Les appareils échus de ce compte n'ont plus d'usage : effacés au passage.
  await db.delete(trustedDevices).where(and(eq(trustedDevices.userId, user.id), lte(trustedDevices.expiresAt, now)));
  const used = await db
    .update(trustedDevices)
    .set({ lastUsedAt: now })
    .where(
      and(
        eq(trustedDevices.tokenHash, hashSessionToken(options.trustedDeviceToken)),
        eq(trustedDevices.userId, user.id),
        gt(trustedDevices.expiresAt, now),
      ),
    )
    .returning({ id: trustedDevices.id });
  return used.length > 0;
}

/** L16-SEC-03 : appareils de confiance encore valides du compte (écran du profil). */
export async function countTrustedDevices(db: AppDatabase, userId: string, now: Date = new Date()): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(trustedDevices)
    .where(and(eq(trustedDevices.userId, userId), gt(trustedDevices.expiresAt, now)));
  return row?.count ?? 0;
}

/** L16-SEC-03 : « oublier mes appareils » ; renvoie le nombre d'appareils oubliés. */
export async function forgetTrustedDevices(db: AppDatabase, userId: string): Promise<number> {
  const forgotten = await db.delete(trustedDevices).where(eq(trustedDevices.userId, userId)).returning({ id: trustedDevices.id });
  return forgotten.length;
}

export async function setupTotp(db: AppDatabase, userId: string) {
  const secret = generateTotpSecret();
  // L16-SEC-01 : jamais en clair en base.
  const [user] = await db
    .update(users)
    .set({ totpSecret: sealTotpSecret(secret, userId, readMfaEncryptionKey()), totpLastUsedStep: null, mfaFailedAttempts: 0, mfaLockedUntil: null })
    .where(eq(users.id, userId))
    .returning();
  if (!user) throw new Error("utilisateur introuvable");
  // Nouvelle clé : aucun appareil retenu avec l'ancienne ne reste dispensé.
  await db.delete(trustedDevices).where(eq(trustedDevices.userId, userId));

  return { secret, provisioningUri: buildTotpProvisioningUri({ secret, email: user.email }) };
}

/**
 * Écran de configuration (rôles professionnels) : tant qu'aucun code n'a été
 * validé, réaffiche la clé déjà enregistrée (même QR code d'une connexion ou
 * d'un rechargement à l'autre) ou en crée une. Sans cette reprise, une clé
 * enregistrée mais jamais confirmée laissait l'utilisateur devant une
 * demande de code qu'il ne pouvait pas produire.
 */
export async function resumeTotpSetup(db: AppDatabase, userId: string) {
  const [user] = await db
    .select({ email: users.email, totpSecret: users.totpSecret, mfaEnabled: users.mfaEnabled })
    .from(users)
    .where(eq(users.id, userId));
  if (!user) throw new Error("utilisateur introuvable");
  if (user.mfaEnabled) throw new Error("double authentification déjà confirmée");
  if (user.totpSecret) {
    const secret = openTotpSecret(user.totpSecret, userId, readMfaEncryptionKey());
    return { secret, provisioningUri: buildTotpProvisioningUri({ secret, email: user.email }) };
  }
  return setupTotp(db, userId);
}

export type ConfirmTotpResult =
  // Nouveau jeton de session : l'ancien est révoqué (L16-SEC-01), l'appelant
  // remplace le cookie.
  // deviceToken (L16-SEC-03) : à poser dans le cookie d'appareil de confiance quand
  // « se souvenir de cet appareil » était coché (jamais pour l'Admin).
  | { outcome: "confirmed"; sessionToken: string; deviceToken?: string }
  | { outcome: "invalid" }
  // notify : le verrouillage vient d'être posé, l'app prévient le titulaire
  // (e-mail traduit) ; nul pour les essais suivants pendant le verrouillage.
  | { outcome: "locked"; notify: { email: string; language: "fr" | "en" | null } | null };

type MfaAccount = { userId: string; email: string; language: "fr" | "en" | null };

/**
 * Vérifie un code TOTP pour la session en cours. Sert à la configuration
 * initiale comme aux connexions suivantes. L16-SEC-01 (lot 16, ADR 0037) :
 * - 5 codes faux d'affilée verrouillent la validation 15 min pour le compte,
 *   même un code juste est alors refusé ;
 * - un code ne sert qu'une fois (pas de temps du dernier code accepté) ;
 * - une validation émet un nouveau jeton de session et révoque l'ancien.
 * `now` simule l'horloge dans les tests.
 */
export async function confirmTotp(
  db: AppDatabase,
  params: { sessionToken: string; token: string; now?: Date; rememberDevice?: boolean },
): Promise<ConfirmTotpResult> {
  const now = params.now ?? new Date();
  const tokenHash = hashSessionToken(params.sessionToken);
  const [row] = await db
    .select({
      userId: sessions.userId,
      email: users.email,
      language: users.language,
      role: users.role,
      totpSecret: users.totpSecret,
      mfaLockedUntil: users.mfaLockedUntil,
      expiresAt: sessions.expiresAt,
    })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash));

  if (!row || !row.totpSecret || row.expiresAt.getTime() < Date.now()) return { outcome: "invalid" };
  if (row.mfaLockedUntil && row.mfaLockedUntil.getTime() > now.getTime()) return { outcome: "locked", notify: null };

  const key = readMfaEncryptionKey();
  const secret = openTotpSecret(row.totpSecret, row.userId, key);
  const step = matchTotpStep({ secret, token: params.token.trim(), timestamp: now.getTime() });
  const account: MfaAccount = { userId: row.userId, email: row.email, language: row.language };
  if (step === null) return recordMfaFailure(db, account, now);

  const newToken = generateSessionToken();
  const deviceToken = params.rememberDevice && row.role !== "admin" ? generateSessionToken() : undefined;
  const confirmed = await db.transaction(async (tx) => {
    // Consomme le code sous condition : deux envois simultanés du même code,
    // ou un code rejoué, ne passent pas tous les deux.
    const claimed = await tx
      .update(users)
      .set({
        totpLastUsedStep: step,
        mfaFailedAttempts: 0,
        mfaLockedUntil: null,
        mfaEnabled: true,
        // Secret enregistré en clair avant le lot 16 : chiffré au passage.
        ...(isSealedTotpSecret(row.totpSecret ?? "") ? {} : { totpSecret: sealTotpSecret(secret, row.userId, key) }),
      })
      .where(
        and(
          eq(users.id, row.userId),
          or(isNull(users.totpLastUsedStep), lt(users.totpLastUsedStep, step)),
          or(isNull(users.mfaLockedUntil), lte(users.mfaLockedUntil, now)),
        ),
      )
      .returning({ id: users.id });
    if (claimed.length === 0) return false;
    const revoked = await tx.delete(sessions).where(eq(sessions.tokenHash, tokenHash)).returning({ id: sessions.id });
    if (revoked.length === 0) throw new Error("session disparue pendant la validation");
    await tx.insert(sessions).values({
      userId: row.userId,
      tokenHash: hashSessionToken(newToken),
      mfaVerified: true,
      expiresAt: new Date(Date.now() + SESSION_DURATION_MS),
    });
    if (deviceToken) {
      await tx.insert(trustedDevices).values({
        userId: row.userId,
        tokenHash: hashSessionToken(deviceToken),
        expiresAt: new Date(now.getTime() + TRUSTED_DEVICE_DURATION_MS),
      });
    }
    return true;
  });

  if (!confirmed) return recordMfaFailure(db, account, now);
  return deviceToken ? { outcome: "confirmed", sessionToken: newToken, deviceToken } : { outcome: "confirmed", sessionToken: newToken };
}

async function recordMfaFailure(db: AppDatabase, account: MfaAccount, now: Date): Promise<ConfirmTotpResult> {
  const [counted] = await db
    .update(users)
    .set({ mfaFailedAttempts: sql`${users.mfaFailedAttempts} + 1` })
    .where(eq(users.id, account.userId))
    .returning({ attempts: users.mfaFailedAttempts });
  if (!counted || counted.attempts < MFA_MAX_FAILED_ATTEMPTS) return { outcome: "invalid" };

  // Un seul envoi concurrent pose le verrouillage (et prévient le titulaire).
  const locked = await db
    .update(users)
    .set({ mfaFailedAttempts: 0, mfaLockedUntil: new Date(now.getTime() + MFA_LOCKOUT_DURATION_MS) })
    .where(and(eq(users.id, account.userId), gte(users.mfaFailedAttempts, MFA_MAX_FAILED_ATTEMPTS)))
    .returning({ id: users.id });
  if (locked.length === 0) return { outcome: "locked", notify: null };
  // Journal sans donnée personnelle : l'identifiant du compte seulement.
  console.warn(`double authentification verrouillée après ${MFA_MAX_FAILED_ATTEMPTS} codes faux (compte ${account.userId})`);
  return { outcome: "locked", notify: { email: account.email, language: account.language } };
}

/**
 * L16-SEC-01 (ADR 0037) — chiffre les secrets encore en clair (comptes créés avant
 * le lot 16). Lancé au démarrage de l'app ; sans effet s'il n'y en a plus.
 * `userIds` limite aux comptes donnés (tests). Renvoie le nombre chiffré.
 */
export async function sealLegacyTotpSecrets(db: AppDatabase, options: { userIds?: string[] } = {}): Promise<number> {
  const key = readMfaEncryptionKey();
  const rows = await db
    .select({ id: users.id, totpSecret: users.totpSecret })
    .from(users)
    .where(and(isNotNull(users.totpSecret), not(like(users.totpSecret, "v1:%")), options.userIds ? inArray(users.id, options.userIds) : undefined));
  let sealed = 0;
  for (const row of rows) {
    if (!row.totpSecret) continue;
    const updated = await db
      .update(users)
      .set({ totpSecret: sealTotpSecret(row.totpSecret, row.id, key) })
      .where(and(eq(users.id, row.id), eq(users.totpSecret, row.totpSecret)))
      .returning({ id: users.id });
    sealed += updated.length;
  }
  return sealed;
}

/**
 * Retour arrière seulement (runbook de déploiement) : remet les secrets en
 * clair avant de relancer une image antérieure au lot 16, qui ne sait pas les
 * déchiffrer. Renvoie le nombre déchiffré.
 */
export async function unsealTotpSecrets(db: AppDatabase, options: { userIds?: string[] } = {}): Promise<number> {
  const key = readMfaEncryptionKey();
  const rows = await db
    .select({ id: users.id, totpSecret: users.totpSecret })
    .from(users)
    .where(and(like(users.totpSecret, "v1:%"), options.userIds ? inArray(users.id, options.userIds) : undefined));
  let opened = 0;
  for (const row of rows) {
    if (!row.totpSecret) continue;
    const updated = await db
      .update(users)
      .set({ totpSecret: openTotpSecret(row.totpSecret, row.id, key) })
      .where(and(eq(users.id, row.id), eq(users.totpSecret, row.totpSecret)))
      .returning({ id: users.id });
    opened += updated.length;
  }
  return opened;
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

  // Session glissante (PRD PRD-HUB-01, « 8h sans activité ») : chaque appel
  // réussi repousse l'expiration, plutôt qu'une durée fixe depuis la
  // connexion.
  await db
    .update(sessions)
    .set({ expiresAt: new Date(Date.now() + SESSION_DURATION_MS) })
    .where(eq(sessions.tokenHash, tokenHash));

  if ((isProfessionalRole(row.role) || row.mfaEnabled) && !row.mfaVerified) {
    return { status: "mfa_required", userId: row.userId, role: row.role, totpConfirmed: row.mfaEnabled && row.totpSecret !== null };
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

// Lot 23 (partie B, DAT-06, SEC-19, ADR 0060) : l'auteur d'une écriture en base,
// d'après la session de la requête. Lecture seule (ni expiration glissante ni
// autre écriture, contrairement à requireUser) : appelée à chaque transaction.
// Une session expirée ou qui attend encore la double authentification n'a pas
// d'auteur.
export async function findSessionActor(
  db: AppDatabase,
  sessionToken: string | undefined,
): Promise<{ kind: "member" | "admin"; id: string } | null> {
  if (!sessionToken) return null;
  const [row] = await db
    .select({ userId: users.id, role: users.role, mfaEnabled: users.mfaEnabled, mfaVerified: sessions.mfaVerified, expiresAt: sessions.expiresAt })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, hashSessionToken(sessionToken)));
  if (!row || row.expiresAt.getTime() < Date.now()) return null;
  if ((isProfessionalRole(row.role) || row.mfaEnabled) && !row.mfaVerified) return null;
  return { kind: row.role === "admin" ? "admin" : "member", id: row.userId };
}

// PRD-EVT-06 — invitation d'un marié : savoir si l'e-mail a déjà un compte, et
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

// PRD-HUB-04 — « Quand il choisit FR ou EN dans son profil, toutes les apps
// s'affichent dans cette langue. »
export async function setUserLanguage(db: AppDatabase, userId: string, language: "fr" | "en"): Promise<void> {
  await db.update(users).set({ language }).where(eq(users.id, userId));
}
