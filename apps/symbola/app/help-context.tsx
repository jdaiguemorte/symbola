"use client";

// Lot 10 (AIDE-05, AIDE-07) — lien entre la visite focus de l'écran affiché
// et la barre d'aide : la visite s'y déclare (mise de côté ou non), la barre
// propose de la reprendre.
import { createContext, useContext, useMemo, useState, type ReactNode } from "react";

export type ActiveTour = { key: string; postponedStep: number | null; open: boolean; resume: () => void };

const HelpContext = createContext<{ tour: ActiveTour | null; setTour: (tour: ActiveTour | null) => void } | null>(null);

export function HelpProvider({ children }: { children: ReactNode }) {
  const [tour, setTour] = useState<ActiveTour | null>(null);
  const value = useMemo(() => ({ tour, setTour }), [tour]);
  return <HelpContext.Provider value={value}>{children}</HelpContext.Provider>;
}

export function useHelpContext() {
  return useContext(HelpContext);
}
