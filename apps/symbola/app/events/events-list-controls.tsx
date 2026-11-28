"use client";

// Lot 72f (EVT-07, UX-05, UX-13 ; C-29, C-81, G14 ; page 17 des maquettes du lot 68) — deux commandes de la
// liste des évènements, sur le modèle du carnet (lot 73b) :
// - le menu « ⋯ » de l'en-tête, à côté de « Nouvel évènement », son seul bouton plein : « Reprendre et
//   importer », puis la section « Réglages » et « Paramètres des évènements » ;
// - sur téléphone, les filtres repliés derrière « Filtres » (avec le nombre de filtres posés) : la période
//   reste visible, le reste s'ouvre en panneau du bas, qui finit par « Voir les N évènements ».
// Les textes arrivent en propriétés (espace « EventsList », gardé côté serveur : NFR-02).
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { TaskPopover, usePopover } from "@/app/ui/task-popover";

// Sur téléphone, où la bascule des vues n'a pas sa place, les autres vues passent en tête du menu.
export function EventsHeaderMenu({ label, views, importHref, importLabel, section, settingsHref, settingsLabel }: { label: string; views: { href: string; label: string }[]; importHref: string; importLabel: string; section: string; settingsHref: string; settingsLabel: string }) {
  const menu = usePopover();
  const button = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={button} type="button" className="task-menu-button vendor-header-menu" aria-haspopup="menu" aria-controls={menu.id} aria-label={label} onClick={() => menu.open(button.current)}>
        <span aria-hidden="true">⋯</span>
      </button>
      <TaskPopover handle={menu} label={label} className="task-menu">
        <div role="menu" aria-label={label}>
          {views.map((view) => (
            <Link key={view.href} role="menuitem" href={view.href} className="vendor-menu-phone" onClick={() => menu.close()}>
              <span>{view.label}</span>
            </Link>
          ))}
          <Link role="menuitem" href={importHref} data-autofocus onClick={() => menu.close()}>
            <span>{importLabel}</span>
          </Link>
          <hr className="task-menu-separator" />
          <p className="task-menu-section">{section}</p>
          <Link role="menuitem" href={settingsHref} scroll={false} onClick={() => menu.close()}>
            <span>{settingsLabel}</span>
          </Link>
        </div>
      </TaskPopover>
    </>
  );
}

export function EventsFiltersPanel({ button, title, done, clear, children }: { button: string; title: string; done: string; clear: { href: string; label: string } | null; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="events-filters book-filters" data-open={open ? "true" : undefined}>
      <div className="book-filters-sheet">
        <div className="book-filters-sheet-head">
          <h2>{title}</h2>
          {clear ? (
            <Link href={clear.href} className="button-link" onClick={() => setOpen(false)}>
              {clear.label}
            </Link>
          ) : null}
        </div>
        {children}
        <button type="button" className="button-primary book-filters-done" onClick={() => setOpen(false)}>
          {done}
        </button>
      </div>
      <button type="button" className="button-secondary events-filters-open" aria-expanded={open} onClick={() => setOpen(true)}>
        {button}
      </button>
    </div>
  );
}
