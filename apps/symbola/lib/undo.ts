// Lot 39a (UX-07 ; D6 ; ADR 0073) — « Annuler » pendant dix secondes, sur tout l'écran. L'action qui
// supprime pose un cookie de courte durée (nature et identifiant, jamais de libellé : aucune donnée
// personnelle) ; le gabarit de l'app en fait un bandeau, quel que soit l'écran où l'action renvoie
// (fiche, liste après redirection). Le bouton « Annuler » repasse par le serveur, qui revérifie les
// droits (lib/trash.ts) : le cookie ne donne aucun droit, il ne fait que proposer.
import { cookies } from "next/headers";
import { z } from "zod";
import { isUndoKind, UNDO_SECONDS, type UndoKind } from "@symbola/contracts";

export const UNDO_COOKIE = "symbola_undo";
// Un peu plus que les dix secondes affichées : le temps de la redirection et de l'affichage.
const COOKIE_SECONDS = UNDO_SECONDS + 5;

export type UndoOffer = { kind: UndoKind; id: string; at: number };

const offerSchema = z.object({
  kind: z.string().refine(isUndoKind),
  id: z.uuid(),
  at: z.number().int().positive(),
});

export async function offerUndo(offer: { kind: UndoKind; id: string }): Promise<void> {
  const value: UndoOffer = { kind: offer.kind, id: offer.id, at: Date.now() };
  (await cookies()).set(UNDO_COOKIE, JSON.stringify(value), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_SECONDS,
  });
}

export async function clearUndo(): Promise<void> {
  (await cookies()).delete(UNDO_COOKIE);
}

// L'offre en cours et le temps qu'il lui reste (dix secondes depuis la suppression), ou rien.
export async function readUndo(now: number = Date.now()): Promise<(UndoOffer & { remainingMs: number }) | null> {
  const raw = (await cookies()).get(UNDO_COOKIE)?.value;
  if (!raw) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return null;
  }
  const result = offerSchema.safeParse(parsed);
  if (!result.success) return null;
  const remainingMs = UNDO_SECONDS * 1000 - (now - result.data.at);
  if (remainingMs <= 0) return null;
  return { kind: result.data.kind as UndoKind, id: result.data.id, at: result.data.at, remainingMs };
}
