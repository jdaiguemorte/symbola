"use client";

// Lot 72d (EVT-02, UX-05 ; C-23, C-80, C-82 ; E3, J11 ; page 15 des maquettes du lot 68) — les onglets de la
// fiche d'un évènement. Tous visibles, l'ouvert en gras et souligné (`aria-selected`), chacun avec son nombre
// utile (« 6 sur 9 », « 2 en retard » en rouge). À l'ordinateur, ce qui ne tient pas dans la largeur (mesurée
// à l'affichage, pas un point de rupture fixe) passe dans « Plus ▾ », l'onglet ouvert restant visible. En
// défilant, la barre des onglets reste collée sous la barre du haut et, quand l'en-tête est sorti de
// l'écran, une barre fine au-dessus garde le nom, la date, le statut et le menu « ⋯ » (pas l'action).
// Changer d'onglet garde cette barre en place au lieu de renvoyer en haut de la page. Sur téléphone, la
// barre défile de côté, seule, avec une flèche de 44 px, et l'onglet ouvert est amené dans le cadre.
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import { TaskPopover, usePopover } from "@/app/ui/task-popover";
import { EventMenuButton } from "./event-commands";

export type EventTab = {
  key: string;
  label: string;
  // Sur téléphone seulement (« Budget », « Devis ») ; les nombres restent.
  short?: string;
  href: string;
  count?: { text: string; short: string; alert: boolean };
};

const PHONE = "(max-width: 767px)";
const MORE_WIDTH = 96;

function TabContent({ tab }: { tab: EventTab }) {
  return (
    <>
      <span className={tab.short ? "event-tab-long" : undefined}>{tab.label}</span>
      {tab.short ? <span className="event-tab-short">{tab.short}</span> : null}
      {tab.count ? (
        <span className={tab.count.alert ? "event-tab-count event-tab-count-alert" : "event-tab-count"}>
          {tab.count.alert ? (
            <span className="event-tab-count-mark" aria-hidden="true">
              !
            </span>
          ) : null}
          <span className="event-tab-long">{tab.count.text}</span>
          <span className="event-tab-short">{tab.count.short}</span>
        </span>
      ) : null}
    </>
  );
}

