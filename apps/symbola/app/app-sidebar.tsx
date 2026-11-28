"use client";

import { Ellipsis, PanelLeftClose, PanelLeftOpen } from "lucide-react";
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
// Lot 70f (UX-05 ; D4, C-84 ; page 3 des maquettes du lot 68) : avec `tabs` (l'équipe), plus de bouton
// « Menu » sur téléphone. Une barre du bas porte quatre entrées et « Plus » ; « Plus » ouvre ce même menu
// en panneau du bas, posé au-dessus de la barre (il ne pousse pas la page), sans les entrées déjà dans la
// barre, avec le compte (`account`) et « Se déconnecter » en dernier. Il se ferme par Échap (le focus
// revient sur « Plus »), un clic dehors, un glissé vers le bas et le retour arrière : son ouverture pose
// une entrée d'historique (même adresse) ; une entrée choisie dans le panneau lui ôte sa marque avant
// d'ouvrir son écran, et le retour arrière depuis cet écran ramène à celui d'avant, « Plus » fermé. « Plus » garde aria-controls="app-menu" : les aides de test
// l'ouvrent comme l'ancien bouton (e2e/helpers.ts). L'Administration et le Comptable gardent « Menu ».

/** Ce qui porte une infobulle : un lien ou un bouton du menu qui a un nom à montrer. */
const TIP_OWNER = "a, button";
const TIP_TEXT = ".app-tip, .app-nav-label";
const TIP_OPEN = "data-tip-open";
/** L'entrée d'historique posée par l'ouverture de « Plus ». */
const SHEET_STATE = "symbolaMoreSheet";
/** Un glissé vers le bas de plus de 64 px ferme « Plus ». */
const SWIPE_CLOSE = 64;

function sheetEntryOnTop(): boolean {
  const state: unknown = window.history.state;
  return typeof state === "object" && state !== null && (state as Record<string, unknown>)[SHEET_STATE] === true;
}

