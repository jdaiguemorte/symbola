"use client";

// Lot 10 (AIDE-05, AIDE-07), revu au lot 13 (AIDE-11) — lien entre les
// repères de l'écran affiché et la pastille « Reprendre » : ouverts, ils la
// masquent.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ActiveTour = { key: string; open: boolean };

const HelpContext = createContext<{ tour: ActiveTour | null; setTour: (tour: ActiveTour | null) => void } | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [tour, setTour] = useState<ActiveTour | null>(null);
  const value = useMemo(() => ({ tour, setTour }), [tour]);
  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelpContext() {
  return useContext(HelpContext);
}
