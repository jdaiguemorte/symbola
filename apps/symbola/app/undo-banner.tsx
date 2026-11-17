"use client";

// Lot 39a (UX-07 ; D6 ; ADR 0073) — le bandeau « Annuler », dix secondes après une suppression, sur
// tout l'écran (annoncé aux lecteurs d'écran). Il disparaît seul ; « Annuler » rend l'élément.
import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { undoDeletionAction, type UndoState } from "./undo-actions";

export type UndoBannerLabels = { message: string; undo: string; restored: string; gone: string; conflict: string; trash: string | null };

export function UndoBanner({ kind, id, remainingMs, done, labels }: { kind: string; id: string; remainingMs: number; done: boolean; labels: UndoBannerLabels }) {
  // done : l'objet a déjà été rendu (rendu qui suit « Annuler », ou page rechargée) : le bandeau le dit.
  const [state, formAction, pending] = useActionState<UndoState, FormData>(undoDeletionAction, { status: done ? "restored" : "idle" });
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    // Après « Annuler », le résultat reste lisible quelques secondes de plus.
    const timer = window.setTimeout(() => setVisible(false), state.status === "idle" ? remainingMs : 4000);
    return () => window.clearTimeout(timer);
  }, [remainingMs, state.status]);
  if (!visible) return null;
  if (state.status !== "idle") {
    const message = state.status === "restored" ? labels.restored : state.status === "conflict" ? labels.conflict : labels.gone;
    return (
      <div role="status" className="undo-notice">
        <span>{message}</span>
      </div>
    );
  }
  return (
    <div role="status" className="undo-notice">
      <span>{labels.message}</span>
      <form action={formAction}>
        <input type="hidden" name="kind" value={kind} />
        <input type="hidden" name="id" value={id} />
        <button type="submit" className="button-ghost" disabled={pending}>
          {labels.undo}
        </button>
      </form>
      {labels.trash ? <Link href="/parametres/corbeille">{labels.trash}</Link> : null}
    </div>
  );
}
