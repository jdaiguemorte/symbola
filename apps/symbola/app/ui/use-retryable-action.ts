"use client";

// Lot 70b (NFR-16 ; page 4 des maquettes du lot 68) — un envoi que la coupure réseau interrompt ne
// perd rien : le formulaire reste ouvert, la saisie en place, et le message de retour dit « Erreur : la
// tâche n'a pas été enregistrée · Connexion perdue. Votre saisie est gardée. · Réessayer ». Une autre
// erreur (du serveur) suit son chemin habituel.
import { useTranslations } from "next-intl";
import type { RefObject } from "react";
import { useFeedback } from "./feedback";

export function isConnectionError(error: unknown): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return error instanceof TypeError;
}

export function useRetryableAction<State>(action: (previous: State, formData: FormData) => Promise<State>, formRef: RefObject<HTMLFormElement | null>, failedTitle: string) {
  const t = useTranslations("Feedback");
  const feedback = useFeedback();
  return async (previous: State, formData: FormData): Promise<State> => {
    try {
      return await action(previous, formData);
    } catch (error) {
      if (!isConnectionError(error)) throw error;
      feedback?.show({
        tone: "error",
        title: failedTitle,
        detail: t("connectionLost"),
        action: { kind: "retry", label: t("retry"), run: () => formRef.current?.requestSubmit() },
      });
      return previous;
    }
  };
}
