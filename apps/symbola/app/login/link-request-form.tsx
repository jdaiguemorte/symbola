"use client";

// Lot 33 (SEC-07, HUB-01) — formulaire commun à la connexion et à l'inscription : une seule
// donnée, l'adresse e-mail ; un lien part, valable quinze minutes.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { HoneypotField } from "@/app/ui/honeypot-field";
import { requestLinkAction, type LinkRequestState } from "./actions";

export function LinkRequestForm({ namespace }: { namespace: "Login" | "Signup" }) {
  const t = useTranslations(namespace);
  const initial: LinkRequestState = {};
  const [state, formAction, pending] = useActionState(requestLinkAction, initial);
  if (state.sent) return <p role="status">{t("sent")}</p>;
  return (
    <form action={formAction}>
      <HoneypotField />
      <label>
        {t("email")}
        <input type="email" name="email" required autoComplete="email" />
      </label>
      <button type="submit" disabled={pending}>
        {t("submit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
