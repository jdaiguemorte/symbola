"use client";

// Lot 62b (UX-07, UX-09, UX-13 ; décision D1) — une liste de réglages qui s'enregistre toute seule :
// chaque ligne part au serveur quand on quitte un de ses champs (ou qu'on change une liste, une
// case), sans bouton « Enregistrer » par ligne. La barre de la liste dit où en est l'enregistrement
// et propose « Annuler la dernière modification » : la valeur d'avant est renvoyée par la même
// action serveur, rien de nouveau n'est écrit côté serveur pour annuler. Les actions de ligne
// (monter, masquer, archiver) passent par la même barre.
// L'enregistrement d'une fiche (une seule ligne, version et conflits) reste « autosave-form.tsx ».
//
// Lot 74h (D7, G8 ; page 30 des maquettes du lot 68) : avec `rowStatus` (les mots de « ✓ Enregistré »,
// `savedIndicatorLabels()`), « ✓ Enregistré » s'écrit sur la ligne enregistrée (`status` rendu par
// useAutosaveRow, à poser dans un SavedIndicator) au lieu de la barre ; la barre ne paraît plus que pour une
// erreur ou « Annuler la dernière modification ». Sans `rowStatus`, rien ne change (écrans des vagues 74i et
// 74j pas encore basculés).
import { createContext, useCallback, useContext, useEffect, useId, useMemo, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { SavedLabels, SavedStatus } from "./saved-indicator";

export type AutosaveResult = { error?: string } | void;
export type AutosaveChange = { apply: () => Promise<AutosaveResult>; revert?: () => Promise<AutosaveResult> };

type RowState = { row: string; status: SavedStatus; stamp: number };
type ListContext = { run: (change: AutosaveChange, row?: string) => Promise<boolean>; refuse: (message: string) => void; rowState: RowState | null; rowLabels: SavedLabels | null };

const Context = createContext<ListContext | null>(null);

type BarState = { status: "idle" | "saving" | "saved" | "undone" } | { status: "error"; message: string };

export function AutosaveList({ children, hint, rowStatus }: { children: ReactNode; hint?: string; rowStatus?: SavedLabels }) {
  const t = useTranslations("SettingsLists");
  const [state, setState] = useState<BarState>({ status: "idle" });
  const [rowState, setRowState] = useState<RowState | null>(null);
  const [canUndo, setCanUndo] = useState(false);
  const last = useRef<(() => Promise<AutosaveResult>) | null>(null);

  const settle = useCallback(
    async (work: () => Promise<AutosaveResult>, done: "saved" | "undone"): Promise<boolean> => {
      setState({ status: "saving" });
      try {
        const result = await work();
        if (result?.error) {
          setState({ status: "error", message: result.error });
          return false;
        }
        setState({ status: done });
        return true;
      } catch {
        setState({ status: "error", message: t("failed") });
        return false;
      }
    },
    [t],
  );

  const run = useCallback(
    async (change: AutosaveChange, row?: string): Promise<boolean> => {
      if (row) setRowState((current) => ({ row, status: "saving", stamp: (current?.stamp ?? 0) + 1 }));
      const saved = await settle(change.apply, "saved");
      if (row) setRowState((current) => (saved ? { row, status: "saved", stamp: (current?.stamp ?? 0) + 1 } : null));
      if (saved) {
        last.current = change.revert ?? null;
        setCanUndo(change.revert !== undefined);
      }
      return saved;
    },
    [settle],
  );

  const undo = async () => {
    const revert = last.current;
    if (!revert) return;
    last.current = null;
    setCanUndo(false);
    await settle(revert, "undone");
  };

  // Un champ que le navigateur refuse (obligatoire, hors bornes) : la barre le dit, rien ne part.
  const refuse = useCallback((message: string) => setState({ status: "error", message }), []);

  const context = useMemo(() => ({ run, refuse, rowState, rowLabels: rowStatus ?? null }), [run, refuse, rowState, rowStatus]);
  // Avec « ✓ Enregistré » sur la ligne, la barre ne sert plus qu'à une erreur ou à l'annulation.
  const showBar = !rowStatus || state.status === "error" || canUndo;
  const message = state.status === "saving" ? t("saving") : state.status === "saved" ? t("saved") : state.status === "undone" ? t("undone") : (hint ?? t("hint"));

  return (
    <Context.Provider value={context}>
      <div className="edit-bar edit-bar-auto" data-status={state.status} hidden={!showBar}>
        {state.status === "error" ? (
          <p role="alert">{t("error", { message: state.message })}</p>
        ) : (
          <p role="status">{message}</p>
        )}
        {canUndo ? (
          <button type="button" className="button-secondary" onClick={() => void undo()}>
            {t("undo")}
          </button>
        ) : null}
      </div>
      {children}
    </Context.Provider>
  );
}

export function useAutosaveList(): ListContext {
  const context = useContext(Context);
  if (!context) throw new Error("useAutosaveList : hors d'une AutosaveList");
  return context;
}

type Field = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
type Snapshot = [name: string, value: string][];

function fieldsOf(root: HTMLElement | null): Field[] {
  return root ? [...root.querySelectorAll<Field>("input[name], select[name], textarea[name]")] : [];
}

function valueOf(field: Field): string {
  if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) return field.checked ? field.value || "on" : "";
  return field.value;
}

