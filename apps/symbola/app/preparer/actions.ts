"use server";

// Lot 65d (MSG-01, HUB-20, HUB-28 ; ADR 0110) — la fenêtre « Préparer l'e-mail » : recomposer les
// messages « à envoyer » demandés, noter « J'ai envoyé », écarter. Session planner vérifiée à chaque
// appel ; un identifiant d'une autre organisation n'est pas trouvé (RLS), sans dire pourquoi (SEC-13).
import { z } from "zod";
import type { PreparedEmailDraft } from "@symbola/contracts";
import { requirePlanner } from "@/lib/guards";
import { draftPreparedEmails } from "@/lib/prepared-emails";
import { dismissPreparedEmail, markPreparedEmailSent, PreparedEmailError } from "@/modules/hub/service";

const idsSchema = z.array(z.uuid()).min(1).max(30);
const idSchema = z.uuid();

export async function loadPreparedEmailsAction(raw: unknown): Promise<{ drafts: PreparedEmailDraft[] }> {
  const auth = await requirePlanner();
  const parsed = idsSchema.safeParse(raw);
  if (!parsed.success) return { drafts: [] };
  return { drafts: await draftPreparedEmails(auth.user.organizationId, [...new Set(parsed.data)]) };
}

export type PreparedEmailActionResult = { ok: true } | { ok: false };

async function guarded(fn: () => Promise<unknown>): Promise<PreparedEmailActionResult> {
  try {
    await fn();
    return { ok: true };
  } catch (error) {
    if (error instanceof PreparedEmailError) return { ok: false };
    throw error;
  }
}

export async function markPreparedEmailSentAction(raw: unknown): Promise<PreparedEmailActionResult> {
  const auth = await requirePlanner();
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  return guarded(() => markPreparedEmailSent(auth.user.organizationId, parsed.data, auth.user.id));
}

export async function dismissPreparedEmailAction(raw: unknown): Promise<PreparedEmailActionResult> {
  const auth = await requirePlanner();
  const parsed = idSchema.safeParse(raw);
  if (!parsed.success) return { ok: false };
  return guarded(() => dismissPreparedEmail(auth.user.organizationId, parsed.data));
}
