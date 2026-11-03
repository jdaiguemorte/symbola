"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";

// Menu latéral : toujours visible sur ordinateur ; replié derrière un
// bouton « Menu » sur téléphone (charte, lot 7), pour que le contenu de
// l'écran reste en haut. Il se replie après chaque changement de page.
export function AppSidebar({ brand, menuLabel, closeLabel, children }: { brand: ReactNode; menuLabel: string; closeLabel: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  useEffect(() => {
    setOpen(false);
  }, [pathname]);
  return (
    <aside className={open ? "app-sidebar is-open" : "app-sidebar"}>
      <div className="app-sidebar-header">
        {brand}
        <button type="button" className="app-menu-toggle" aria-expanded={open} aria-controls="app-menu" onClick={() => setOpen((value) => !value)}>
          {open ? closeLabel : menuLabel}
        </button>
      </div>
      <div id="app-menu" className="app-collapsible">
        {children}
      </div>
    </aside>
  );
}
