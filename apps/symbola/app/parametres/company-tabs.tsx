"use client";

// Lot 62b (UX-12 ; DESIGN.md, « Rubriques d'un écran long ») — Entreprise et TVA en deux rubriques :
// la fiche et la TVA d'abord, les mentions des devis et le logo ensuite. L'écran passait trois écrans
// de haut. Chaque rubrique a son adresse (« #fiche », « #documents ») ; une ancre d'un de ses blocs
// (« #informations-professionnel », cité par les devis quand une mention manque) ouvre sa rubrique.
import { useEffect, useState, type ReactNode } from "react";

export type CompanyTab = { id: string; label: string; anchors: string[]; panel: ReactNode };

export function CompanyTabs({ label, tabs }: { label: string; tabs: CompanyTab[] }) {
  const [active, setActive] = useState(tabs[0]!.id);

  useEffect(() => {
    const follow = () => {
      const anchor = decodeURIComponent(window.location.hash.slice(1));
      const tab = tabs.find((candidate) => candidate.id === anchor || candidate.anchors.includes(anchor));
      if (!tab) return;
      setActive(tab.id);
      // Le bloc visé était caché : on y va une fois sa rubrique affichée.
      if (tab.id !== anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: "start" }));
    };
    follow();
    window.addEventListener("hashchange", follow);
    return () => window.removeEventListener("hashchange", follow);
    // Les rubriques ne changent pas pendant la vie de l'écran.
  }, []);

  return (
    <>
      <nav className="tabs" aria-label={label}>
        {tabs.map((tab) => (
          <a
            key={tab.id}
            href={`#${tab.id}`}
            aria-current={tab.id === active ? "page" : undefined}
            onClick={(event) => {
              event.preventDefault();
              setActive(tab.id);
              window.history.replaceState(null, "", `#${tab.id}`);
            }}
          >
            {tab.label}
          </a>
        ))}
      </nav>
      {tabs.map((tab) => (
        <div key={tab.id} hidden={tab.id !== active} data-rubric={tab.id}>
          {tab.panel}
        </div>
      ))}
    </>
  );
}
