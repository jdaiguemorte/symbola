"use client";

// AIDE-05 (lot 10) — visite « focus » : l'écran s'assombrit, l'élément
// expliqué est mis en lumière (attribut data-tour), une bulle dit quoi faire.
// « Continuer » est le bouton principal ; « Plus tard » met la visite de
// côté avec son étape (reprise depuis la barre d'aide) ; Échap = « Plus
// tard ». Si l'élément n'est pas à l'écran, la bulle s'affiche seule.
// Les positions sont posées par le CSSOM (style.setProperty), jamais par un
// attribut style : la CSP de l'app refuse les styles en ligne.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

export type FocusTourStep = { title: string; body: string; target?: string | undefined };

export type FocusTourLabels = {
  continue: string;
  finish: string;
  back: string;
  later: string;
  // « Étape {n} sur {total} », déjà traduit par l'appelant.
  stepOf: (step: number, total: number) => string;
  laterHint: string;
};

const MARGIN = 12;
const BUBBLE_WIDTH = 380;

function findTarget(target: string | undefined): HTMLElement | null {
  if (!target) return null;
  const element = document.querySelector<HTMLElement>(`[data-tour="${CSS.escape(target)}"]`);
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? element : null;
}

export function FocusTour({
  open,
  steps,
  initialStep = 0,
  labels,
  onStepChange,
  onLater,
  onFinish,
}: {
  open: boolean;
  steps: FocusTourStep[];
  initialStep?: number;
  labels: FocusTourLabels;
  onStepChange?: (step: number) => void;
  onLater: (step: number) => void;
  onFinish: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [index, setIndex] = useState(Math.min(initialStep, Math.max(steps.length - 1, 0)));
  const spotlightRef = useRef<HTMLDivElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);
  const continueRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (open) setIndex(Math.min(initialStep, Math.max(steps.length - 1, 0)));
  }, [open, initialStep, steps.length]);

  const step = steps[index];
  const isLast = index === steps.length - 1;

  const place = useCallback(() => {
    const spotlight = spotlightRef.current;
    const bubble = bubbleRef.current;
    if (!spotlight || !bubble || !step) return;
    const target = findTarget(step.target);
    const narrow = window.innerWidth < 640;
    bubble.dataset.layout = narrow ? "sheet" : "float";
    if (!target) {
      spotlight.dataset.visible = "false";
      bubble.style.removeProperty("top");
      bubble.style.removeProperty("left");
      bubble.dataset.layout = narrow ? "sheet" : "center";
      return;
    }
    const rect = target.getBoundingClientRect();
    spotlight.dataset.visible = "true";
    spotlight.style.setProperty("top", `${rect.top - 6}px`);
    spotlight.style.setProperty("left", `${rect.left - 6}px`);
    spotlight.style.setProperty("width", `${rect.width + 12}px`);
    spotlight.style.setProperty("height", `${rect.height + 12}px`);
    if (narrow) return;
    const bubbleHeight = bubble.offsetHeight;
    const below = rect.bottom + MARGIN + bubbleHeight < window.innerHeight;
    const top = below ? rect.bottom + MARGIN + 6 : Math.max(MARGIN, rect.top - bubbleHeight - MARGIN - 6);
    const left = Math.min(Math.max(MARGIN, rect.left), window.innerWidth - BUBBLE_WIDTH - MARGIN);
    bubble.style.setProperty("top", `${top}px`);
    bubble.style.setProperty("left", `${left}px`);
  }, [step]);

  useLayoutEffect(() => {
    if (!open || !mounted || !step) return;
    const target = findTarget(step.target);
    target?.scrollIntoView({ block: "center", behavior: "instant" as ScrollBehavior });
    place();
    continueRef.current?.focus();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open, mounted, step, place]);

  if (!open || !mounted || !step) return null;

  function go(next: number) {
    setIndex(next);
    onStepChange?.(next);
  }

  function onKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      onLater(index);
      return;
    }
    if (event.key !== "Tab" || !bubbleRef.current) return;
    // Piège le focus dans la bulle (boîte de dialogue modale).
    const focusable = bubbleRef.current.querySelectorAll<HTMLElement>("button");
    if (focusable.length === 0) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div className="focus-tour" onKeyDown={onKeyDown}>
      <div ref={spotlightRef} className="focus-tour-spotlight" data-visible="false" aria-hidden="true" />
      <div className="focus-tour-backdrop" aria-hidden="true" />
      <div ref={bubbleRef} className="focus-tour-bubble" role="dialog" aria-modal="true" aria-labelledby="focus-tour-title" aria-describedby="focus-tour-body">
        <p className="focus-tour-progress">{labels.stepOf(index + 1, steps.length)}</p>
        <h2 id="focus-tour-title">{step.title}</h2>
        <p id="focus-tour-body">{step.body}</p>
        <div className="focus-tour-actions">
          <button type="button" className="focus-tour-later" onClick={() => onLater(index)}>
            {labels.later}
          </button>
          <div className="focus-tour-main-actions">
            {index > 0 ? (
              <button type="button" className="focus-tour-back" onClick={() => go(index - 1)}>
                {labels.back}
              </button>
            ) : null}
            <button
              ref={continueRef}
              type="button"
              className="focus-tour-continue"
              onClick={() => (isLast ? onFinish() : go(index + 1))}
            >
              {isLast ? labels.finish : labels.continue}
            </button>
          </div>
        </div>
        <p className="focus-tour-hint">{labels.laterHint}</p>
      </div>
    </div>
  );
}
