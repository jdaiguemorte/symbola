"use client";

// Lot 39b (UX-09, NFR-16 ; D7, D10 ; ADR 0074) — rien ne se perd en saisissant. Posé dans un
// formulaire, il :
// - garde la saisie côté serveur à chaque pause de frappe (brouillon par personne et par formulaire),
//   et une copie sur l'appareil tant qu'elle n'a pas pu partir (coupure réseau) ;
// - propose de reprendre un brouillon retrouvé (« Brouillon du 17 novembre à 10:12 retrouvé »), y
//   compris commencé sur un autre appareil ;
// - remet le texte saisi après un refus (React vide le formulaire après son action) ;
// - refuse d'envoyer sans réseau, en disant que la saisie est gardée ;
// - efface le brouillon quand le formulaire est enregistré.
// Les champs cachés (identifiants, versions), mots de passe et fichiers ne sont jamais gardés.
import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { discardFormDraftAction, loadFormDraftAction, saveFormDraftAction, type FormDraftView } from "@/app/form-draft-actions";

type Content = Record<string, string>;
type LocalCopy = { content: Content; savedAt: string; pending: boolean };

const PAUSE_MS = 800;
const SKIPPED = new Set(["hidden", "password", "file", "submit", "button", "reset", "image"]);

const storageKey = (formKey: string) => `symbola:brouillon:${formKey}`;

function readLocal(formKey: string): LocalCopy | null {
  try {
    const raw = window.localStorage.getItem(storageKey(formKey));
    return raw ? (JSON.parse(raw) as LocalCopy) : null;
  } catch {
    return null;
  }
}

function writeLocal(formKey: string, copy: LocalCopy | null): void {
  try {
    if (copy) window.localStorage.setItem(storageKey(formKey), JSON.stringify(copy));
    else window.localStorage.removeItem(storageKey(formKey));
  } catch {
    // Stockage refusé (navigation privée) : le brouillon serveur reste.
  }
}

type Field = HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;

function fieldsOf(form: HTMLFormElement): Field[] {
  return Array.from(form.elements).filter((element): element is Field => {
    if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement || element instanceof HTMLSelectElement)) return false;
    if (!element.name || element.disabled || element.dataset.noDraft !== undefined) return false;
    return !(element instanceof HTMLInputElement && SKIPPED.has(element.type));
  });
}

function keyOf(field: Field): string {
  return field instanceof HTMLInputElement && field.type === "checkbox" ? `${field.name}=${field.value}` : field.name;
}

export function readForm(form: HTMLFormElement): Content {
  const content: Content = {};
  for (const field of fieldsOf(form)) {
    if (field instanceof HTMLInputElement && field.type === "radio") {
      if (field.checked) content[field.name] = field.value;
      else content[field.name] ??= "";
    } else if (field instanceof HTMLInputElement && field.type === "checkbox") {
      content[keyOf(field)] = field.checked ? "1" : "";
    } else {
      content[field.name] = field.value.slice(0, 20_000);
    }
  }
  return content;
}

// Écrit les valeurs comme une saisie : les champs tenus par React voient l'évènement.
function writeForm(form: HTMLFormElement, content: Content): void {
  for (const field of fieldsOf(form)) {
    const key = keyOf(field);
    if (!(key in content)) continue;
    const value = content[key] ?? "";
    if (field instanceof HTMLInputElement && (field.type === "radio" || field.type === "checkbox")) {
      const wanted = field.type === "radio" ? field.value === value : value === "1";
      if (field.checked !== wanted) field.click();
      continue;
    }
    const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : field instanceof HTMLSelectElement ? HTMLSelectElement.prototype : HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
    field.dispatchEvent(new Event("input", { bubbles: true }));
    field.dispatchEvent(new Event("change", { bubbles: true }));
  }
}

function hasText(content: Content): boolean {
  return Object.values(content).some((value) => value.trim() !== "" && value !== "1");
}

function differs(current: Content, draft: Content): boolean {
  return Object.entries(draft).some(([key, value]) => (current[key] ?? "") !== value);
}

