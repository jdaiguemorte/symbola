"use client";

import { useActionState } from "react";
import { createOrganizationAction, type CreateOrganizationFormState } from "./actions";

export function AdminOrganizationForm() {
  const initialState: CreateOrganizationFormState = {};
  const [state, formAction, pending] = useActionState(createOrganizationAction, initialState);

  return (
    <form action={formAction}>
      <label>
        Nom de l'organisation
        <input type="text" name="name" required />
      </label>
      <label>
        Langue
        <select name="language" defaultValue="fr">
          <option value="fr">Français</option>
          <option value="en">English</option>
        </select>
      </label>
      <label>
        SIRET (facultatif)
        <input type="text" name="siret" />
      </label>
      <label>
        E-mail du titulaire
        <input type="email" name="titulaireEmail" required />
      </label>
      <button type="submit" disabled={pending}>
        Créer et inviter
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">Organisation créée, invitation envoyée.</p> : null}
    </form>
  );
}
