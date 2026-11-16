// Lot 37a (DOC-04, SEC-17 ; ADR 0070) : la page d'un lien de partage n'est pas indexée (en-tête
// X-Robots-Tag dans next.config.ts, et balise robots ici).
import type { ReactNode } from "react";

export const metadata = { robots: { index: false, follow: false, nocache: true } };

export default function ShareLayout({ children }: { children: ReactNode }) {
  return children;
}
