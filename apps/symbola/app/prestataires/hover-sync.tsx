"use client";

// Lot 13 (L13-PRE-12) — survoler (ou parcourir au clavier) une fiche de la liste
// met son repère en avant sur la carte.
import { useEffect } from "react";
import { VENDOR_HOVER_EVENT } from "./vendor-map";

export function HoverSync({ containerId }: { containerId: string }) {
  useEffect(() => {
    const container = document.getElementById(containerId);
    if (!container) return;
    const announce = (event: Event) => {
      const item = (event.target as HTMLElement).closest<HTMLElement>("[data-vendor-id]");
      window.dispatchEvent(new CustomEvent(VENDOR_HOVER_EVENT, { detail: item?.dataset.vendorId ?? null }));
    };
    const clear = () => window.dispatchEvent(new CustomEvent(VENDOR_HOVER_EVENT, { detail: null }));
    container.addEventListener("mouseover", announce);
    container.addEventListener("focusin", announce);
    container.addEventListener("mouseleave", clear);
    return () => {
      container.removeEventListener("mouseover", announce);
      container.removeEventListener("focusin", announce);
      container.removeEventListener("mouseleave", clear);
    };
  }, [containerId]);
  return null;
}
