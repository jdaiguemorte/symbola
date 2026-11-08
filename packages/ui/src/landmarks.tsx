"use client";

// Lot 13 (AIDE-11, ADR 0033) — aide sur l'écran par repères : des numéros
// posés sur les éléments réels (attribut data-tour), et un panneau qui
// explique le repère choisi. Rien n'est bloqué : l'écran reste utilisable.
// Un clic sur un repère ou sur la liste le choisit et le met en avant ;
// « Repère suivant » les parcourt dans l'ordre ; Échap ferme. Positions
// posées par le CSSOM (style.setProperty) : la CSP refuse les styles en ligne.
import { useCallback, useEffect, useRef, useState } from "react";

export type LandmarkStep = {
  title: string;
  body: string;
  target?: string | undefined;
};

export type LandmarkLabels = {
  panel: string;
  close: string;
  previous: string;
  next: string;
  // « Repère {n} : {titre} », déjà traduit par l'appelant.
  marker: (number: number, title: string) => string;
};

function targetOf(target: string | undefined): HTMLElement | null {
  if (!target) return null;
  const element = document.querySelector<HTMLElement>(
    `[data-tour="${CSS.escape(target)}"]`,
  );
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0 ? element : null;
}

export function Landmarks({
  open,
  intro,
  steps,
  labels,
  onClose,
}: {
  open: boolean;
  intro: string;
  steps: LandmarkStep[];
  labels: LandmarkLabels;
  onClose: () => void;
}) {
  const [selected, setSelected] = useState(0);
  const [present, setPresent] = useState<boolean[]>([]);
  const markers = useRef<(HTMLButtonElement | null)[]>([]);
  const titleRef = useRef<HTMLHeadingElement>(null);

  // Place les repères sur leurs éléments (et les retire s'ils ne sont pas à l'écran).
  const place = useCallback(() => {
    const found = steps.map((step, index) => {
      const element = targetOf(step.target);
      const marker = markers.current[index];
      if (!element || !marker) return Boolean(element);
      const rect = element.getBoundingClientRect();
      // Lot 16 (HUB-19, ADR 0039) : jamais sur le libellé de l'élément.
      // - Élément étroit (onglet, bouton) : centré au-dessus de lui, dans
      //   l'espace qui sépare les rangées ; sinon juste en dessous.
      // - Bloc large : dans la marge à gauche ; sans marge (téléphone), dans
      //   son coin haut droit, à l'écart du libellé posé à gauche.
      const MARKER = 28;
      let top: number;
      let left: number;
      if (rect.width < 260) {
        top = rect.top - MARKER - 2 >= 4 ? rect.top - MARKER - 2 : rect.bottom + 2;
        left = rect.left + rect.width / 2 - MARKER / 2;
      } else if (rect.left >= MARKER + 10) {
        top = rect.top;
        left = rect.left - MARKER - 6;
      } else {
        top = rect.top - 10;
        left = Math.min(rect.right, window.innerWidth - 4) - MARKER - 4;
      }
      marker.style.setProperty("top", `${Math.max(top, 4)}px`);
      marker.style.setProperty("left", `${Math.max(Math.min(left, window.innerWidth - MARKER - 4), 4)}px`);
      return true;
    });
    setPresent((previous) =>
      previous.length === found.length &&
      previous.every((value, index) => value === found[index])
        ? previous
        : found,
    );
  }, [steps]);

  useEffect(() => {
    if (!open) return;
    setSelected(0);
    titleRef.current?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let frame = 0;
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(place);
    };
    schedule();
    // Lot 16 (HUB-19) : le tiroir pousse le contenu sans redimensionner la
    // fenêtre ; les repères se replacent une fois la mise en page refaite.
    const settle = window.setTimeout(schedule, 150);
    const resized = new ResizeObserver(schedule);
    resized.observe(document.body);
    window.addEventListener("resize", schedule);
    window.addEventListener("scroll", schedule, true);
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(settle);
      resized.disconnect();
      window.removeEventListener("resize", schedule);
      window.removeEventListener("scroll", schedule, true);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open, place, onClose]);

  // Le repère choisi : son élément est mis en avant et ramené à l'écran.
  useEffect(() => {
    if (!open) return;
    const element = targetOf(steps[selected]?.target);
    if (!element) return;
    element.classList.add("landmark-active");
    element.scrollIntoView({ block: "nearest", behavior: "smooth" });
    return () => element.classList.remove("landmark-active");
  }, [open, selected, steps]);

  if (!open) return null;
  const step = steps[selected];

  return (
    <>
      {steps.map((item, index) => (
        <button
          key={`${item.title}-${index}`}
          ref={(element) => {
            markers.current[index] = element;
          }}
          type="button"
          className="landmark-marker"
          data-hidden={present[index] ? "false" : "true"}
          aria-pressed={index === selected}
          aria-label={labels.marker(index + 1, item.title)}
          onClick={() => setSelected(index)}
        >
          {index + 1}
        </button>
      ))}
      <aside className="landmark-panel" aria-label={labels.panel}>
        <div className="landmark-panel-head">
          <h2 ref={titleRef} tabIndex={-1}>
            {labels.panel}
          </h2>
          <button
            type="button"
            className="landmark-close"
            onClick={onClose}
            aria-label={labels.close}
          >
            ×
          </button>
        </div>
        <p className="landmark-intro">{intro}</p>
        {step ? (
          <>
            <ol className="landmark-list">
              {steps.map((item, index) => (
                <li key={`${item.title}-${index}`}>
                  <button
                    type="button"
                    aria-current={index === selected ? "step" : undefined}
                    onClick={() => setSelected(index)}
                  >
                    <span className="landmark-number" aria-hidden="true">
                      {index + 1}
                    </span>
                    {item.title}
                  </button>
                </li>
              ))}
            </ol>
            <div className="landmark-detail" aria-live="polite">
              <h3>{step.title}</h3>
              <p>{step.body}</p>
            </div>
            <div className="landmark-nav">
              <button
                type="button"
                disabled={selected === 0}
                onClick={() => setSelected(selected - 1)}
              >
                {labels.previous}
              </button>
              <button
                type="button"
                disabled={selected === steps.length - 1}
                onClick={() => setSelected(selected + 1)}
              >
                {labels.next}
              </button>
            </div>
          </>
        ) : null}
      </aside>
    </>
  );
}
