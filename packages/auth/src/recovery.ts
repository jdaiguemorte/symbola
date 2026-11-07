// Lot 9 — retrouver l'accès à son compte (ADR 0029) : mot de passe oublié
// (lien à usage unique par e-mail) et réinitialisation de la double
// authentification par l'Admin. Seule porte d'entrée sur hub.password_resets
// (ADR 0013) ; l'e-mail lui-même est composé et envoyé par l'app (textes
// traduits).
import { and, eq, gt, isNull } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { passwordResets, sessions, users } from "@symbola/db/schema/hub";
import { hashPassword } from "./password";
import { isPlannerRole, type Role } from "./roles";
import { generateSessionToken, hashSessionToken } from "./session-token";

export const PASSWORD_RESET_DURATION_MS = 30 * 60 * 1000;
// Un seul e-mail par compte toutes les 5 minutes : un formulaire public ne
// doit pas servir à inonder une boîte de réception.
const PASSWORD_RESET_THROTTLE_MS = 5 * 60 * 1000;
export const PASSWORD_MIN_LENGTH = 12;

export type PasswordResetRequest = { token: string; email: string; language: "fr" | "en" | null; expiresAt: Date };

/**
 * Prépare un lien de réinitialisation, ou rien (adresse inconnue, demande
 * trop rapprochée) : l'appelant répond toujours la même chose, pour ne pas
 * révéler quelles adresses ont un compte.
 */
export async function requestPasswordReset(db: AppDatabase, email: string, now: Date = new Date()): Promise<PasswordResetRequest | null> {
  const [user] = await db.select().from(users).where(eq(users.email, email.trim()));
  if (!user) return null;

  const [recent] = await db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(
      and(
        eq(passwordResets.userId, user.id),
        isNull(passwordResets.usedAt),
        gt(passwordResets.createdAt, new Date(now.getTime() - PASSWORD_RESET_THROTTLE_MS)),
      ),
    );
  if (recent) return null;

  // Un nouveau lien remplace les précédents encore valides.
  await db
    .update(passwordResets)
    .set({ usedAt: now })
    .where(and(eq(passwordResets.userId, user.id), isNull(passwordResets.usedAt)));

  const token = generateSessionToken();
  const expiresAt = new Date(now.getTime() + PASSWORD_RESET_DURATION_MS);
  await db.insert(passwordResets).values({ userId: user.id, tokenHash: hashSessionToken(token), expiresAt, createdAt: now });
  return { token, email: user.email, language: user.language, expiresAt };
}

export type PasswordResetOutcome = "success" | "invalid_or_expired" | "password_too_short";

/**
 * Nouveau mot de passe par un lien valide : le lien ne sert qu'une fois,
 * toutes les sessions ouvertes sont fermées et un verrouillage en cours est
 * levé. La double authentification, elle, reste demandée à la connexion.
 */
export async function resetPassword(
  db: AppDatabase,
  input: { token: string; password: string; now?: Date },
): Promise<PasswordResetOutcome> {
  const now = input.now ?? new Date();
  if (input.password.length < PASSWORD_MIN_LENGTH) return "password_too_short";
  const [reset] = await db.select().from(passwordResets).where(eq(passwordResets.tokenHash, hashSessionToken(input.token)));
  if (!reset || reset.usedAt || reset.expiresAt.getTime() <= now.getTime()) return "invalid_or_expired";

  // Pose usedAt d'abord, sous condition : deux envois simultanés du même lien
  // ne peuvent pas réussir tous les deux.
  const claimed = await db
    .update(passwordResets)
    .set({ usedAt: now })
    .where(and(eq(passwordResets.id, reset.id), isNull(passwordResets.usedAt)))
    .returning({ id: passwordResets.id });
  if (claimed.length === 0) return "invalid_or_expired";

  await db
    .update(users)
    .set({ passwordHash: await hashPassword(input.password), failedLoginAttempts: 0, lockedUntil: null })
    .where(eq(users.id, reset.userId));
  await db.delete(sessions).where(eq(sessions.userId, reset.userId));
  return "success";
}

/** Le lien est-il encore utilisable ? (affichage du formulaire) */
export async function isPasswordResetTokenValid(db: AppDatabase, token: string, now: Date = new Date()): Promise<boolean> {
  const [reset] = await db
    .select({ id: passwordResets.id })
    .from(passwordResets)
    .where(and(eq(passwordResets.tokenHash, hashSessionToken(token)), isNull(passwordResets.usedAt), gt(passwordResets.expiresAt, now)));
  return Boolean(reset);
}

export class MfaResetNotAllowedError extends Error {
  constructor() {
    super("réinitialisation de la double authentification réservée aux comptes professionnels");
    this.name = "MfaResetNotAllowedError";
  }
}

/**
 * Assistance (Admin) : efface la clé de double authentification d'un compte
 * professionnel et ferme ses sessions ; à la connexion suivante, mot de passe
 * puis nouveau QR code. Jamais pour un compte marié (l'Admin n'a aucun lien
 * avec eux) ni pour un autre Admin.
 */
export async function resetUserMfa(db: AppDatabase, userId: string): Promise<{ email: string; language: "fr" | "en" | null }> {
  const [user] = await db.select({ role: users.role, email: users.email, language: users.language }).from(users).where(eq(users.id, userId));
  if (!user || !isPlannerRole(user.role as Role)) throw new MfaResetNotAllowedError();
  await db
    .update(users)
    .set({ totpSecret: null, mfaEnabled: false, mfaFailedAttempts: 0, mfaLockedUntil: null, totpLastUsedStep: null })
    .where(eq(users.id, userId));
  await db.delete(sessions).where(eq(sessions.userId, userId));
  return { email: user.email, language: user.language };
}
