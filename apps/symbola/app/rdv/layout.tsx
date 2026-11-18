// Lot 46 (RDV-03 ; ADR 0053, ADR 0082) : la page d'un lien de gestion n'est pas indexée (en-tête
// X-Robots-Tag dans next.config.ts, et balise robots ici), ni citée comme référent.
import type { ReactNode } from "react";

export const metadata = { robots: { index: false, follow: false, nocache: true } };

export default function ManageLayout({ children }: { children: ReactNode }) {
  return children;
}
