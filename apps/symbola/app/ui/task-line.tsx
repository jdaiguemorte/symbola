"use client";

// Lot 70c (CHR-02, CHR-03, UX-05, UX-06, UX-14 ; D3, M3, M4, C-34, C-35, C-38, C-77, C-83 ; page 1 des
// maquettes du lot 68) — la ligne type d'une tâche, un composant pour ses quatre formes : « Tâches »
// (toutes les colonnes), l'onglet « Tâches » de la fiche (sans la colonne Évènement), « Aujourd'hui »
// (sans menu, le nom du mariage en lien séparé, M4) et le téléphone (la même ligne sur trois étages).
//
// Une seule cible, le titre, qui ouvre le panneau de la tâche ; une action rapide nommée, « Fait » ; un
// menu « ⋯ » pour le reste (« Changer la date… », « Confier à… », « Ouvrir l'évènement », puis, à part,
// « Supprimer »). L'état de l'échéance a un mot et une icône ; seul un vrai retard est rouge. Pas de case
// hors du mode « Sélectionner ».
import Link from "next/link";
import { useRef, useState, useTransition, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { lineParts, type TaskLineForm, type TaskLineView } from "@/lib/tasks/task-line";
import { deleteTaskAction } from "@/app/taches/task-row-actions";
import { TaskDoneButton } from "./task-done-button";
import { TaskDatePanel, type DateShortcutOption } from "./task-date-panel";
import { TaskAssignPanel, type AssignOption } from "./task-assign-panel";
import { TaskPopover, usePopover } from "./task-popover";

export type TaskLineGroup = { key: string; label: string; lines: TaskLineView[] };

function DueIcon({ icon }: { icon: "late" | "clock" | null }) {
  if (icon === "late") return <span className="task-state-icon" aria-hidden="true">!</span>;
  if (icon === "clock") return <span className="task-state-icon" aria-hidden="true">◷</span>;
  return null;
}

// Les flèches passent d'un choix du menu à l'autre (motif du menu de DESIGN.md).
function moveFocus(event: KeyboardEvent<HTMLElement>) {
  if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
  const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=menuitem]")];
  const index = items.indexOf(document.activeElement as HTMLElement);
  const next = items[(index + (event.key === "ArrowDown" ? 1 : items.length - 1)) % items.length];
  next?.focus();
  event.preventDefault();
}

function LineMenu({ line, shortcuts, assignOptions }: { line: TaskLineView; shortcuts: DateShortcutOption[]; assignOptions: AssignOption[] }) {
  const t = useTranslations("TaskLine");
  const router = useRouter();
  const menu = usePopover();
  const dates = usePopover();
  const assign = usePopover();
  const trigger = useRef<HTMLButtonElement>(null);
  const [pending, startTransition] = useTransition();
  const clients = assignOptions.find((option) => option.value === "clients")?.label ?? "";

  const remove = () =>
    startTransition(async () => {
      menu.close();
      const formData = new FormData();
      formData.set("taskId", line.id);
      // L'offre « Annuler » est posée par le serveur ; le message de retour la montre (lot 70b).
      await deleteTaskAction(formData);
      router.refresh();
    });

  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="task-menu-button"
        aria-haspopup="menu"
        aria-controls={menu.id}
        aria-label={t("menuLabel", { label: line.label })}
        onClick={() => menu.open(trigger.current)}
        disabled={pending}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      <TaskPopover handle={menu} label={t("menuLabel", { label: line.label })} className="task-menu">
        <div role="menu" aria-label={t("menuLabel", { label: line.label })} onKeyDown={moveFocus}>
          {line.done ? null : (
            <button
              type="button"
              role="menuitem"
              data-autofocus
              onClick={() => {
                menu.close();
                dates.open(trigger.current);
              }}
            >
              <span>{t("changeDate")}</span>
              <span className="task-menu-hint">{t("changeDateHint")}</span>
            </button>
          )}
          {line.done ? null : (
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                menu.close();
                assign.open(trigger.current);
              }}
            >
              <span>{t("assign")}</span>
              <span className="task-menu-hint">{t("assignHint", { clients: clients.toLocaleLowerCase() })}</span>
            </button>
          )}
          {line.event ? (
            <Link role="menuitem" href={line.event.href} onClick={() => menu.close()}>
              <span>{t("openEvent")}</span>
              <span className="task-menu-hint">{t("openEventHint", { event: line.event.names })}</span>
            </Link>
          ) : null}
          <hr className="task-menu-separator" />
          <button type="button" role="menuitem" className="task-menu-danger" onClick={remove} disabled={pending}>
            <span>{t("delete")}</span>
            <span className="task-menu-hint">{t("deleteHint")}</span>
          </button>
        </div>
      </TaskPopover>
      <TaskDatePanel handle={dates} task={{ id: line.id, label: line.label, dueDate: line.dueDate, dateLabel: line.dateLabel }} shortcuts={shortcuts} />
      <TaskAssignPanel handle={assign} task={{ id: line.id, label: line.label, responsibleValue: line.responsibleValue }} options={assignOptions} />
    </>
  );
}

