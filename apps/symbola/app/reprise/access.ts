// Lot 71b (HUB-14, SEC-12, SEC-13) — accès commun aux écrans de la reprise : session, organisation et rôle
// vérifiés côté serveur, module Évènements souscrit (dégradation propre, ARC-06), et ce que voit la
// personne (lot 52), passé au service qui contrôle la reprise, le mariage et les imports.
import { z } from "zod";
import { TAKEOVER_STEP_KINDS, type TakeoverStepKind } from "@symbola/contracts";
import { requirePlanner } from "@/lib/guards";
import { taskListViewer } from "@/lib/event-visibility";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import type { TakeoverActor } from "@/lib/takeover/flow";

export async function requireTakeoverActor(): Promise<{ actor: TakeoverActor; eventsEnabled: boolean }> {
  const auth = await requirePlanner();
  const viewer = await taskListViewer(auth);
  return { actor: { organizationId: auth.user.organizationId, userId: auth.user.id, viewer }, eventsEnabled: await isEventsModuleEnabled(auth.user.organizationId) };
}

// Pour une action serveur : null quand la session ne permet pas d'écrire (rien n'est fait).
export async function takeoverActorForAction(): Promise<TakeoverActor | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) return null;
  const user = { id: auth.user.id, role: auth.user.role, organizationId: auth.user.organizationId };
  return { organizationId: user.organizationId, userId: user.id, viewer: await taskListViewer({ user }) };
}

const idSchema = z.uuid();

export function validId(value: unknown): string | null {
  return typeof value === "string" && idSchema.safeParse(value).success ? value : null;
}

export function parseStepKind(value: unknown): TakeoverStepKind | null {
  return typeof value === "string" && (TAKEOVER_STEP_KINDS as readonly string[]).includes(value) ? (value as TakeoverStepKind) : null;
}
