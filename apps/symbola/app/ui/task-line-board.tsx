"use client";

// Lot 70c (CHR-02 ; M2, C-35, C-40) — la liste de lignes types et son mode « Sélectionner » : hors de ce
// mode, aucune case ; dedans, une case par ligne (« Fait » et « ⋯ » s'effacent).
// Lot 70d (CHR-03, UX-07, UX-15 ; M2 et la réserve de Julien, C-36, C-40, C-09 ; page 2 des maquettes) —
// la barre de sélection : elle paraît dès l'entrée dans le mode, collée au bas de la liste, sans la
// pousser (cocher une ligne ne déplace aucune autre ligne) ; bord d'encre, ombre, le nombre de tâches
// choisies en tête et des boutons de taille normale, aussi visible à l'ordinateur que sur téléphone :
// « Fait », « Changer la date… », « Confier à… », « Catégorie… », et dans « ⋯ » « Supprimer ». Chaque
// action dit combien de tâches elle touche et s'annule pendant dix secondes. Sur téléphone, les mots se
// raccourcissent (Fait, Date, Confier, Plus) et chaque choix s'ouvre en panneau du bas.
import { useCallback, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  bulkAssignAction,
  bulkCategoryAction,
  bulkDateAction,
  bulkDeleteAction,
  bulkDoneAction,
  bulkReopenAction,
  bulkRestoreAssignAction,
  bulkRestoreCategoriesAction,
  type BulkResult,
} from "@/app/taches/task-bulk-actions";
import { undoTaskChangeAction } from "@/app/taches/task-line-actions";
import { useFeedback } from "./feedback";
import { TaskLineList, type TaskLineGroup } from "./task-line";
import { TaskPopover, usePopover } from "./task-popover";
import type { TaskLineForm } from "@/lib/tasks/task-line";
import type { DateShortcutOption } from "./task-date-panel";
import type { AssignOption } from "./task-assign-panel";

type Option = { value: string; label: string };

function Words({ long, short }: { long: string; short: string }) {
  return (
    <>
      <span className="task-bulk-long">{long}</span>
      <span className="task-bulk-short">{short}</span>
    </>
  );
}

