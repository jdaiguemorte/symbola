"use client";

export type FirstStepsItem = { key: string; label: string; done: boolean };

// AIDE-04 — « Le tableau de bord affiche une liste des premiers pas. Il peut
// la masquer. » Liste purement présentationnelle : les items (complétés ou
// non) sont calculés côté serveur par l'appelant, jamais codés ici, pour
// rester extensible aux futurs modules (import, catalogue, premier
// événement) sans toucher ce composant.
export function FirstStepsChecklist({
  title,
  items,
  hideLabel,
  onHide,
}: {
  title: string;
  items: FirstStepsItem[];
  hideLabel: string;
  onHide: () => void;
}) {
  return (
    <section aria-label={title}>
      <h2>{title}</h2>
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <span aria-hidden="true">{item.done ? "✓" : "○"}</span> {item.label}
          </li>
        ))}
      </ul>
      <button type="button" onClick={onHide}>
        {hideLabel}
      </button>
    </section>
  );
}
