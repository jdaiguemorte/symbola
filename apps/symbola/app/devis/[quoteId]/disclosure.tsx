"use client";

// Lot 62d (UX-13, « liste éditable » de DESIGN.md) — ouverture en place, une seule à la fois : un
// groupe garde le panneau ouvert ; un bouton l'ouvre ou le referme (aria-expanded, aria-controls) ; le
// panneau ne rend son contenu qu'ouvert. Sert aux lignes du devis (la ligne s'édite sous elle-même),
// à ses sections, à ses échéances et aux formulaires d'ajout sous le tableau.
import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

type DisclosureState = { open: string | null; toggle: (id: string) => void; close: () => void };

const DisclosureContext = createContext<DisclosureState | null>(null);

function useDisclosure(): DisclosureState {
  const context = useContext(DisclosureContext);
  if (!context) throw new Error("DisclosureGroup manquant");
  return context;
}

export function DisclosureGroup({ initial = null, children }: { initial?: string | null; children: ReactNode }) {
  const [open, setOpen] = useState<string | null>(initial);
  const toggle = useCallback((id: string) => setOpen((current) => (current === id ? null : id)), []);
  const close = useCallback(() => setOpen(null), []);
  const value = useMemo(() => ({ open, toggle, close }), [open, toggle, close]);
  return <DisclosureContext.Provider value={value}>{children}</DisclosureContext.Provider>;
}

// `label` : le nom accessible quand le libellé visible est court (« Modifier » → « Modifier la ligne
// « Brunch » »).
export function DisclosureButton({ id, label, className, children }: { id: string; label?: string; className?: string; children: ReactNode }) {
  const { open, toggle } = useDisclosure();
  return (
    <button type="button" className={className} aria-expanded={open === id} aria-controls={`panneau-${id}`} aria-label={label} onClick={() => toggle(id)}>
      {children}
    </button>
  );
}

// `as="row"` : le panneau est une ligne de tableau, sous la ligne qu'il modifie.
export function DisclosurePanel({ id, as = "div", columns, className, children }: { id: string; as?: "div" | "row"; columns?: number; className?: string; children: ReactNode }) {
  const { open } = useDisclosure();
  if (open !== id) return null;
  if (as === "row") {
    return (
      <tr id={`panneau-${id}`} role="row" className={className}>
        <td role="cell" colSpan={columns}>
          {children}
        </td>
      </tr>
    );
  }
  return (
    <div id={`panneau-${id}`} className={className}>
      {children}
    </div>
  );
}

export function DisclosureClose({ className, children }: { className?: string; children: ReactNode }) {
  const { close } = useDisclosure();
  return (
    <button type="button" className={className} onClick={close}>
      {children}
    </button>
  );
}