export function AppSidebar({
  brand,
  menuLabel,
  closeLabel,
  collapseLabel,
  expandLabel,
  initialCollapsed = false,
  admin = false,
  tabs,
  tabsLabel,
  moreLabel,
  account,
  children,
}: {
  brand: ReactNode;
  menuLabel: string;
  closeLabel: string;
  collapseLabel: string;
  expandLabel: string;
  initialCollapsed?: boolean;
  admin?: boolean;
  // Lot 70f : les entrées de la barre du bas (des <li>), son nom et celui de « Plus » ; le compte, en bas
  // du panneau « Plus » (téléphone seulement).
  tabs?: ReactNode;
  tabsLabel?: string;
  moreLabel?: string;
  account?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const asideRef = useRef<HTMLElement>(null);
  const moreRef = useRef<HTMLButtonElement>(null);
  const tabbarRef = useRef<HTMLElement>(null);
  const swipe = useRef<{ id: number; y: number; dy: number } | null>(null);
  const pathname = usePathname();
  const sheet = tabs !== undefined;
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // « Plus » ouvert : l'entrée d'historique (le retour arrière le ferme), le focus sur sa première
  // entrée, Échap et un clic dehors.
  useEffect(() => {
    if (!sheet || !open) return;
    if (!sheetEntryOnTop()) window.history.pushState({ ...(window.history.state as object | null), [SHEET_STATE]: true }, "");
    const first = [...(asideRef.current?.querySelectorAll<HTMLElement>("a, button, summary") ?? [])].find((element) => element.getClientRects().length > 0);
    first?.focus();
    const onPop = () => {
      if (!sheetEntryOnTop()) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      close();
      moreRef.current?.focus();
    };
    const onPointer = (event: PointerEvent) => {
      const target = event.target as Node;
      if (asideRef.current?.contains(target) || tabbarRef.current?.contains(target)) return;
      close();
    };
    window.addEventListener("popstate", onPop);
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onPointer);
    return () => {
      window.removeEventListener("popstate", onPop);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onPointer);
    };
    // `close` ne lit que des références et l'historique.
  }, [sheet, open]);

  // Fermer « Plus » : retirer son entrée d'historique (le retour arrière la ferme ensuite), sinon fermer.
  function close() {
    if (sheetEntryOnTop()) window.history.back();
    else setOpen(false);
  }

  // Une entrée choisie dans « Plus » ou dans la barre, « Plus » ouvert : son entrée d'historique perd sa
  // marque avant que l'écran ne s'ouvre ; le retour arrière depuis cet écran ramène à celui d'avant, sans
  // rouvrir « Plus ». « Plus » se ferme aussi quand l'entrée est l'écran ouvert (l'adresse ne change pas).
  function onNavigateCapture(event: React.MouseEvent) {
    if (!sheet || !open) return;
    if (!(event.target as Element).closest("a[href]")) return;
    if (sheetEntryOnTop()) {
      const state = { ...(window.history.state as Record<string, unknown>) };
      delete state[SHEET_STATE];
      window.history.replaceState(state, "");
    }
    setOpen(false);
  }

  // Le glissé vers le bas, au doigt, quand le panneau n'a pas défilé.
  function onSheetPointerDown(event: React.PointerEvent<HTMLElement>) {
    if (!sheet || !open || event.pointerType === "mouse" || (asideRef.current?.scrollTop ?? 0) > 0) return;
    swipe.current = { id: event.pointerId, y: event.clientY, dy: 0 };
  }
  function onSheetPointerMove(event: React.PointerEvent<HTMLElement>) {
    if (!swipe.current || swipe.current.id !== event.pointerId) return;
    swipe.current.dy = Math.max(0, event.clientY - swipe.current.y);
    asideRef.current?.style.setProperty("--sheet-drag", `${swipe.current.dy}px`);
  }
  function onSheetPointerUp(event: React.PointerEvent<HTMLElement>) {
    if (!swipe.current || swipe.current.id !== event.pointerId) return;
    const dy = Math.max(swipe.current.dy, event.clientY - swipe.current.y);
    swipe.current = null;
    asideRef.current?.style.removeProperty("--sheet-drag");
    if (dy > SWIPE_CLOSE) close();
  }

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
  const aside = (
    <aside
      ref={asideRef}
      className={`app-sidebar${admin ? " app-sidebar-admin" : ""}${open ? " is-open" : ""}${collapsed ? " is-collapsed" : ""}${sheet ? " has-tabbar" : ""}`}
      onClickCapture={onNavigateCapture}
      onPointerDown={onSheetPointerDown}
      onPointerMove={onSheetPointerMove}
      onPointerUp={onSheetPointerUp}
      onPointerCancel={onSheetPointerUp}
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
      onScrollCapture={placeTip}
    >
      <div className="app-sidebar-header">
        {brand}
        {sheet ? null : (
          <button type="button" className="app-menu-toggle" aria-expanded={open} aria-controls="app-menu" onClick={() => setOpen((value) => !value)}>
            {open ? closeLabel : menuLabel}
          </button>
        )}
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
        {sheet ? <span className="app-sheet-grab" aria-hidden="true" /> : null}
        {children}
        {account ? <div className="app-sheet-account">{account}</div> : null}
      </div>
    </aside>
  );
  if (!sheet) return aside;
  return (
    <>
      {aside}
      {open ? <div className="app-sheet-backdrop" aria-hidden="true" /> : null}
      <nav ref={tabbarRef} className="app-tabbar" aria-label={tabsLabel} onClickCapture={onNavigateCapture}>
        <ul>
          {tabs}
          <li>
            <button ref={moreRef} type="button" className="app-tabbar-more" aria-expanded={open} aria-controls="app-menu" onClick={() => (open ? close() : setOpen(true))}>
              <Ellipsis size={22} aria-hidden="true" strokeWidth={1.75} />
              <span className="app-tabbar-label">{moreLabel}</span>
            </button>
          </li>
        </ul>
      </nav>
    </>
  );
}
