"use client";

// Lot 74b (NFR-02) — les textes de l'étape des échéances déjà passées (espace « PastDue », réservé au serveur dans
// lib/client-messages.ts) : seule la page /events/new les passe à sa fenêtre, qui les traduit ici ; ils ne
// partent pas avec les autres pages.
import { useMemo } from "react";
import { createTranslator, useLocale } from "next-intl";
import type frMessages from "@symbola/i18n/messages/fr.json";

export type PastDueMessages = (typeof frMessages)["PastDue"];

export function usePastDueTranslator(messages: PastDueMessages) {
  const locale = useLocale();
  return useMemo(() => createTranslator({ locale, messages: { PastDue: messages }, namespace: "PastDue" }), [locale, messages]);
}
