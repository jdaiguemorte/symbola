"use client";

// Lot 63f (HUB-11 ; ADR 0104, qui remplace les repères de l'ADR 0033) — visite guidée d'un écran :
// le fond est assombri, la zone expliquée (attribut data-tour) reste claire, une bulle à côté dit
// « N sur M » et propose « Précédent », « Suivant » (« Terminer » à la fin) et « Passer la visite ».
// La bulle est une fenêtre : le focus y entre, y reste (Tab), revient à son point de départ à la
// fermeture ; Échap ferme. Sur téléphone, pas de découpe : la bulle est ancrée en bas, la zone
// encadrée. Une étape dont la zone n'est pas à l'écran a sa bulle seule, au centre. Positions posées
// par le CSSOM (style.setProperty) : la CSP refuse les styles en ligne.
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export type TourStep = {
  title: string;
  body: string;
  target?: string | undefined;
};

export type TourLabels = {
  // Nom de la fenêtre, déjà traduit (« Visite : Aujourd'hui »).
  dialog: string;
  // « 2 sur 5 », déjà traduit par l'appelant.
  progress: (number: number, total: number) => string;
  previous: string;
  next: string;
  finish: string;
  skip: string;
};

export type Rect = { top: number; left: number; width: number; height: number };
export type Placement = { top: number; left: number; side: "below" | "above" | "center" };

// Sous la zone si la place le permet, sinon au-dessus, sinon au centre ; jamais hors de l'écran.
export function placeTourBubble(target: Rect | null, bubble: { width: number; height: number }, viewport: { width: number; height: number }, gap = 12): Placement {
  const margin = 8;
  const center = { top: Math.max(margin, (viewport.height - bubble.height) / 2), left: Math.max(margin, (viewport.width - bubble.width) / 2), side: "center" as const };
  if (!target) return center;
  const left = Math.min(Math.max(margin, target.left + target.width / 2 - bubble.width / 2), Math.max(margin, viewport.width - bubble.width - margin));
  const below = target.top + target.height + gap;
  if (below + bubble.height <= viewport.height - margin) return { top: below, left, side: "below" };
  const above = target.top - gap - bubble.height;
  if (above >= margin) return { top: above, left, side: "above" };
  return center;
}

const MOBILE_QUERY = "(max-width: 767px)";
const FOCUSABLE = 'button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])';

function targetOf(target: string | undefined): HTMLElement | null {
  if (!target) return null;
  const element = document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? element : null;
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
  // completed : arrivée au bout (« Terminer ») plutôt que passée.
  onClose: (completed: boolean) => void;
}) {
  const [index, setIndex] = useState(0);
  const bubble = useRef<HTMLDivElement>(null);
  const spot = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const origin = useRef<HTMLElement | null>(null);
  const titleId = useId();
  const bodyId = useId();

  const close = useCallback(
    (completed: boolean) => {
      onClose(completed);
      // Le focus revient à son point de départ (le « ? », ou l'élément qui l'avait).
      const back = origin.current;
      origin.current = null;
      if (back && back.isConnected) window.setTimeout(() => back.focus(), 0);
    },
    [onClose],
  );

  // Ouverture : on retient d'où vient le focus (avant de le prendre), on repart de la première étape.
  useLayoutEffect(() => {
    if (!open) return;
    origin.current = document.activeElement instanceof HTMLElement && document.activeElement !== document.body ? document.activeElement : null;
    setIndex(0);
  }, [open]);

  const place = useCallback(() => {
    const box = bubble.current;
    const frame = spot.current;
    if (!box || !frame) return;
    const element = targetOf(steps[index]?.target);
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
  }, [index, steps]);

  // Chaque étape : sa zone ramenée à l'écran, puis la bulle posée et le focus dans la bulle.
  useLayoutEffect(() => {
    if (!open) return;
    const element = targetOf(steps[index]?.target);
    const mobile = window.matchMedia(MOBILE_QUERY).matches;
    element?.scrollIntoView({ block: mobile ? "start" : "center", inline: "nearest" });
    place();
    titleRef.current?.focus();
  }, [open, index, steps, place]);

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

  if (!open || steps.length === 0) return null;
  const step = steps[Math.min(index, steps.length - 1)]!;
  const lastStep = index >= steps.length - 1;

  return (
    <div className="tour-layer">
      <div ref={spot} className="tour-spot" data-hidden="true" aria-hidden="true" />
      <div ref={bubble} className="tour-bubble" role="dialog" aria-modal="true" aria-label={labels.dialog} aria-describedby={bodyId} data-layout="float">
        <p className="tour-progress">{labels.progress(index + 1, steps.length)}</p>
        <h2 id={titleId} ref={titleRef} tabIndex={-1}>
          {step.title}
        </h2>
        <p id={bodyId}>{step.body}</p>
        <div className="tour-actions">
          <button type="button" className="button-ghost tour-skip" onClick={() => close(false)}>
            {labels.skip}
          </button>
          <span className="tour-nav">
            {index > 0 ? (
              <button type="button" className="button-secondary" onClick={() => setIndex(index - 1)}>
                {labels.previous}
              </button>
            ) : null}
            <button type="button" onClick={() => (lastStep ? close(true) : setIndex(index + 1))}>
              {lastStep ? labels.finish : labels.next}
            </button>
          </span>
        </div>
      </div>
    </div>
  );
}
