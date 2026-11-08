// Lot 16 (IMP-11, ADR 0041) — frise des étapes d'un assistant : étape faite
// (coche, résumé, lien pour y revenir), en cours (aria-current="step"), à
// venir. L'état est aussi dit en toutes lettres aux lecteurs d'écran.
import Link from "next/link";

export type StepperStep = {
  key: string;
  label: string;
  state: "done" | "current" | "todo";
  href: string | null;
  summary: string | null;
};

export function Stepper({ steps, label, stateLabels }: { steps: StepperStep[]; label: string; stateLabels: { done: string; current: string } }) {
  return (
    <nav aria-label={label} className="stepper">
      <ol>
        {steps.map((step, index) => (
          <li key={step.key} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
            <span className="stepper-marker" aria-hidden="true">
              {step.state === "done" ? "✓" : index + 1}
            </span>
            <span className="stepper-text">
              {step.state === "done" && step.href ? <Link href={step.href}>{step.label}</Link> : <span className="stepper-label">{step.label}</span>}
              {step.state !== "todo" ? <span className="sr-only"> — {step.state === "done" ? stateLabels.done : stateLabels.current}</span> : null}
              {step.summary ? <span className="stepper-summary">{step.summary}</span> : null}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
