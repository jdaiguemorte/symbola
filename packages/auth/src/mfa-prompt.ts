// Lot 52 (SEC-02 ; D5 ; ADR 0094) — la double authentification est proposée aux Planners par un bandeau
// discret, « Sécurisez votre compte ». Il se ferme, et revient au plus une fois par mois tant que la
// session s'ouvre sans second facteur (une session ouverte avec un facteur dit qu'il est installé :
// le fournisseur le demande alors à chaque connexion). Jamais pour un rôle où elle est exigée.
import { eq } from "drizzle-orm";
import type { AppDatabase } from "@symbola/db/client";
import { users } from "@symbola/db/schema/hub";
import type { Role } from "./roles";

export const MFA_PROMPT_INTERVAL_MS = 30 * 24 * 60 * 60 * 1000;

export function isMfaPromptDue(input: { role: Role; mfaEnabled: boolean; dismissedAt: Date | null; now: Date }): boolean {
  if (input.role !== "member" || input.mfaEnabled) return false;
  return !input.dismissedAt || input.now.getTime() - input.dismissedAt.getTime() >= MFA_PROMPT_INTERVAL_MS;
}

export async function mfaPromptDismissedAt(db: AppDatabase, userId: string): Promise<Date | null> {
  const [row] = await db.select({ dismissedAt: users.mfaPromptDismissedAt }).from(users).where(eq(users.id, userId));
  return row?.dismissedAt ?? null;
}

export async function dismissMfaPrompt(db: AppDatabase, userId: string, now: Date = new Date()): Promise<void> {
  await db.update(users).set({ mfaPromptDismissedAt: now }).where(eq(users.id, userId));
}