function snapshotOf(root: HTMLElement | null): Snapshot {
  return fieldsOf(root).map((field) => [field.name, valueOf(field)]);
}

function formDataOf(root: HTMLElement | null, snapshot: Snapshot): FormData {
  const data = new FormData();
  const boxes = new Set(fieldsOf(root).filter((field) => field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")).map((field) => field.name));
  // Une case décochée n'est pas envoyée, comme dans un formulaire.
  for (const [name, value] of snapshot) if (!(boxes.has(name) && value === "")) data.append(name, value);
  return data;
}

function write(root: HTMLElement | null, snapshot: Snapshot): void {
  const fields = fieldsOf(root);
  snapshot.forEach(([name, value], index) => {
    const field = fields[index];
    if (!field || field.name !== name) return;
    if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) field.checked = value !== "";
    else field.value = value;
  });
}

const same = (a: Snapshot, b: Snapshot) => a.length === b.length && a.every(([name, value], index) => b[index]![0] === name && b[index]![1] === value);

// Une ligne de la liste : ses champs nommés (cachés compris) sont envoyés ensemble à « save » dès que
// l'un d'eux a changé et qu'on le quitte. Les propriétés rendues se posent sur l'élément de la ligne.
// « revert » dit à « save » qu'il renvoie les valeurs d'avant (« Annuler la dernière modification »).
export function useAutosaveRow<E extends HTMLElement = HTMLDivElement>(save: (data: FormData, context: { revert: boolean }) => Promise<AutosaveResult>, values?: Record<string, string>) {
  const { run, refuse, rowState } = useAutosaveList();
  const rowId = useId();
  const ref = useRef<E>(null);
  const saved = useRef<Snapshot>([]);
  const saveRef = useRef(save);
  saveRef.current = save;

  useEffect(() => {
    saved.current = snapshotOf(ref.current);
  }, []);

  // Ce que le serveur a enregistré fait foi : après un enregistrement, une annulation ou un retour à
  // la valeur de départ, les champs prennent la valeur rendue par le serveur, sauf celui où l'on écrit.
  const signature = values ? JSON.stringify(values) : "";
  const seen = useRef(signature);
  const latest = useRef(values);
  latest.current = values;
  useEffect(() => {
    const rendered = latest.current;
    if (seen.current === signature || !rendered) return;
    seen.current = signature;
    for (const field of fieldsOf(ref.current)) {
      const value = rendered[field.name];
      if (value === undefined || field === document.activeElement) continue;
      if (field instanceof HTMLInputElement && (field.type === "checkbox" || field.type === "radio")) field.checked = value !== "";
      else field.value = value;
    }
    saved.current = snapshotOf(ref.current);
  }, [signature]);

  const flush = useCallback(async () => {
    const root = ref.current;
    const now = snapshotOf(root);
    const before = saved.current;
    if (same(now, before)) return;
    // Un champ refusé par le navigateur (obligatoire, trop long, hors bornes) : il est marqué, la barre
    // de la liste donne la raison, et rien ne part. Le focus n'est pas retenu dans le champ.
    for (const field of fieldsOf(root)) field.removeAttribute("aria-invalid");
    const invalid = fieldsOf(root).find((field) => !field.checkValidity());
    if (invalid) {
      invalid.setAttribute("aria-invalid", "true");
      const name = invalid.getAttribute("aria-label") ?? invalid.labels?.[0]?.textContent?.trim() ?? "";
      refuse(name ? `${name} — ${invalid.validationMessage}` : invalid.validationMessage);
      return;
    }
    saved.current = now;
    const done = await run(
      {
      apply: () => saveRef.current(formDataOf(root, now), { revert: false }),
      revert: async () => {
        const result = await saveRef.current(formDataOf(ref.current ?? root, before), { revert: true });
        if (!result?.error) {
          write(ref.current, before);
          saved.current = before;
        }
        return result;
      },
      },
      rowId,
    );
    if (!done) saved.current = before;
  }, [run, refuse, rowId]);

  // Pour une action de ligne (rétablir la valeur de départ) : les valeurs de la ligne, telles qu'à l'écran.
  const read = useCallback((): Record<string, string> => Object.fromEntries(snapshotOf(ref.current)), []);

  return {
    ref,
    flush,
    read,
    // Lot 74h : l'état de « ✓ Enregistré » pour cette ligne (avec `rowStatus` sur la liste) ; `rowId` à
    // passer à `run` pour une action de ligne (monter, supprimer), qui s'annonce alors sur la ligne.
    rowId,
    status: (rowState?.row === rowId ? rowState.status : "idle") as SavedStatus,
    stamp: rowState?.row === rowId ? rowState.stamp : 0,
    rowProps: {
      onBlur: (event: FocusEvent<E>) => {
        if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) void flush();
      },
      onChange: (event: FormEvent<E>) => {
        const target = event.target;
        if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && (target.type === "checkbox" || target.type === "radio"))) void flush();
      },
      onKeyDown: (event: KeyboardEvent<E>) => {
        if (event.key === "Enter" && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          void flush();
        }
      },
    },
  };
}
