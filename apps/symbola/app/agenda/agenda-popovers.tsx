"use client";

// Lot 12 (HUB-13), correctif de recette — menus des dates de l'agenda
// (créer à cette date, plusieurs événements le même week-end) : un seul
// ouvert à la fois, fermé par un clic ailleurs ou par Échap (le focus revient
// alors sur la date).
import { useEffect } from "react";

const SELECTOR = "details.agenda-create, details.agenda-multi";

export function AgendaPopovers({ containerId }: { containerId: string }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const openMenus = () => Array.from(container.querySelectorAll<HTMLDetailsElement>(`${SELECTOR}[open]`));

    // « toggle » ne remonte pas : on l'écoute en phase de capture.
    const onToggle = (event: Event) => {
      const target = event.target;
      if (!(target instanceof HTMLDetailsElement) || !target.matches(SELECTOR) || !target.open) return;
      for (const other of openMenus()) if (other !== target) other.open = false;
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node | null;
      for (const menu of openMenus()) if (!target || !menu.contains(target)) menu.open = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      for (const menu of openMenus()) {
        menu.open = false;
        menu.querySelector("summary")?.focus();
      }
    };

    container.addEventListener("toggle", onToggle, true);
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      container.removeEventListener("toggle", onToggle, true);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [containerId]);
  return null;
}
