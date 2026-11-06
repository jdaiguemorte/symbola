"use client";

// Lot 13 (HUB-14, ADR 0033) — tableau de liste commun : colonnes alignées,
// ligne entière cliquable. Le lien de la première colonne reste la cible
// au clavier et pour les lecteurs d'écran ; le clic ailleurs sur la ligne
// le suit (sauf sur un autre élément interactif).
import { useRouter } from "next/navigation";
import type { ReactNode } from "react";

export function ListTable({ label, head, children }: { label: string; head: ReactNode; children: ReactNode }) {
  return (
    <div className="list-table-wrap" role="region" aria-label={label} tabIndex={0}>
      <table className="list-table">
        <thead>{head}</thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function ListRow({ href, children }: { href: string; children: ReactNode }) {
  const router = useRouter();
  return (
    <tr
      className="list-row"
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("a, button, input, select, textarea, label")) return;
        router.push(href);
      }}
    >
      {children}
    </tr>
  );
}
