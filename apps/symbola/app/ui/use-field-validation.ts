"use client";

// Lot 70b (UX-10, NFR-16, HUB-19 ; P-18, C-04 ; page 4 des maquettes du lot 68) — la validation écrite
// par Symbola, côté écran. Le formulaire est en `noValidate` (plus de bulle du navigateur) ; à l'envoi,
// le schéma Zod partagé avec le serveur (lib/forms) dit ce qui manque ; l'envoi est retenu, chaque champ
// en erreur reçoit son message (FieldError), un résumé s'affiche à partir de deux erreurs
// (ErrorSummary), le focus va au premier champ en erreur. La saisie n'est jamais effacée. Les erreurs
// renvoyées par le serveur (même schéma) s'affichent de la même façon.
import { useTranslations } from "next-intl";
import { useCallback, useId, useState, type FormEvent } from "react";
import type { z } from "zod";
import { fieldErrors, formValues } from "@/lib/forms/field-validation";

export type FieldValidation = {
  // Les messages, déjà traduits, par champ, dans l'ordre du formulaire.
  errors: [string, string][];
  errorFor: (field: string) => string | undefined;
  // Attributs du champ : identifiant, état et message lus par le lecteur d'écran.
  fieldProps: (field: string) => { id: string; "aria-invalid"?: true; "aria-describedby"?: string };
  errorId: (field: string) => string;
  fieldId: (field: string) => string;
  // À poser sur le <form> : retient l'envoi s'il manque quelque chose. Renvoie vrai si tout va bien.
  onSubmit: (event: FormEvent<HTMLFormElement>) => boolean;
  // Une saisie corrige : le message de ce champ s'efface.
  onInput: (event: FormEvent<HTMLFormElement>) => void;
};

// Le champ à rejoindre : lui-même, ou, s'il est caché (contact choisi par la recherche), le premier
// champ visible de son groupe.
export function focusField(form: HTMLFormElement | null, field: string): void {
  if (!form) return;
  const named = form.elements.namedItem(field);
  const element = typeof RadioNodeList !== "undefined" && named instanceof RadioNodeList ? named[0] : named;
  if (!(element instanceof HTMLElement)) return;
  if (element instanceof HTMLInputElement && element.type === "hidden") {
    const visible = element.closest("fieldset")?.querySelector<HTMLElement>("input:not([type=hidden]), select, textarea, button");
    visible?.focus();
    return;
  }
  element.focus();
}

export function useFieldValidation(schema: z.ZodType, serverErrors?: Record<string, string>): FieldValidation {
  const t = useTranslations("Validation");
  const prefix = useId();
  const [clientErrors, setClientErrors] = useState<[string, string][] | null>(null);
  const [cleared, setCleared] = useState<Set<string>>(new Set());
  const [lastServer, setLastServer] = useState(serverErrors);
  if (lastServer !== serverErrors) {
    // De nouvelles erreurs du serveur remplacent celles de l'écran.
    setLastServer(serverErrors);
    setClientErrors(null);
    setCleared(new Set());
  }
  const source: [string, string][] = clientErrors ?? Object.entries(serverErrors ?? {});
  const errors = source.filter(([field]) => !cleared.has(field));

  const fieldId = useCallback((field: string) => `${prefix}-${field}`, [prefix]);
  const errorId = useCallback((field: string) => `${prefix}-${field}-error`, [prefix]);
  const errorFor = (field: string) => errors.find(([name]) => name === field)?.[1];

  return {
    errors,
    errorFor,
    errorId,
    fieldId,
    fieldProps: (field) => (errorFor(field) ? { id: fieldId(field), "aria-invalid": true, "aria-describedby": errorId(field) } : { id: fieldId(field) }),
    onSubmit: (event) => {
      const entries = fieldErrors(schema, formValues(new FormData(event.currentTarget)));
      setCleared(new Set());
      if (entries.length === 0) {
        setClientErrors([]);
        return true;
      }
      event.preventDefault();
      setClientErrors(entries.map((entry) => [entry.field, t(entry.key)]));
      focusField(event.currentTarget, entries[0]!.field);
      return false;
    },
    onInput: (event) => {
      const target = event.target as HTMLInputElement;
      if (target.name && errors.some(([field]) => field === target.name)) setCleared(new Set([...cleared, target.name]));
    },
  };
}