export function EventTabs({ tabs, current, panelId, summary }: { tabs: EventTab[]; current: string; panelId: string; summary: { names: string; date: string; status: string } }) {
  const t = useTranslations("EventHeader");
  const bar = useRef<HTMLDivElement>(null);
  const nav = useRef<HTMLElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const widths = useRef(new Map<string, number>());
  const [overflow, setOverflow] = useState<string[]>([]);
  const [stuck, setStuck] = useState(false);
  const [canScroll, setCanScroll] = useState(false);
  const wasStuck = useRef(false);
  const more = usePopover();
  const moreButton = useRef<HTMLButtonElement>(null);

  // La place des onglets : mesurée à l'affichage. Les largeurs se gardent (un onglet rangé dans « Plus » n'a
  // plus de largeur à lire) ; l'onglet ouvert reste toujours dans la barre.
  const layout = useCallback(() => {
    const element = nav.current;
    const tablist = list.current;
    if (!element || !tablist) return;
    for (const tab of tablist.querySelectorAll<HTMLElement>("[role=tab]")) if (tab.offsetWidth > 0) widths.current.set(tab.dataset.key!, tab.offsetWidth);
    if (window.matchMedia(PHONE).matches) {
      setOverflow((before) => (before.length ? [] : before));
      setCanScroll(tablist.scrollLeft + tablist.clientWidth < tablist.scrollWidth - 1);
      return;
    }
    const available = element.clientWidth;
    const width = (key: string) => widths.current.get(key) ?? 0;
    const total = tabs.reduce((sum, tab) => sum + width(tab.key), 0);
    if (total <= available) {
      setOverflow((before) => (before.length ? [] : before));
      return;
    }
    const room = available - MORE_WIDTH;
    const kept: string[] = [];
    let used = 0;
    for (const tab of tabs) {
      if (used + width(tab.key) > room) break;
      kept.push(tab.key);
      used += width(tab.key);
    }
    if (!kept.includes(current)) {
      while (kept.length > 0 && used + width(current) > room) used -= width(kept.pop()!);
      kept.push(current);
    }
    const hidden = tabs.map((tab) => tab.key).filter((key) => !kept.includes(key));
    setOverflow((before) => (before.join() === hidden.join() ? before : hidden));
  }, [tabs, current]);

  useLayoutEffect(() => {
    layout();
    const observer = new ResizeObserver(layout);
    if (nav.current) observer.observe(nav.current);
    return () => observer.disconnect();
  }, [layout]);

  // La barre fine : quand l'en-tête est sorti de l'écran (sous la barre du haut).
  useEffect(() => {
    const update = () => {
      const element = bar.current;
      const header = document.getElementById("event-header");
      if (!element || !header) return;
      const top = parseFloat(getComputedStyle(element).top) || 0;
      setStuck(header.getBoundingClientRect().bottom <= top + 1);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", update);
    };
  }, []);

  // Changer d'onglet : la barre reste en place (le contenu repart juste dessous) si elle était collée ; sur
  // téléphone, l'onglet ouvert est amené dans le cadre de la barre, sans faire défiler la page.
  useEffect(() => {
    const element = bar.current;
    const header = document.getElementById("event-header");
    if (wasStuck.current && element && header) {
      const top = parseFloat(getComputedStyle(element).top) || 0;
      window.scrollTo({ top: header.getBoundingClientRect().bottom + window.scrollY - top });
    }
    wasStuck.current = false;
    const tablist = list.current;
    const active = tablist?.querySelector<HTMLElement>("[aria-selected=true]");
    if (tablist && active && tablist.scrollWidth > tablist.clientWidth) {
      // Amené entier dans le cadre de la barre, avec un peu d'air (la flèche est à côté, pas dessus).
      const frame = tablist.getBoundingClientRect();
      const box = active.getBoundingClientRect();
      if (box.right > frame.right) tablist.scrollLeft += box.right - frame.right + 16;
      else if (box.left < frame.left) tablist.scrollLeft -= frame.left - box.left + 16;
    }
    layout();
  }, [current, layout]);

  // Les flèches passent d'un onglet à l'autre ; Début et Fin, au premier et au dernier (motif des onglets).
  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const keys = ["ArrowRight", "ArrowLeft", "Home", "End"];
    if (!keys.includes(event.key)) return;
    const items = [...event.currentTarget.querySelectorAll<HTMLElement>("[role=tab]")].filter((item) => item.offsetParent !== null);
    const index = items.indexOf(document.activeElement as HTMLElement);
    const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowRight" ? 1 : items.length - 1)) % items.length;
    items[next]?.focus();
    event.preventDefault();
  };

  const remember = () => {
    wasStuck.current = stuck;
    more.close();
  };
  const hidden = new Set(overflow);

  return (
    <div ref={bar} className="event-tabbar" data-stuck={stuck ? "true" : undefined}>
      <div className="event-tabbar-summary">
        <strong className="event-tabbar-names">{summary.names}</strong>
        <span className="event-tabbar-facts">
          {summary.date} · {summary.status}
        </span>
        <EventMenuButton />
      </div>
      <nav ref={nav} aria-label={t("tabsLabel")} className="event-tabs-nav" data-tour="event-tabs">
        <div
          ref={list}
          role="tablist"
          aria-label={t("tabsLabel")}
          className="event-tabs"
          onKeyDown={onKeyDown}
          onScroll={(event) => setCanScroll(event.currentTarget.scrollLeft + event.currentTarget.clientWidth < event.currentTarget.scrollWidth - 1)}
        >
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              id={`event-tab-${tab.key}`}
              data-key={tab.key}
              role="tab"
              aria-selected={tab.key === current}
              aria-controls={tab.key === current ? panelId : undefined}
              tabIndex={tab.key === current ? 0 : -1}
              href={tab.href}
              scroll={false}
              className={hidden.has(tab.key) ? "event-tab event-tab-overflow" : "event-tab"}
              data-tour={`tab-${tab.key}`}
              onClick={remember}
            >
              <TabContent tab={tab} />
            </Link>
          ))}
        </div>
        {overflow.length > 0 ? (
          <>
            <button ref={moreButton} type="button" className="event-tabs-more" aria-haspopup="menu" aria-label={t("moreLabel")} onClick={() => more.open(moreButton.current)}>
              {t("more")} <span aria-hidden="true">▾</span>
            </button>
            <TaskPopover handle={more} label={t("moreLabel")} className="task-menu">
              <div role="menu" aria-label={t("moreLabel")}>
                {tabs
                  .filter((tab) => hidden.has(tab.key))
                  .map((tab) => (
                    <Link key={tab.key} role="menuitem" href={tab.href} scroll={false} onClick={remember}>
                      <span>
                        {tab.label}
                        {tab.count ? <span className={tab.count.alert ? "event-tab-count event-tab-count-alert" : "event-tab-count"}>{tab.count.text}</span> : null}
                      </span>
                    </Link>
                  ))}
              </div>
            </TaskPopover>
          </>
        ) : null}
        <button
          type="button"
          className="event-tabs-scroll"
          aria-label={t("scrollTabs")}
          hidden={!canScroll}
          onClick={() => list.current?.scrollBy({ left: Math.round((list.current?.clientWidth ?? 200) * 0.7), behavior: "smooth" })}
        >
          <span aria-hidden="true">›</span>
        </button>
      </nav>
    </div>
  );
}
