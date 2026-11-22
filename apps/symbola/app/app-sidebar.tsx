"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { sidebarCollapsedCookie } from "./sidebar-preference";

// Menu latéral : toujours visible sur ordinateur ; replié derrière un
// bouton « Menu » sur téléphone (charte, lot 7), pour que le contenu de
// l'écran reste en haut. Il se replie après chaque changement de page.
// admin : menu sombre de la console d'Administration (lot 13, L13-HUB-17) — on sait
// tout de suite qu'on n'est pas dans l'espace d'une organisation.
// Lot 65f : sur ordinateur, « Réduire le menu » ne garde que les icônes, leur nom en infobulle ; le
// contenu prend la place libérée. Le choix est retenu sur l'appareil (sidebar-preference.ts) et lu
// par le serveur (initialCollapsed) : le menu s'affiche d'emblée dans le bon état. Le bouton ne porte
// pas aria-controls : celui-ci désigne le bouton « Menu » du téléphone (e2e/helpers.ts).

/** Ce qui porte une infobulle : un lien ou un bouton du menu qui a un nom à montrer. */
const TIP_OWNER = "a, button";
const TIP_TEXT = ".app-tip, .app-nav-label";
const TIP_OPEN = "data-tip-open";

export function AppSidebar({
  brand,
  menuLabel,
  closeLabel,
  collapseLabel,
  expandLabel,
  initialCollapsed = false,
  admin = false,
  children,
}: {
  brand: ReactNode;
  menuLabel: string;
  closeLabel: string;
  collapseLabel: string;
  expandLabel: string;
  initialCollapsed?: boolean;
  admin?: boolean;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const asideRef = useRef<HTMLElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Une seule infobulle ouverte, celle du dernier lien survolé ou atteint au clavier. Sa place est
  // mesurée à l'ouverture (variables CSS posées par le CSSOM, que la CSP admet) : à droite du menu, à
  // la hauteur du lien ; elle suit le lien quand le menu défile. Elle se ferme à la sortie du menu et
  // sur Échap (WCAG 1.4.13) ; elle reste ouverte quand la souris passe dessus.
  function hideTip() {
    asideRef.current?.querySelectorAll(`[${TIP_OPEN}]`).forEach((element) => element.removeAttribute(TIP_OPEN));
  }
  function showTip(target: EventTarget | null) {
    const aside = asideRef.current;
    const owner = target instanceof Element ? target.closest<HTMLElement>(TIP_OWNER) : null;
    if (!aside || !owner || !aside.contains(owner) || !owner.querySelector(TIP_TEXT)) return;
    if (owner.hasAttribute(TIP_OPEN)) return;
    hideTip();
    owner.setAttribute(TIP_OPEN, "");
    placeTip();
  }
  function placeTip() {
    const aside = asideRef.current;
    const owner = aside?.querySelector(`[${TIP_OPEN}]`);
    if (!aside || !owner) return;
    const box = owner.getBoundingClientRect();
    aside.style.setProperty("--tip-top", `${box.top + box.height / 2}px`);
    aside.style.setProperty("--tip-left", `${aside.getBoundingClientRect().right + 8}px`);
  }

  const toggleLabel = collapsed ? expandLabel : collapseLabel;
  const ToggleIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  return (
    <aside
      ref={asideRef}
      className={`app-sidebar${admin ? " app-sidebar-admin" : ""}${open ? " is-open" : ""}${collapsed ? " is-collapsed" : ""}`}
      onPointerOver={(event) => showTip(event.target)}
      onPointerLeave={hideTip}
      onFocus={(event) => {
        if (event.target instanceof Element && event.target.matches(":focus-visible")) showTip(event.target);
      }}
      onBlur={(event) => {
        if (!(event.relatedTarget instanceof Node && event.currentTarget.contains(event.relatedTarget))) hideTip();
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") hideTip();
      }}
      onScroll={placeTip}
    >
      <div className="app-sidebar-header">
        {brand}
        <button type="button" className="app-menu-toggle" aria-expanded={open} aria-controls="app-menu" onClick={() => setOpen((value) => !value)}>
          {open ? closeLabel : menuLabel}
        </button>
        <button
          type="button"
          className="app-sidebar-collapse"
          aria-expanded={!collapsed}
          aria-label={toggleLabel}
          onClick={() => {
            const next = !collapsed;
            hideTip();
            setCollapsed(next);
            document.cookie = sidebarCollapsedCookie(next);
          }}
        >
          <ToggleIcon size={20} aria-hidden="true" strokeWidth={1.5} />
          <span className="app-tip" aria-hidden="true">
            {toggleLabel}
          </span>
        </button>
      </div>
      <div id="app-menu" className="app-collapsible">
        {children}
      </div>
    </aside>
  );
}
