"use client";

// Lot 16 (SEC-02, ADR 0044) — un formulaire d'envoi de fichier poste vers sa
// route dédiée (lib/uploads/receive.ts) au lieu d'une action serveur, et garde
// le même usage que useActionState : [état, action du formulaire, envoi en
// cours]. Après une réussite, l'écran se recharge ; une adresse renvoyée par
// la route y mène.
import { useRouter } from "next/navigation";
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import type { UploadState } from "@/lib/uploads/state";

export function useUploadAction<State extends UploadState>(endpoint: string): [Awaited<State>, (formData: FormData) => void, boolean] {
  const router = useRouter();
  const t = useTranslations("Upload");
  return useActionState<State, FormData>(async (_previous, formData) => {
    try {
      const response = await fetch(endpoint, { method: "POST", body: formData, headers: { Accept: "application/json" } });
      const state = (await response.json()) as State;
      if (state.redirect) router.push(state.redirect);
      else if (!state.error) router.refresh();
      return state;
    } catch {
      // Réseau coupé, ou réponse illisible (proxy) : rien n'a été enregistré.
      return { error: t("failed") } as State;
    }
  }, {} as Awaited<State>);
}