function BulkBar({
  ids,
  eventIds,
  available,
  categories,
  members,
  clientsLabel,
  vendors,
  onEnd,
}: {
  ids: string[];
  // L'évènement de chaque tâche choisie (« none » : hors évènement).
  eventIds: string[];
  available: number;
  categories: Option[];
  // « Vous » et les collègues (« member:<id> »).
  members: AssignOption[];
  clientsLabel: string;
  // Les prestataires retenus de chaque évènement.
  vendors: Record<string, AssignOption[]>;
  onEnd: () => void;
}) {
  const t = useTranslations("TaskScreen");
  const tLine = useTranslations("TaskLine");
  const feedback = useFeedback();
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const dates = usePopover();
  const assign = usePopover();
  const category = usePopover();
  const more = usePopover();
  const datesButton = useRef<HTMLButtonElement>(null);
  const assignButton = useRef<HTMLButtonElement>(null);
  const categoryButton = useRef<HTMLButtonElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const [dateMode, setDateMode] = useState<"shift" | "setDate">("shift");
  const [days, setDays] = useState("7");
  const [date, setDate] = useState("");
  const count = ids.length;
  const none = count === 0;
  // Un prestataire ne vaut que si toutes les tâches choisies sont du même évènement.
  const singleEvent = new Set(eventIds).size === 1 && eventIds[0] !== "none" ? eventIds[0]! : null;
  const eventVendors = singleEvent ? (vendors[singleEvent] ?? []) : [];

  const run = (action: () => Promise<BulkResult>, undo: ((result: BulkResult) => (() => Promise<BulkResult>) | null) | null, close?: () => void) =>
    startTransition(async () => {
      setError(null);
      const result = await action();
      if (!result.ok) {
        setError(result.error ?? t("bulkInvalid"));
        return;
      }
      close?.();
      const undoRun = undo ? undo(result) : null;
      feedback?.show({
        title: result.message ?? "",
        ...(undoRun
          ? {
              action: {
                kind: "undo" as const,
                label: tLine("undo"),
                run: async () => {
                  const undone = await undoRun();
                  feedback.show(undone.ok ? { title: t("bulkUndone", { count: undone.count ?? 0 }) } : { tone: "error", title: undone.error ?? tLine("undoExpired") });
                  router.refresh();
                },
              },
            }
          : {}),
      });
      onEnd();
      router.refresh();
    });

  const viaSnapshot = (result: BulkResult) => (result.undoId ? () => undoTaskChangeAction(result.undoId!).then((undone) => ({ ...undone, count: result.count ?? 0 })) : null);

  return (
    <div className="task-bulk" role="region" aria-label={t("bulkLabel")}>
      <p className="task-bulk-count" aria-live="polite">
        {none ? t("bulkNone") : t("bulkSelected", { count })}
      </p>
      <div className="task-bulk-actions">
        <button type="button" className="button-secondary" disabled={none || pending} onClick={() => run(() => bulkDoneAction(ids), (result) => (result.doneIds && result.doneIds.length > 0 ? () => bulkReopenAction(result.doneIds!) : null))}>
          {tLine("done")}
        </button>
        <button ref={datesButton} type="button" className="button-secondary" disabled={none || pending} aria-haspopup="dialog" aria-controls={dates.id} onClick={() => dates.open(datesButton.current)}>
          <Words long={tLine("changeDate")} short={t("bulkDateShort")} />
        </button>
        <button ref={assignButton} type="button" className="button-secondary" disabled={none || pending} aria-haspopup="dialog" aria-controls={assign.id} onClick={() => assign.open(assignButton.current)}>
          <Words long={tLine("assign")} short={t("bulkAssignShort")} />
        </button>
        <button ref={categoryButton} type="button" className="button-secondary task-bulk-wide" disabled={none || pending} aria-haspopup="dialog" aria-controls={category.id} onClick={() => category.open(categoryButton.current)}>
          {t("bulkCategory")}
        </button>
        <button ref={moreButton} type="button" className="button-secondary task-bulk-more" disabled={none || pending} aria-haspopup="menu" aria-controls={more.id} onClick={() => more.open(moreButton.current)}>
          <Words long="⋯" short={t("bulkMoreShort")} />
          <span className="sr-only task-bulk-long">{t("bulkMore")}</span>
        </button>
        <button type="button" className="button-ghost" onClick={onEnd}>
          {tLine("selectEnd")}
        </button>
      </div>
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}

      <TaskPopover handle={dates} label={t("bulkDateTitle", { count })} className="task-bulk-panel">
        <p className="task-popover-title">{t("bulkDateTitle", { count })}</p>
        <form
          className="task-bulk-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            const choice = dateMode === "shift" ? ({ kind: "shift", days: Number(days) } as const) : ({ kind: "setDate", date } as const);
            run(() => bulkDateAction(ids, choice), viaSnapshot, dates.close);
          }}
        >
          <label className="task-bulk-choice">
            <input type="radio" name="mode" checked={dateMode === "shift"} onChange={() => setDateMode("shift")} />
            <span>{t("bulkShiftBy")}</span>
            <input type="number" className="task-bulk-days" min={-366} max={366} step={1} value={days} aria-label={t("bulkShiftDays")} onFocus={() => setDateMode("shift")} onChange={(event) => setDays(event.target.value)} />
            <span>{t("bulkShiftUnit")}</span>
          </label>
          <label className="task-bulk-choice">
            <input type="radio" name="mode" checked={dateMode === "setDate"} onChange={() => setDateMode("setDate")} />
            <span>{t("bulkAllOn")}</span>
            <input type="date" value={date} aria-label={t("bulkAllOnDate")} onFocus={() => setDateMode("setDate")} onChange={(event) => setDate(event.target.value)} />
          </label>
          <div className="task-bulk-form-actions">
            <button type="button" className="button-ghost" onClick={dates.close}>
              {tLine("close")}
            </button>
            <button type="submit" className="button-secondary" disabled={pending}>
              {t("bulkApply", { count })}
            </button>
          </div>
        </form>
      </TaskPopover>

      <TaskPopover handle={assign} label={t("bulkAssignTitle", { count })} className="task-assign-panel task-bulk-panel">
        <p className="task-popover-title">{t("bulkAssignTitle", { count })}</p>
        <ul className="task-popover-choices">
          {[...members, { value: "clients", label: t("bulkClientsEach", { clients: clientsLabel }), initials: "" }, ...eventVendors].map((option, index) => (
            <li key={option.value}>
              <button type="button" className="task-popover-choice" disabled={pending} {...(index === 0 ? { "data-autofocus": true } : {})} onClick={() => run(() => bulkAssignAction(ids, option.value), option.value.startsWith("vendor:") ? (result) => (result.previous ? () => bulkRestoreAssignAction(result.previous!) : null) : viaSnapshot, assign.close)}>
                {option.initials ? (
                  <span className="task-avatar" aria-hidden="true">
                    {option.initials}
                  </span>
                ) : null}
                <span>{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
        {singleEvent ? null : <p className="task-popover-hint">{t("bulkVendorOneEvent")}</p>}
      </TaskPopover>

      <TaskPopover handle={category} label={t("bulkCategoryTitle", { count })} className="task-bulk-panel">
        <p className="task-popover-title">{t("bulkCategoryTitle", { count })}</p>
        <ul className="task-popover-choices">
          {[...categories, { value: "", label: tLine("noCategory") }].map((option, index) => (
            <li key={option.value || "none"}>
              <button type="button" className="task-popover-choice" disabled={pending} {...(index === 0 ? { "data-autofocus": true } : {})} onClick={() => run(() => bulkCategoryAction(ids, option.value || null), (result) => (result.previous ? () => bulkRestoreCategoriesAction(result.previous!) : null), category.close)}>
                <span>{option.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </TaskPopover>

      <TaskPopover handle={more} label={t("bulkMore")} className="task-menu">
        <div role="menu" aria-label={t("bulkMore")}>
          <button
            type="button"
            role="menuitem"
            className="task-bulk-narrow"
            data-autofocus
            onClick={() => {
              more.close();
              category.open(moreButton.current);
            }}
          >
            <span>{t("bulkCategory")}</span>
          </button>
          <button type="button" role="menuitem" className="task-menu-danger" disabled={pending} onClick={() => run(() => bulkDeleteAction(ids), null, more.close)}>
            <span>{t("bulkDelete", { count })}</span>
            <span className="task-menu-hint">{tLine("deleteHint")}</span>
          </button>
        </div>
      </TaskPopover>
      <span className="sr-only">{t("bulkAvailable", { count: available })}</span>
    </div>
  );
}

export function TaskLineBoard({
  groups,
  form,
  label,
  shortcuts,
  assignOptions,
  categories,
  members,
  clientsLabel,
  summary,
  tools,
  doneColumns = false,
}: {
  groups: TaskLineGroup[];
  form: TaskLineForm;
  label: string;
  shortcuts: DateShortcutOption[];
  assignOptions: Record<string, AssignOption[]>;
  categories: Option[];
  // « Vous » et les collègues, pour « Confier à… » en lot.
  members: AssignOption[];
  // Le mot des clients (« Les mariés »).
  clientsLabel: string;
  // Le décompte, à gauche de la ligne d'outils ; en mode sélection, il reste en place.
  summary?: ReactNode;
  // « Grouper par », « Liste / Calendrier » : masqués en mode sélection.
  tools?: ReactNode;
  doneColumns?: boolean;
}) {
  const t = useTranslations("TaskLine");
  const tScreen = useTranslations("TaskScreen");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const lines = useMemo(() => groups.flatMap((group) => group.lines), [groups]);
  // Les lignes qui disparaissent (faites, supprimées, filtrées) quittent la sélection.
  const shown = lines.filter((line) => selected.has(line.id));
  const end = useCallback(() => {
    setSelecting(false);
    setSelected(new Set());
  }, []);
  useEffect(() => {
    if (!selecting) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector(":popover-open, dialog[open]")) end();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selecting, end]);
  const toggle = (id: string) =>
    setSelected((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  // Les prestataires retenus de chaque évènement (ceux qui ne sont ni un membre ni les clients).
  const vendors = useMemo(() => Object.fromEntries(Object.entries(assignOptions).map(([eventId, options]) => [eventId, options.filter((option) => option.value.startsWith("vendor:"))])), [assignOptions]);
  return (
    <div className="task-board" data-selecting={selecting ? "true" : undefined}>
      <div className="task-board-tools">
        <div className="task-board-summary">{summary}</div>
        {selecting ? (
          <div className="task-board-select">
            <button type="button" className="button-ghost" onClick={() => setSelected(new Set(lines.map((line) => line.id)))}>
              {tScreen("selectAll", { count: lines.length })}
            </button>
            <button type="button" className="button-ghost" onClick={end}>
              {t("selectEnd")}
            </button>
          </div>
        ) : (
          <div className="task-board-options">
            {tools}
            {lines.length > 0 ? (
              <button type="button" className="button-ghost task-select-button" data-tour="tasks-select" onClick={() => setSelecting(true)}>
                {t("select")}
              </button>
            ) : null}
          </div>
        )}
      </div>
      <TaskLineList groups={groups} form={form} label={label} shortcuts={shortcuts} assignOptions={assignOptions} selecting={selecting} selected={selected} onToggle={toggle} doneColumns={doneColumns} />
      {selecting ? (
        <BulkBar
          ids={shown.map((line) => line.id)}
          eventIds={shown.map((line) => line.eventId ?? "none")}
          available={lines.length}
          categories={categories}
          members={members}
          clientsLabel={clientsLabel}
          vendors={vendors}
          onEnd={end}
        />
      ) : null}
    </div>
  );
}
