"use client";

// Lot 63f (HUB-11 ; ADR 0104, qui remplace les repères de l'ADR 0033), revu au lot 74d (D2, B12, C-02 ;
// page 25 des maquettes du lot 68) — visite guidée d'un écran : le fond est assombri, la zone expliquée
// (attribut data-tour) reste claire, une bulle à côté dit « Visite de l'écran · N sur M », un titre, deux
// phrases, et propose « Précédent », « Suivant » (« Terminer » à la fin). Une croix « Fermer la visite »
// est là à chaque bulle (plus de « Passer la visite »). Une bulle dont la zone n'est pas à l'écran est
// sautée. Sur un écran tactile, le texte « touch » (« Touchez ») remplace le texte de la souris. La bulle
// est une fenêtre : le focus y entre, y reste (Tab), revient à son point de départ à la fermeture ;
// Échap ferme ; la page revient où elle était. Sur téléphone, la bulle se colle en bas et la zone
// encadrée reste visible au-dessus. Positions posées par le CSSOM (style.setProperty) : la CSP refuse
// les styles en ligne.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { placeTourBubble, visibleTourSteps } from "./tour-placement";

export type TourStep = {
  title: string;
  body: string;
  target?: string | undefined;
  // Lot 74d : le texte d'un écran tactile (« Touchez »).
  touch?: string | undefined;
};

export type TourLabels = {
  // Nom de la fenêtre, déjà traduit (« Visite : Aujourd'hui »).
  dialog: string;
  // « Visite de l'écran · 2 sur 3 », déjà traduit par l'appelant.
  progress: (number: number, total: number) => string;
  previous: string;
  next: string;
  finish: string;
  // La croix de chaque bulle (« Fermer la visite »).
  close: string;
};

export { placeTourBubble, visibleTourSteps, type Placement, type Rect } from "./tour-placement";

const MOBILE_QUERY = "(max-width: 767px)";
const TOUCH_QUERY = "(max-width: 767px), (pointer: coarse)";
const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';
// La barre du haut du téléphone (60 px) et un peu d'air : la zone ne passe pas dessous.
const PHONE_TOP = 72;

