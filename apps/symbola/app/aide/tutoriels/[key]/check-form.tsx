"use client";

import { useActionState } from "react";
import { checkTutorialAction, type CheckState } from "./actions";

// AIDE-06 — « J'ai fait, vérifier » : le résultat est vérifié côté serveur ;
// s'il manque, un indice s'affiche sans perdre la place.
export function CheckForm({ tutorialKey, label, hint }: { tutorialKey: string; label: string; hint: string }) {
  const initial: CheckState = {};
  const [state, action, pending] = useActionState(checkTutorialAction.bind(null, tutorialKey), initial);
  return (
    <form action={action}>
      <button type="submit" disabled={pending}>
        {label}
      </button>
      {state.failed ? <p role="alert">{hint}</p> : null}
    </form>
  );
}
