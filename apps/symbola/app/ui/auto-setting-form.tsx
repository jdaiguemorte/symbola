"use client";

// Lot 74h (D7, G8 ; page 30 des maquettes du lot 68) — une liste de réglages isolés : chaque réglage
// (un nombre, un choix, un interrupteur) s'enregistre seul, au changement d'une case ou d'une liste, à la
// sortie d'un champ, ou à Entrée ; « ✓ Enregistré » s'écrit à côté de lui (SettingStatus), jamais
// ailleurs. Aucun bouton « Enregistrer ».
// - Une valeur que le champ refuse (hors bornes, obligatoire vide) n'est pas envoyée : l'erreur s'écrit
//   sous le champ (forme du lot 70b), le champ reste ouvert avec la valeur saisie.
// - Un refus du serveur : son message sous le champ, et la valeur d'avant rendue.
//
// Réemploi (vagues 74i et 74j) : envelopper les champs d'un écran dans
//   <AutoSettingForm action={monAction} labels={await savedIndicatorLabels()} ariaLabel="…">
//     …<input name="days" …/> <SettingStatus name="days" />…
//   </AutoSettingForm>
// `action` est une action serveur existante, de la forme de useActionState `(état, données) => état` :
// elle reçoit tout le formulaire (comme avant, rien ne change côté serveur) et rend `{ error?: string }`.
// `invalid` donne, par champ, le message d'une valeur refusée par le navigateur (« Entre 1 et 30 jours. ») ;
// sans lui, le message du navigateur. Un AutoSettingForm par groupe de réglages qu'une même action
// enregistre ; plusieurs sur un écran si besoin. Plusieurs cases d'une même ligne (un tableau de cases)
// peuvent partager un seul « ✓ Enregistré » : `data-setting="ligne"` sur chaque case, et
// `<SettingStatus name="ligne" />` une fois sur la ligne.
import { createContext, useCallback, useContext, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { FieldError } from "./field-error";
import { SavedIndicator, type SavedLabels, type SavedStatus } from "./saved-indicator";

type ActionResult = { error?: string; success?: boolean | string } | void;
type Action = (previous: never, formData: FormData) => Promise<ActionResult>;
type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type FieldState = { status: SavedStatus; error?: string; stamp: number };

type Context = { stateOf: (name: string) => FieldState | undefined; labels: SavedLabels; idOf: (name: string) => string };
const SettingContext = createContext<Context | null>(null);

const isToggle = (field: Field) => field instanceof HTMLSelectElement || (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio"));

function valueOf(field: Field): string {
  if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) return field.checked ? "1" : "";
  return field.value;
}

function initialOf(field: Field): string {
  if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) return field.defaultChecked ? "1" : "";
  if (field instanceof HTMLSelectElement) return [...field.options].find((option) => option.defaultSelected)?.value ?? field.value;
  return field.defaultValue;
}

function restore(field: Field, value: string) {
  if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) field.checked = value === "1";
  else field.value = value;
}

export function AutoSettingForm({
  action,
  labels,
  ariaLabel,
  invalid,
  className,
  children,
}: {
  action: Action;
  labels: SavedLabels;
  // Le nom du formulaire, quand l'écran en a besoin (sans nom, ce n'est pas une région) ; jamais le libellé
  // d'un de ses champs, qui le doublerait.
  ariaLabel?: string;
  invalid?: Record<string, string>;
  className?: string;
  children: ReactNode;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const prefix = useId();
  // La valeur enregistrée de chaque champ (celle à rendre si le serveur refuse).
  const savedValues = useRef(new Map<string, string>());
  const [states, setStates] = useState<Record<string, FieldState>>({});
  const queue = useRef(Promise.resolve());

  const idOf = useCallback((name: string) => `${prefix}-${name.replace(/[^a-zA-Z0-9_-]/g, "_")}`, [prefix]);
  const setState = (name: string, next: Omit<FieldState, "stamp">) => setStates((all) => ({ ...all, [name]: { ...next, stamp: (all[name]?.stamp ?? 0) + 1 } }));

  // L'erreur s'ajoute à la description du champ (sa phrase d'aide reste lue) et s'en retire ensuite.
  const mark = (field: Field, error: string | undefined) => {
    const errorId = `${idOf(field.dataset.setting ?? field.name)}-error`;
    const ids = new Set((field.getAttribute("aria-describedby") ?? "").split(" ").filter(Boolean));
    if (error) {
      field.setAttribute("aria-invalid", "true");
      ids.add(errorId);
    } else {
      field.removeAttribute("aria-invalid");
      ids.delete(errorId);
    }
    if (ids.size > 0) field.setAttribute("aria-describedby", [...ids].join(" "));
    else field.removeAttribute("aria-describedby");
  };

  const save = (field: Field) => {
    const form = formRef.current;
    if (!form || !field.name || field.disabled) return;
    // La valeur d'avant : retenue au focus ; à défaut, celle du rendu serveur.
    const before = savedValues.current.get(field.name) ?? initialOf(field);
    const now = valueOf(field);
    if (now === before && !isToggle(field)) return;
    if (!field.checkValidity()) {
      const message = invalid?.[field.name] ?? field.validationMessage;
      mark(field, message);
      setState(field.dataset.setting ?? field.name, { status: "idle", error: message });
      return;
    }
    mark(field, undefined);
    const key = field.dataset.setting ?? field.name;
    setState(key, { status: "saving" });
    const data = new FormData(form);
    // Les enregistrements partent l'un après l'autre : le dernier changement gagne toujours.
    queue.current = queue.current.then(async () => {
      let error: string | undefined;
      try {
        const result = await action(undefined as never, data);
        error = result && typeof result === "object" ? result.error : undefined;
      } catch {
        error = labels.failed;
      }
      if (error) {
        restore(field, before);
        mark(field, error);
        setState(key, { status: "idle", error });
      } else {
        savedValues.current.set(field.name, now);
        setState(key, { status: "saved" });
      }
    });
  };

  const context = useMemo<Context>(() => ({ stateOf: (name) => states[name], labels, idOf }), [states, labels, idOf]);

  return (
    <SettingContext.Provider value={context}>
      <form
        ref={formRef}
        aria-label={ariaLabel}
        className={className}
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          const active = document.activeElement;
          if (active && formRef.current?.contains(active) && (active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement)) save(active);
        }}
        onFocus={(event) => {
          const field = event.target as unknown as Field;
          if (field.name && !savedValues.current.has(field.name)) savedValues.current.set(field.name, valueOf(field));
        }}
        onChange={(event) => {
          const field = event.target as unknown as Field;
          if (isToggle(field)) save(field);
        }}
        onBlur={(event) => {
          const field = event.target as unknown as Field;
          if (!isToggle(field) && (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement)) save(field);
        }}
      >
        {children}
      </form>
    </SettingContext.Provider>
  );
}

// À côté d'une commande : « ✓ Enregistré » quand son enregistrement aboutit ; l'erreur, dessous, sinon.
export function SettingStatus({ name }: { name: string }) {
  const context = useContext(SettingContext);
  if (!context) throw new Error("SettingStatus : hors d'un AutoSettingForm");
  const state = context.stateOf(name);
  const id = context.idOf(name);
  return (
    <>
      <SavedIndicator status={state?.status ?? "idle"} stamp={state?.stamp} labels={context.labels} id={`${id}-status`} />
      <FieldError id={`${id}-error`} message={state?.error} />
    </>
  );
}
