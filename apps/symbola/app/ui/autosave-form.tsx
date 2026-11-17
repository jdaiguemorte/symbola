"use client";

// Lot 39b (UX-09 ; D8 ; ADR 0074) — une fiche qui s'enregistre toute seule : à la pause de frappe ou
// en quittant un champ, sans attendre le bouton (il reste, pour qui veut enregistrer tout de suite).
// L'écran garde la version de la fiche et les valeurs de départ ; si quelqu'un a enregistré entre-temps,
// les champs qu'on n'a pas touchés prennent sa valeur, et un champ changé des deux côtés est montré
// avec les deux valeurs : on choisit, rien n'est écrasé en silence. L'appel ne passe pas par l'action
// du formulaire : React viderait les champs pendant qu'on écrit.
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { FieldValues } from "@/lib/autosave";
import type { AutosaveConflict, AutosaveState } from "@/lib/autosave-server";

type Action = (previous: AutosaveState, formData: FormData) => Promise<AutosaveState>;

const PAUSE_MS = 1500;

function fieldOf(form: HTMLFormElement, name: string): HTMLInputElement | HTMLTextAreaElement | null {
  const element = form.elements.namedItem(name);
  return element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement ? element : null;
}

function setValue(field: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  const prototype = field instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, "value")?.set?.call(field, value);
}

export function AutoSaveForm({
  action,
  recordId,
  version,
  values,
  fieldLabels,
  ariaLabel,
  submitLabel,
  savedLabel,
  className,
  children,
}: {
  action: Action;
  recordId: string;
  version: string;
  values: FieldValues;
  fieldLabels: Record<string, string>;
  ariaLabel: string;
  submitLabel: string;
  savedLabel: string;
  className?: string;
  children: ReactNode;
}) {
  const t = useTranslations("Autosave");
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const versionRef = useRef(version);
  const baselineRef = useRef<FieldValues>(values);
  const timer = useRef<number | undefined>(undefined);
  const busy = useRef(false);
  const again = useRef(false);
  const dirty = useRef(false);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{ items: AutosaveConflict[]; stored: FieldValues; version: string; by: string | null } | null>(null);
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;
  const fields = Object.keys(fieldLabels);

  const save = async () => {
    const form = formRef.current;
    if (!form || conflictRef.current) return;
    if (busy.current) {
      again.current = true;
      return;
    }
    busy.current = true;
    dirty.current = false;
    window.clearTimeout(timer.current);
    setStatus("saving");
    const data = new FormData(form);
    data.set("id", recordId);
    data.set("version", versionRef.current);
    data.set("baseline", JSON.stringify(baselineRef.current));
    const sent: FieldValues = Object.fromEntries(fields.map((field) => [field, String(data.get(field) ?? "")]));
    try {
      const result = await action({ status: "idle" }, data);
      if (result.status === "saved") {
        for (const field of fields) {
          const element = fieldOf(form, field);
          const stored = result.values[field] ?? "";
          if (element && element.value === sent[field] && stored !== sent[field]) setValue(element, stored);
        }
        baselineRef.current = result.values;
        versionRef.current = result.version;
        setError(null);
        setStatus("saved");
        router.refresh();
      } else if (result.status === "conflict") {
        // Ce que l'autre a changé, et que je n'ai pas touché, s'affiche tout de suite.
        for (const field of fields) {
          const element = fieldOf(form, field);
          if (element && !result.conflicts.some((item) => item.field === field) && element.value === (baselineRef.current[field] ?? "")) setValue(element, result.stored[field] ?? "");
        }
        setStatus("idle");
        setConflict({ items: result.conflicts, stored: result.stored, version: result.version, by: result.by });
      } else if (result.status === "error") {
        setStatus("idle");
        setError(result.message);
      }
    } catch {
      setStatus("idle");
      setError(t("offline"));
      dirty.current = true;
    } finally {
      busy.current = false;
      if (again.current) {
        again.current = false;
        void save();
      }
    }
  };

  useEffect(() => {
    const form = formRef.current;
    if (!form) return;
    const onInput = () => {
      dirty.current = true;
      setStatus("idle");
      window.clearTimeout(timer.current);
      timer.current = window.setTimeout(() => void save(), PAUSE_MS);
    };
    const onLeave = (event: FocusEvent) => {
      if (dirty.current && !(event.relatedTarget instanceof Node && event.relatedTarget === event.target)) void save();
    };
    const onOnline = () => {
      if (dirty.current) void save();
    };
    form.addEventListener("input", onInput);
    form.addEventListener("focusout", onLeave);
    window.addEventListener("online", onOnline);
    return () => {
      window.clearTimeout(timer.current);
      form.removeEventListener("input", onInput);
      form.removeEventListener("focusout", onLeave);
      window.removeEventListener("online", onOnline);
    };
    // La fiche suivie ne change pas pendant la vie du formulaire.
  }, [recordId]);

  const resolve = (item: AutosaveConflict, keep: "mine" | "theirs") => {
    const form = formRef.current;
    const current = conflictRef.current;
    if (!form || !current) return;
    const element = fieldOf(form, item.field);
    if (keep === "theirs" && element) setValue(element, item.theirs);
    const rest = current.items.filter((other) => other.field !== item.field);
    if (rest.length > 0) {
      setConflict({ ...current, items: rest });
      return;
    }
    // Tout est choisi : la fiche repart de ce qui est enregistré, avec mes choix par-dessus.
    baselineRef.current = current.stored;
    versionRef.current = current.version;
    conflictRef.current = null;
    setConflict(null);
    dirty.current = true;
    void save();
  };

  const shown = (value: string) => (value.trim() === "" ? t("empty") : `« ${value} »`);

  return (
    <form
      ref={formRef}
      aria-label={ariaLabel}
      className={className}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      {children}
      {conflict ? (
        <section className="autosave-conflict" aria-labelledby={`conflit-${recordId}`}>
          <h3 id={`conflit-${recordId}`}>{t("conflictTitle")}</h3>
          {conflict.items.map((item) => (
            <div key={item.field} role="group" aria-label={fieldLabels[item.field] ?? item.field}>
              <p>{conflict.by ? t("conflictBy", { field: fieldLabels[item.field] ?? item.field, who: conflict.by }) : t("conflictBySelf", { field: fieldLabels[item.field] ?? item.field })}</p>
              <p>{t("theirs", { value: shown(item.theirs) })}</p>
              <p>{t("mine", { value: shown(item.mine) })}</p>
              <div className="row-wrap">
                <button type="button" onClick={() => resolve(item, "mine")}>
                  {t("keepMine")}
                </button>
                <button type="button" className="button-ghost" onClick={() => resolve(item, "theirs")}>
                  {t("takeTheirs")}
                </button>
              </div>
            </div>
          ))}
        </section>
      ) : null}
      <button type="submit" disabled={status === "saving"}>
        {submitLabel}
      </button>
      {error ? <p role="alert">{error}</p> : null}
      <p role="status">{status === "saving" ? t("saving") : status === "saved" ? savedLabel : ""}</p>
    </form>
  );
}
