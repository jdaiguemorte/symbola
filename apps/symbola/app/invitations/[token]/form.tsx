"use client";

import { useActionState } from "react";
import { acceptInvitationAction, type AcceptInvitationFormState } from "./actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const initialState: AcceptInvitationFormState = {};
  const [state, formAction, pending] = useActionState(acceptInvitationAction, initialState);

  if (state.success) {
    return <p role="status">Compte créé. Vous pouvez maintenant vous connecter.</p>;
  }

  return (
    <form action={formAction}>
      <input type="hidden" name="token" value={token} />
      <label>
        Choisissez un mot de passe
        <input type="password" name="password" required />
      </label>
      <button type="submit" disabled={pending}>
        Créer mon compte
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
