"use client";

// Lot 72b (HUB-08, UX-01 ; spécification du lot 72, § 5.2, critère 4 ; maquette 14 du lot 68, « Plus de sept
// points ») — la carte « À traiter en premier » et son « Tout afficher » : le reste des points est déjà dans la
// carte, caché ; le bouton l'ouvre sur place, sans recharger, et l'adresse garde « ?tout=1 » (rouverte, la
// carte est entière). Les nombres qui changent avec la carte (« 7 sur 11 » puis « 11 points ») se lisent dans
// le même contexte.
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const Expanded = createContext(false);

export function TodayCardFrame({ initiallyExpanded, rest, labelledBy, children, restLine }: { initiallyExpanded: boolean; rest: number; labelledBy: string; children: ReactNode; restLine: { text: string; button: string } }) {
  const [expanded, setExpanded] = useState(initiallyExpanded || rest === 0);
  const opened = useRef(false);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!opened.current) return;
    // La première ligne qui vient d'apparaître prend le focus : le clavier reprend là où la liste s'allonge.
    section.current?.querySelector<HTMLElement>("[data-rest] a, [data-rest] button")?.focus();
  }, [expanded]);
  const open = () => {
    opened.current = true;
    setExpanded(true);
    const url = new URL(window.location.href);
    url.searchParams.set("tout", "1");
    // `null` : Next.js reprend l'adresse dans son routeur (un rafraîchissement garde « ?tout=1 »).
    window.history.replaceState(null, "", `${url.pathname}${url.search}${url.hash}`);
  };
  return (
    <Expanded.Provider value={expanded}>
      <section ref={section} className="card today-first" aria-labelledby={labelledBy} data-tour="home-first" data-expanded={expanded ? "true" : "false"}>
        {children}
        {!expanded && rest > 0 ? (
          <p className="today-rest-line">
            <span>{restLine.text}</span>
            <button type="button" className="button-ghost today-show-all" onClick={open}>
              {restLine.button}
            </button>
          </p>
        ) : null}
      </section>
    </Expanded.Provider>
  );
}

// Un texte qui dépend de la carte : courte (« 4 sur 7 ») ou entière (« 7 »).
export function WhenExpanded({ collapsed, expanded }: { collapsed: string; expanded: string }) {
  return <>{useContext(Expanded) ? expanded : collapsed}</>;
}

// Critère 3 : « Fermer » rend la même ligne au même défilement. Sur téléphone, le panneau de la tâche prend la
// page entière (« ← Aujourd'hui ») et l'accueil perd sa position : elle est notée au clic sur un titre, et rendue
// quand le panneau se ferme. Rien n'est gardé au-delà de l'onglet (sessionStorage).
const SCROLL_KEY = "symbola:aujourdhui:defilement";

export function TodayScrollKeeper({ panelOpen }: { panelOpen: boolean }) {
  const wasOpen = useRef(panelOpen);
  useEffect(() => {
    const remember = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest(".today-first .task-title-link") : null;
      if (target) window.sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    };
    document.addEventListener("click", remember, true);
    return () => document.removeEventListener("click", remember, true);
  }, []);
  useEffect(() => {
    // Seulement quand le panneau vient de se fermer : une position notée puis abandonnée ne déplace pas l'écran.
    const closed = wasOpen.current && !panelOpen;
    wasOpen.current = panelOpen;
    if (!closed) return;
    const saved = window.sessionStorage.getItem(SCROLL_KEY);
    if (saved === null) return;
    window.sessionStorage.removeItem(SCROLL_KEY);
    const top = Number(saved);
    if (Number.isFinite(top) && Math.abs(window.scrollY - top) > 1) window.scrollTo({ top, behavior: "instant" });
  }, [panelOpen]);
  return null;
}
