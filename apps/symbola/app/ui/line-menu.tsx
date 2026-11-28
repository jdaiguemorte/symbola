"use client";

// Lot 74h (D7, C-75 ; page 30 des maquettes du lot 68) — le menu « ⋯ » d'une ligne éditable : « Monter »,
// « Descendre », « Supprimer… » et ce qui n'est pas la cible de la ligne (une ligne, une cible : son nom ;
// un menu pour le reste). Un <details> : il s'ouvre au clavier et au toucher sans script ; un choix le
// referme. Échap le referme et rend le focus au bouton.
//
// Réemploi (vagues 74i et 74j) : <LineMenu label="Autres actions pour « Client »" items={[{ label, hint?,
// onSelect, disabled? }]} />. `label` est le nom accessible du bouton « ⋯ » (il nomme la ligne).
import { useRef, type KeyboardEvent } from "react";

export type LineMenuItem = { label: string; hint?: string; onSelect: () => void; disabled?: boolean };

export function LineMenu({ label, items }: { label: string; items: LineMenuItem[] }) {
  const ref = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (!ref.current) return;
    ref.current.open = false;
    ref.current.querySelector("summary")?.focus();
  };
  const onKeyDown = (event: KeyboardEvent<HTMLDetailsElement>) => {
    if (event.key === "Escape" && ref.current?.open) {
      event.preventDefault();
      close();
    }
  };
  return (
    <details ref={ref} className="line-menu" onKeyDown={onKeyDown}>
      <summary aria-label={label} title={label}>
        <span aria-hidden="true">⋯</span>
      </summary>
      <div className="line-menu-panel">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className="button-ghost"
            disabled={item.disabled}
            onClick={() => {
              close();
              item.onSelect();
            }}
          >
            <span>
              {item.label}
              {item.hint ? <span className="line-menu-hint">{item.hint}</span> : null}
            </span>
          </button>
        ))}
      </div>
    </details>
  );
}
