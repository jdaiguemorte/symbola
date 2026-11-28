"use client";

// Lot 74h (D7, G8, M1 ; page 30 des maquettes du lot 68 ; avenant à l'ADR 0120) — la barre
// d'enregistrement d'un formulaire à champs liés (la fiche, les mentions, une adresse d'envoi…) : collée
// au bas de la fenêtre (au-dessus de la barre du bas sur téléphone), bord haut de 2 px en encre, sans
// ombre (DS-S2). Elle dit l'état en mots : « Rien à enregistrer », « 2 modifications à enregistrer :
// Ville, Téléphone », « Enregistré à 10:42 ». Son bouton n'est jamais grisé : sans changement, il répond
// « Rien à enregistrer » ; avec une erreur, il mène au premier champ fautif. Un champ modifié porte un
// filet d'encre à gauche (data-changed). « Annuler les modifications » rend les valeurs enregistrées,
// sans question. Quitter l'écran avec des changements pose la question dans la barre (« Rester sur la
// fiche », « Quitter sans enregistrer », « Enregistrer et quitter »), jamais dans une seconde fenêtre ;
// fermer l'onglet passe par la garde du navigateur, et DraftKeeper garde la saisie (ADR 0074).
//
// Réemploi (vagues 74i et 74j) : poser la barre comme dernier enfant du <form> d'un useActionState :
//   <SettingsSaveBar formKey="…" fieldLabels={{ city: "Ville", … }} labels={await saveBarLabels()}
//     submitLabel="Enregistrer la fiche" pending={pending} submission={state} saved={state.success === true}
//     error={state.error} />
// `fieldLabels` : les champs que la barre nomme (les autres ne comptent pas) ; `savedAt` : la dernière
// écriture connue du serveur, pour « Enregistré à … » dès l'ouverture (facultatif).
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import type { SaveBarLabels } from "@/lib/settings/settings-header-texts";
import { changedFieldNames, leaveDecision, leavesScreen, saveBarState, savedTimeLabel, type FormValues } from "@/lib/settings/settings-pattern-model";
import { DraftKeeper, readForm, writeForm } from "./draft-keeper";

function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in values ? String(values[key]) : match));
}

