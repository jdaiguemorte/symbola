"use client";

import { useActionState } from "react";
import { confirmMfaAction, type MfaFormState } from "./actions";

export function MfaForm() {
  const initialState: MfaFormState = {};
  const [state, formAction, pending] = useActionState(confirmMfaAction, initialState);

  return (
    <form action={formAction}>
      <label>
        Code
        <input type="text" name="code" inputMode="numeric" pattern="[0-9]{6}" required />
      </label>
      <button type="submit" disabled={pending}>
        Valider
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