export function TaskLine({
  line,
  form,
  shortcuts,
  assignOptions,
  selecting = false,
  selected = false,
  onSelect,
}: {
  line: TaskLineView;
  form: TaskLineForm;
  shortcuts: DateShortcutOption[];
  assignOptions: AssignOption[];
  selecting?: boolean;
  selected?: boolean;
  onSelect?: () => void;
}) {
  const t = useTranslations("TaskLine");
  const parts = lineParts(form);
  return (
    <li className="task-line" data-form={form} data-due={line.due?.kind ?? undefined} data-done={line.done ? "true" : undefined} data-selected={selected ? "true" : undefined}>
      {selecting ? (
        <label className="task-line-select">
          <input type="checkbox" checked={selected} onChange={onSelect} />
          <span className="sr-only">{t("selectTask", { label: line.label })}</span>
        </label>
      ) : null}
      <span className="task-line-title">
        <Link href={line.href} scroll={false} className="task-title-link">
          {line.label}
        </Link>
        {line.priority ? (
          <span className="task-priority">
            <span aria-hidden="true">↑ </span>
            {t("priority")}
          </span>
        ) : null}
      </span>
      {parts.eventColumn ? (
        <span className="task-line-event">
          {parts.eventLink && line.event ? (
            <Link href={line.event.href} className="task-event-link">
              {line.event.names}
            </Link>
          ) : (
            line.eventLabel
          )}
        </span>
      ) : null}
      <span className="task-line-due">
        <span className="task-line-date">{line.dateLabel}</span>
        {line.due ? (
          <span className="task-state" data-kind={line.due.kind}>
            <DueIcon icon={line.due.icon} />
            {line.due.text}
          </span>
        ) : null}
      </span>
      <span className="task-line-who">
        <span className="task-avatar" aria-hidden="true">
          {line.who.initials ?? "–"}
        </span>
        <span className="task-who-name">{line.who.name}</span>
      </span>
      {selecting ? null : (
        <span className="task-line-actions">
          <TaskDoneButton taskId={line.id} label={line.label} done={line.done} />
          {parts.menu ? <LineMenu line={line} shortcuts={shortcuts} assignOptions={assignOptions} /> : null}
        </span>
      )}
    </li>
  );
}

export function TaskLineList({
  groups,
  form,
  label,
  shortcuts,
  assignOptions,
  selecting = false,
  selected,
  onToggle,
}: {
  groups: TaskLineGroup[];
  form: TaskLineForm;
  label: string;
  shortcuts: DateShortcutOption[];
  // Par évènement (« none » : hors évènement) : les prestataires diffèrent d'un évènement à l'autre.
  assignOptions: Record<string, AssignOption[]>;
  selecting?: boolean;
  selected?: Set<string>;
  onToggle?: (id: string) => void;
}) {
  const t = useTranslations("TaskLine");
  const parts = lineParts(form);
  const [headId] = useState(() => `task-lines-${Math.random().toString(36).slice(2, 8)}`);
  return (
    <div className="task-lines" data-form={form}>
      {form === "today" ? null : (
        <div className="task-lines-head" aria-hidden="true" id={headId}>
          <span>{t("colTask")}</span>
          {parts.eventColumn ? <span>{t("colEvent")}</span> : null}
          <span>{t("colDue")}</span>
          <span>{t("colWho")}</span>
        </div>
      )}
      {groups.map((group) => (
        <div key={group.key} className="task-lines-group">
          {group.label ? (
            <h3 className="task-lines-month">
              {group.label} <span className="task-lines-count">{t("monthCount", { count: group.lines.length })}</span>
            </h3>
          ) : null}
          <ul className="task-lines-list" aria-label={group.label ? t("listLabel", { group: group.label }) : label}>
            {group.lines.map((line) => (
              <TaskLine
                key={line.id}
                line={line}
                form={form}
                shortcuts={shortcuts}
                assignOptions={assignOptions[line.eventId ?? "none"] ?? assignOptions.none ?? []}
                selecting={selecting}
                selected={selected?.has(line.id) ?? false}
                {...(onToggle ? { onSelect: () => onToggle(line.id) } : {})}
              />
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}