// La première zone de ce nom qui est à l'écran (une même zone peut exister en deux formes, l'une pour
// l'ordinateur, l'autre pour le téléphone).
function targetOf(target: string | undefined): HTMLElement | null {
  if (!target) return null;
  for (const element of document.querySelectorAll<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`)) {
    const rect = element.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && getComputedStyle(element).visibility !== "hidden") return element;
  }
  return null;
}

export function GuidedTour({
  open,
  steps,
  labels,
  onClose,
}: {
  open: boolean;
  steps: TourStep[];
  labels: TourLabels;
  // completed : arrivée au bout (« Terminer ») plutôt que fermée.
  onClose: (completed: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  // Les bulles montrées : celles dont la zone est à l'écran à l'ouverture.
  const [shown, setShown] = useState<TourStep[]>([]);
  const [touch, setTouch] = useState(false);
  const bubble = useRef<HTMLDivElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const scrollBack = useRef<number | null>(null);
  const titleId = useId();
  const bodyId = useId();

  const close = useCallback(
    (completed: boolean) => {
      onClose(completed);
      // La page revient où elle était ; le focus revient à son point de départ.
      const back = origin.current;
      const top = scrollBack.current;
      origin.current = null;
      scrollBack.current = null;
      if (top !== null) window.scrollTo({ top, behavior: "instant" });
      if (back && back.isConnected) window.setTimeout(() => back.focus({ preventScroll: true }), 0);
    },
    [onClose],
  );

  // Ouverture : on retient d'où vient le focus et où était la page, on garde les bulles dont la zone
  // est à l'écran, on repart de la première.
  useLayoutEffect(() => {
    if (!open) return;
    origin.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    scrollBack.current = window.scrollY;
    const visible = visibleTourSteps(steps, (target) => targetOf(target) !== null);
    setTouch(window.matchMedia(TOUCH_QUERY).matches);
    setShown(visible);
    setIndex(0);
    if (visible.length === 0) onClose(false);
  }, [open, steps, onClose]);

  const place = useCallback(() => {
    const box = bubble.current;
    const frame = spot.current;
    if (!box || !frame) return;
    const element = targetOf(shown[index]?.target);
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    box.dataset.layout = mobile ? "sheet" : "float";
    if (element) {
      const rect = element.getBoundingClientRect();
      const pad = 6;
      frame.dataset.hidden = "false";
      frame.style.setProperty("top", `${rect.top - pad}px`);
      frame.style.setProperty("left", `${rect.left - pad}px`);
      frame.style.setProperty("width", `${rect.width + pad * 2}px`);
      frame.style.setProperty("height", `${rect.height + pad * 2}px`);
    } else {
      frame.dataset.hidden = "true";
    }
    if (mobile) {
      box.style.removeProperty("top");
      box.style.removeProperty("left");
      return;
    }
    const rect = element?.getBoundingClientRect() ?? null;
    const placement = placeTourBubble(rect, { width: box.offsetWidth, height: box.offsetHeight }, { width: window.innerWidth, height: window.innerHeight });
    box.dataset.side = placement.side;
    box.style.setProperty("top", `${placement.top}px`);
    box.style.setProperty("left", `${placement.left}px`);
  }, [index, shown]);

  // La zone ramenée à l'écran : au centre à l'ordinateur ; sur téléphone, sous la barre du haut et
  // au-dessus de la bulle collée en bas quand elle y tient.
  const bringIntoView = useCallback((element: HTMLElement) => {
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    element.scrollIntoView({ block: mobile ? "start" : "center", inline: "nearest", behavior: "instant" });
    if (!mobile) return;
    const rect = element.getBoundingClientRect();
    const sheetTop = bubble.current?.getBoundingClientRect().top ?? window.innerHeight;
    const room = sheetTop - 8 - PHONE_TOP;
    const shift = rect.height <= room ? rect.top - PHONE_TOP - Math.max(0, (room - rect.height) / 2) : rect.top - PHONE_TOP;
    if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: "instant" });
  }, []);

  // Chaque bulle : sa zone ramenée à l'écran, puis la bulle posée et le focus dans la bulle. Un
  // défilement de la page juste après (fin de chargement, retour en haut) ne doit pas la laisser hors
  // de la fenêtre : on la ramène encore une fois quand l'écran s'est posé.
  useLayoutEffect(() => {
    if (!open || shown.length === 0) return;
    const element = targetOf(shown[index]?.target);
    if (element) bringIntoView(element);
    place();
    titleRef.current?.focus({ preventScroll: true });
    const again = window.setTimeout(() => {
      const current = targetOf(shown[index]?.target);
      if (!current) return;
      const rect = current.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
        bringIntoView(current);
        place();
      }
    }, 300);
    return () => window.clearTimeout(again);
  }, [open, index, shown, place, bringIntoView]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    const settle = window.setTimeout(schedule, 150);
    const resized = new ResizeObserver(schedule);
    resized.observe(document.body);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      resized.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [open, place]);

  // Échap ferme ; Tab reste dans la bulle (fenêtre modale).
  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close(false);
        return;
      }
      if (event.key !== "Tab" || !bubble.current) return;
      const items = [...bubble.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0]!;
      const last = items[items.length - 1]!;
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === titleRef.current || !bubble.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !bubble.current.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open, close]);

  if (!open || shown.length === 0) return null;
  const step = shown[Math.min(index, shown.length - 1)]!;
  const lastStep = index >= shown.length - 1;

  return (
    <div className="tour-layer">
      <div ref={spot} className="tour-spot" data-hidden="true" aria-hidden="true" />
      <div ref={bubble} className="tour-bubble" role="dialog" aria-modal="true" aria-label={labels.dialog} aria-describedby={bodyId} data-layout="float">
        <div className="tour-head">
          <p className="tour-progress">{labels.progress(index + 1, shown.length)}</p>
          <button type="button" className="tour-close" onClick={() => close(false)} aria-label={labels.close} title={labels.close}>
            <span aria-hidden="true">×</span>
          </button>
        </div>
        <h2 id={titleId} ref={titleRef} tabIndex={-1}>
          {step.title}
        </h2>
        <p id={bodyId}>{touch && step.touch ? step.touch : step.body}</p>
        <div className="tour-actions">
          <span className="tour-dots" aria-hidden="true">
            {shown.map((candidate, position) => (
              <span key={`${candidate.target}-${position}`} className="tour-dot" data-current={position === index ? "true" : undefined} />
            ))}
          </span>
          <span className="tour-nav">
            {index > 0 ? (
              <button type="button" className="button-secondary" onClick={() => setIndex(index - 1)}>
                {labels.previous}
              </button>
            ) : null}
            <button type="button" className="button-primary" onClick={() => (lastStep ? close(true) : setIndex(index + 1))}>
              {lastStep ? labels.finish : labels.next}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