export function SettingsSaveBar({
  formKey,
  fieldLabels,
  labels,
  submitLabel,
  pending,
  submission,
  saved,
  error,
  savedAt = null,
  locale = "fr",
}: {
  formKey: string;
  fieldLabels: Record<string, string>;
  labels: SaveBarLabels;
  submitLabel: string;
  pending: boolean;
  submission: unknown;
  saved: boolean;
  error?: string | undefined;
  savedAt?: string | null;
  locale?: string;
}) {
  const router = useRouter();
  const anchor = useRef<HTMLDivElement>(null);
  const baseline = useRef<FormValues | null>(null);
  const [changed, setChanged] = useState<string[]>([]);
  const [pressedWithoutChange, setPressedWithoutChange] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(savedAt ? new Date(savedAt) : null);
  const [leaving, setLeaving] = useState<string | null>(null);
  const leaveAfterSave = useRef<string | null>(null);
  const changedRef = useRef(changed);
  changedRef.current = changed;

  const formOf = () => anchor.current?.closest("form") ?? null;

  const measure = () => {
    const form = formOf();
    if (!form || !baseline.current) return;
    const names = changedFieldNames(baseline.current, readForm(form), fieldLabels);
    for (const name of Object.keys(fieldLabels)) {
      const field = form.elements.namedItem(name);
      if (field instanceof HTMLElement) field.toggleAttribute("data-changed", names.includes(name));
    }
    setChanged(names);
  };

  useEffect(() => {
    const form = formOf();
    if (!form) return;
    baseline.current = readForm(form);
    const onInput = () => {
      setPressedWithoutChange(false);
      measure();
    };
    form.addEventListener("input", onInput);
    form.addEventListener("change", onInput);
    // Fermer l'onglet ou recharger : la garde du navigateur ; la saisie reste en brouillon.
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (leaveDecision(changedRef.current) === "confirm") event.preventDefault();
    };
    // Un lien de l'app vers un autre écran : la question, dans la barre.
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const link = (event.target as Element | null)?.closest?.("a[href]");
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank" || link.hasAttribute("download")) return;
      if (leaveDecision(changedRef.current) === "leave" || !leavesScreen(window.location.href, link.href)) return;
      event.preventDefault();
      event.stopPropagation();
      setLeaving(link.href);
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      form.removeEventListener("input", onInput);
      form.removeEventListener("change", onInput);
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
    // La barre suit un formulaire : il ne change pas pendant sa vie.
  }, [formKey]);

  // Après un envoi : enregistré, la saisie devient la référence ; refusé, le premier champ fautif.
  const firstSubmission = useRef(true);
  useEffect(() => {
    if (firstSubmission.current) {
      firstSubmission.current = false;
      return;
    }
    const form = formOf();
    if (!form) return;
    if (saved) {
      // Les champs reprennent la valeur enregistrée au rendu suivant : la référence se lit juste après.
      window.requestAnimationFrame(() => {
        baseline.current = readForm(form);
        measure();
        setLastSaved(new Date());
        const target = leaveAfterSave.current;
        leaveAfterSave.current = null;
        if (target) navigate(target);
      });
    } else {
      leaveAfterSave.current = null;
      const invalid = form.querySelector<HTMLElement>("[aria-invalid='true']") ?? form.querySelector<HTMLElement>(":invalid");
      invalid?.focus();
      measure();
    }
  }, [submission]);

  const navigate = (href: string) => {
    const url = new URL(href);
    if (url.origin === window.location.origin) router.push(`${url.pathname}${url.search}${url.hash}`);
    else window.location.assign(href);
  };

  const reset = () => {
    const form = formOf();
    if (!form || !baseline.current) return;
    writeForm(form, baseline.current);
    measure();
  };

  const state = saveBarState({ changed, fieldLabels, savedAt: lastSaved, pressedWithoutChange });
  const message = pending
    ? labels.saving
    : state.kind === "changed"
      ? fill(state.count === 1 ? labels.changedOne : labels.changedOther, { count: state.count, fields: state.fields.join(", ") })
      : state.kind === "saved"
        ? fill(labels.saved, { time: savedTimeLabel(state.at, locale) })
        : state.kind === "nothingToSave"
          ? labels.nothingToSave
          : labels.nothing;

  return (
    <div ref={anchor} className="settings-save-bar" role="region" aria-label={labels.region} data-changed={changed.length > 0 ? "true" : undefined}>
      <DraftKeeper formKey={formKey} submission={submission} saved={saved} />
      {leaving ? (
        <div className="settings-save-bar-confirm" role="alertdialog" aria-labelledby={`${formKey}-leave-title`} aria-describedby={`${formKey}-leave-body`}>
          <p id={`${formKey}-leave-title`} className="settings-save-bar-confirm-title">
            {labels.leaveTitle}
          </p>
          <p id={`${formKey}-leave-body`}>{fill(labels.leaveBody, { fields: changed.map((name) => fieldLabels[name] ?? name).join(", ") })}</p>
          <span className="settings-save-bar-actions">
            <button type="button" className="button-ghost" autoFocus onClick={() => setLeaving(null)}>
              {labels.stay}
            </button>
            <button
              type="button"
              className="button-secondary"
              onClick={() => {
                const target = leaving;
                setLeaving(null);
                changedRef.current = [];
                navigate(target);
              }}
            >
              {labels.leave}
            </button>
            <button
              type="button"
              onClick={() => {
                leaveAfterSave.current = leaving;
                setLeaving(null);
                formOf()?.requestSubmit();
              }}
            >
              {labels.saveAndLeave}
            </button>
          </span>
        </div>
      ) : (
        <>
          <div className="settings-save-bar-state">
            <p role="status">{message}</p>
            {error ? <p role="alert">{error}</p> : null}
          </div>
          <span className="settings-save-bar-actions">
            {changed.length > 0 ? (
              <button type="button" className="button-ghost" onClick={reset}>
                {labels.reset}
              </button>
            ) : null}
            <button
              type="submit"
              aria-busy={pending ? "true" : undefined}
              onClick={(event) => {
                if (pending) {
                  event.preventDefault();
                  return;
                }
                if (changed.length === 0) {
                  // Jamais grisé : sans changement, il le dit.
                  event.preventDefault();
                  setPressedWithoutChange(true);
                }
              }}
            >
              {submitLabel}
            </button>
          </span>
        </>
      )}
    </div>
  );
}
