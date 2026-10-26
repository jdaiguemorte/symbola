"use client";

import { useActionState } from "react";
import { loginAction, type LoginFormState } from "./actions";

export default function LoginPage() {
  const initialState: LoginFormState = {};
  const [state, formAction, pending] = useActionState(loginAction, initialState);

  return (
    <main>
      <h1>Connexion</h1>
      <form action={formAction}>
        <label>
          E-mail
          <input type="email" name="email" required />
        </label>
        <label>
          Mot de passe
          <input type="password" name="password" required />
        </label>
        <button type="submit" disabled={pending}>
          Se connecter
        </button>
      </form>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </main>
  );
}
