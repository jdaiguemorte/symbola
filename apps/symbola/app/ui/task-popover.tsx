"use client";

// Lot 70c (CHR-02, UX-07, UX-14 ; C-36, C-40 ; page 2 des maquettes du lot 68) — les petits panneaux d'une
// tâche : son menu « ⋯ », « Changer la date », « Confier à ». Un panneau léger (attribut `popover` du
// navigateur) : Échap et un clic ailleurs le ferment sans rien changer, le focus y entre et revient au
// bouton qui l'a ouvert. Posé sous ce bouton à l'ordinateur ; sur téléphone, en panneau du bas de toute la
// largeur (feuille de style). Jamais de bouton plein dedans.
import { useCallback, useEffect, useId, useRef, type ReactNode, type RefObject } from "react";

export type PopoverHandle = { open: (anchor: HTMLElement | null) => void; close: () => void; id: string; ref: RefObject<HTMLDivElement | null> };

const GAP = 6;
const MARGIN = 8;

export function usePopover(): PopoverHandle {
  const id = useId().replace(/:/g, "");
  const ref = useRef<HTMLDivElement | null>(null);
  const anchorRef = useRef<HTMLElement | null>(null);

  const place = useCallback(() => {
    const element = ref.current;
    const anchor = anchorRef.current;
    if (!element || !anchor) return;
    // Sur téléphone, la feuille de style le pose en bas, de toute la largeur.
    if (window.matchMedia("(max-width: 639px)").matches) {
      element.style.removeProperty("top");
      element.style.removeProperty("left");
      return;
    }
    const box = anchor.getBoundingClientRect();
    const width = element.offsetWidth;
    const height = element.offsetHeight;
    const left = Math.min(Math.max(MARGIN, box.right - width), window.innerWidth - width - MARGIN);
    const below = box.bottom + GAP;
    const top = below + height > window.innerHeight - MARGIN && box.top - GAP - height > MARGIN ? box.top - GAP - height : below;
    element.style.top = `${Math.round(top)}px`;
    element.style.left = `${Math.round(left)}px`;
  }, []);

  const open = useCallback(
    (anchor: HTMLElement | null) => {
      const element = ref.current;
      if (!element) return;
      anchorRef.current = anchor;
      if (!element.matches(":popover-open")) element.showPopover();
      place();
      // Le premier choix reçoit le focus.
      element.querySelector<HTMLElement>("[data-autofocus], button, input, select, a")?.focus();
    },
    [place],
  );

  const close = useCallback(() => {
    const element = ref.current;
    if (element?.matches(":popover-open")) element.hidePopover();
  }, []);

  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    // Fermé (Échap, clic ailleurs, choix fait) : le focus revient au bouton d'origine s'il est encore là.
    const onToggle = (event: Event) => {
      if ((event as ToggleEvent).newState === "closed" && anchorRef.current?.isConnected && element.contains(document.activeElement)) anchorRef.current.focus();
    };
    element.addEventListener("toggle", onToggle);
    window.addEventListener("resize", place);
    return () => {
      element.removeEventListener("toggle", onToggle);
      window.removeEventListener("resize", place);
    };
  }, [place]);

  return { open, close, id, ref };
}

export function TaskPopover({ handle, label, className, children }: { handle: PopoverHandle; label: string; className?: string; children: ReactNode }) {
  return (
    <div ref={handle.ref} id={handle.id} popover="auto" className={`task-popover${className ? ` ${className}` : ""}`} role="dialog" aria-label={label}>
      {children}
    </div>
  );
}