// submission : l'état rendu par l'action du formulaire (chaque envoi en donne un nouveau) ; saved :
// l'envoi a enregistré la saisie.
export function DraftKeeper({ formKey, submission, saved }: { formKey: string; submission?: unknown; saved?: boolean }) {
  const t = useTranslations("Drafts");
  const locale = useLocale();
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<number | undefined>(undefined);
  const submitted = useRef<Content | null>(null);
  const firstSubmission = useRef(true);
  const [offer, setOffer] = useState<FormDraftView | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const formOf = () => anchor.current?.closest("form") ?? null;

  useEffect(() => {
    const form = formOf();
    if (!form) return;
    let alive = true;

    const push = async (content: Content) => {
      const savedAt = new Date().toISOString();
      if (!hasText(content)) {
        writeLocal(formKey, null);
        if (navigator.onLine) await discardFormDraftAction(formKey).catch(() => undefined);
        return;
      }
      writeLocal(formKey, { content, savedAt, pending: true });
      if (!navigator.onLine) return;
      try {
        const result = await saveFormDraftAction(formKey, content);
        if ("savedAt" in result) writeLocal(formKey, { content, savedAt: result.savedAt ?? savedAt, pending: false });
      } catch {
        // Le serveur ne répond pas : la copie de l'appareil reste, elle partira au retour du réseau.
      }
    };

    const onInput = () => {
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void push(readForm(form)), PAUSE_MS);
    };
    const onSubmit = (event: Event) => {
      const content = readForm(form);
      if (!navigator.onLine) {
        // Sans réseau, l'envoi échouerait et viderait l'écran : il n'a pas lieu, la saisie reste.
        event.preventDefault();
        event.stopPropagation();
        writeLocal(formKey, { content, savedAt: new Date().toISOString(), pending: true });
        setNotice(t("offlineSubmit"));
        return;
      }
      window.clearTimeout(timer.current);
      submitted.current = content;
      setNotice(null);
    };
    const onOnline = () => {
      const local = readLocal(formKey);
      if (local?.pending) void push(local.content);
    };

    form.addEventListener("input", onInput);
    form.addEventListener("change", onInput);
    form.addEventListener("submit", onSubmit, true);
    window.addEventListener("online", onOnline);

    // Un brouillon retrouvé : celui du serveur, ou la copie de l'appareil qui n'a pas pu partir.
    void loadFormDraftAction(formKey)
      .catch(() => null)
      .then((server) => {
        if (!alive) return;
        const local = readLocal(formKey);
        if (local && !local.pending && !server) writeLocal(formKey, null);
        const candidate = local?.pending && (!server || local.savedAt > server.savedAt) ? { content: local.content, savedAt: local.savedAt } : server;
        if (candidate && hasText(candidate.content) && differs(readForm(form), candidate.content)) setOffer(candidate);
        if (local?.pending && navigator.onLine) void push(local.content);
      });

    return () => {
      alive = false;
      window.clearTimeout(timer.current);
      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onInput);
      form.removeEventListener("submit", onSubmit, true);
      window.removeEventListener("online", onOnline);
    };
    // Le composant suit un formulaire : sa clé ne change pas pendant sa vie.
  }, [formKey]);

  // Après un envoi : enregistré, le brouillon s'efface ; refusé, le texte saisi revient.
  useEffect(() => {
    if (firstSubmission.current) {
      firstSubmission.current = false;
      return;
    }
    const form = formOf();
    if (saved) {
      writeLocal(formKey, null);
      setOffer(null);
      void discardFormDraftAction(formKey).catch(() => undefined);
    } else if (form && submitted.current) {
      writeForm(form, submitted.current);
    }
  }, [submission]);

  const resume = () => {
    const form = formOf();
    if (form && offer) writeForm(form, offer.content);
    setOffer(null);
  };
  const dismiss = () => {
    setOffer(null);
    writeLocal(formKey, null);
    void discardFormDraftAction(formKey).catch(() => undefined);
  };
  const date = offer ? new Intl.DateTimeFormat(locale, { dateStyle: "long", timeStyle: "short", timeZone: "Europe/Paris" }).format(new Date(offer.savedAt)) : "";

  return (
    <span ref={anchor} className="draft-keeper">
      {offer ? (
        <span role="status" className="draft-offer">
          <span>{t("found", { date })}</span>
          <button type="button" className="button-ghost" onClick={resume}>
            {t("resume")}
          </button>
          <button type="button" className="link-button" onClick={dismiss}>
            {t("discard")}
          </button>
        </span>
      ) : null}
      {notice ? <span role="alert">{notice}</span> : null}
    </span>
  );
}
