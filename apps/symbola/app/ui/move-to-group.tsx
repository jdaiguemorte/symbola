"use client";

// Socle des lots 44 et 50 (D0 ; UX-14, NFR-17, critères de CRM-02 et INV-05) — déplacer un élément
// vers un groupe : une carte vers une étape du pipeline (lot 44), un invité vers une table (lot 50).
// Trois voies pour le même geste :
// - le bouton « Déplacer » ouvre la liste des groupes : clavier, lecteur d'écran et doigt (le
//   glisser-déposer HTML ne marche pas au doigt) ;
// - le glisser-déposer HTML à la souris ;
// - Échap referme la liste et rend le focus au bouton.
// Chaque déplacement est annoncé (role="status") ; le focus suit l'élément dans son nouveau groupe.
// Le serveur fait foi : un refus ramène l'état enregistré. Aucune dépendance (modèle de
// sortable-budget-lines.tsx, lot 13).
//
// Emploi : le consommateur marque chaque élément de `data-move-item={id}`, place le bouton
// <MoveToGroupButton> dedans, étale `dragProps(id)` sur l'élément et `dropProps(groupId)` sur
// chaque groupe, et affiche <MoveAnnouncement>.
import { useEffect, useId, useRef, useState, type DragEvent } from "react";
import { useTranslations } from "next-intl";
import {
  assignmentSignature,
  createSerialQueue,
  itemsInGroup,
  moveAssignment,
  toAssignment,
  type MovableItem,
  type MoveTarget,
} from "./move-to-group-state";

export type { MovableItem, MoveTarget } from "./move-to-group-state";

const DRAG_TYPE = "application/x-symbola-move";

export function useMoveToGroup<T extends MovableItem>({
  items,
  targets,
  onMove,
}: {
  items: readonly T[];
  targets: readonly MoveTarget[];
  // Action serveur : true si le déplacement est enregistré, false s'il est refusé.
  onMove: (itemId: string, groupId: string) => Promise<boolean>;
}) {
  const t = useTranslations("MoveToGroup");
  const [assignment, setAssignment] = useState(() => toAssignment(items));
  const [announcement, setAnnouncement] = useState("");
  const [dragged, setDragged] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const queue = useRef(createSerialQueue());
  const serverItems = useRef(items);
  serverItems.current = items;

  // Données nouvelles du serveur : elles remplacent l'affectation locale, sauf pendant un
  // enregistrement (la page se rafraîchit ensuite).
  const signature = assignmentSignature(items);
  const [source, setSource] = useState(signature);
  if (source !== signature && queue.current.pending === 0) {
    setSource(signature);
    setAssignment(toAssignment(items));
  }

  function focusItem(itemId: string) {
    requestAnimationFrame(() => {
      const element = document.querySelector<HTMLElement>(`[data-move-item="${CSS.escape(itemId)}"] [data-move-button]`);
      element?.focus();
    });
  }

  function move(itemId: string, groupId: string) {
    const item = serverItems.current.find((candidate) => candidate.id === itemId);
    const target = targets.find((candidate) => candidate.id === groupId);
    if (!item || !target || assignment[itemId] === groupId) return;
    setAssignment((current) => moveAssignment(current, itemId, groupId));
    focusItem(itemId);
    void queue.current.run(async () => {
      const saved = await onMove(itemId, groupId).catch(() => false);
      if (!saved) setAssignment(toAssignment(serverItems.current));
      setAnnouncement(saved ? t("moved", { item: item.label, group: target.label }) : t("moveFailed", { item: item.label }));
    });
  }

  function dragProps(itemId: string) {
    return {
      draggable: true,
      "data-dragging": dragged === itemId ? "true" : undefined,
      onDragStart: (event: DragEvent<HTMLElement>) => {
        setDragged(itemId);
        event.dataTransfer.effectAllowed = "move";
        event.dataTransfer.setData(DRAG_TYPE, itemId);
      },
      onDragEnd: () => {
        setDragged(null);
        setOver(null);
      },
    };
  }

  function dropProps(groupId: string) {
    return {
      "data-drop-target": dragged && over === groupId ? "true" : undefined,
      onDragOver: (event: DragEvent<HTMLElement>) => {
        if (!dragged) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        if (over !== groupId) setOver(groupId);
      },
      onDragLeave: (event: DragEvent<HTMLElement>) => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setOver(null);
      },
      onDrop: (event: DragEvent<HTMLElement>) => {
        event.preventDefault();
        const itemId = event.dataTransfer.getData(DRAG_TYPE) || dragged;
        if (itemId) move(itemId, groupId);
        setDragged(null);
        setOver(null);
      },
    };
  }

  return {
    groupOf: (itemId: string) => assignment[itemId] ?? null,
    itemsIn: (groupId: string | null) => itemsInGroup(items, assignment, groupId),
    move,
    dragProps,
    dropProps,
    announcement,
  };
}

// Bouton « Déplacer » et liste des groupes (motif « divulgation » : un bouton qui montre une liste
// de boutons, plus simple et plus sûr au lecteur d'écran qu'un menu ARIA).
export function MoveToGroupButton({
  itemLabel,
  currentGroupId,
  targets,
  onChoose,
}: {
  itemLabel: string;
  currentGroupId: string | null;
  targets: readonly MoveTarget[];
  onChoose: (groupId: string) => void;
}) {
  const t = useTranslations("MoveToGroup");
  const [open, setOpen] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);
  const listId = useId();
  const choices = targets.filter((target) => target.id !== currentGroupId);

  useEffect(() => {
    if (open) list.current?.querySelector("button")?.focus();
  }, [open]);

  return (
    <div
      className="move-to-group"
      onKeyDown={(event) => {
        if (event.key === "Escape" && open) {
          event.preventDefault();
          setOpen(false);
          button.current?.focus();
        }
      }}
    >
      <button
        ref={button}
        type="button"
        className="button-ghost"
        data-move-button
        aria-expanded={open}
        aria-controls={listId}
        aria-label={t("moveItem", { item: itemLabel })}
        disabled={choices.length === 0}
        onClick={() => setOpen((value) => !value)}
      >
        {t("move")}
      </button>
      {open ? (
        <ul ref={list} id={listId} className="move-to-group-menu" aria-label={t("destinations", { item: itemLabel })}>
          {choices.map((target) => (
            <li key={target.id}>
              <button
                type="button"
                className="button-ghost"
                onClick={() => {
                  setOpen(false);
                  onChoose(target.id);
                }}
              >
                {target.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function MoveAnnouncement({ text }: { text: string }) {
  return (
    <p className="sr-only" role="status">
      {text}
    </p>
  );
}
