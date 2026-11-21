"use client";

// Lot 63c (ADR 0107) — le contenu d'une page de réglages, en page complète (<main>) ou dans le panneau
// latéral d'un autre écran (un bloc : un seul <main> par page, axe-core).
import { createContext, useContext, type ReactNode } from "react";

const InSettingsPanel = createContext(false);

export function SettingsPanelScope({ children }: { children: ReactNode }) {
  return <InSettingsPanel.Provider value>{children}</InSettingsPanel.Provider>;
}

export function useInSettingsPanel(): boolean {
  return useContext(InSettingsPanel);
}

export function ScreenMain({ className, children }: { className?: string; children: ReactNode }) {
  const inPanel = useContext(InSettingsPanel);
  return inPanel ? <div className={className ? `${className} settings-panel-content` : "settings-panel-content"}>{children}</div> : <main className={className}>{children}</main>;
}
