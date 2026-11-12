// Lot 26b (SEC-17) : l'espace d'un prestataire ouvert par son lien personnel
// n'est pas indexé (en-tête X-Robots-Tag dans next.config.ts, et balise robots ici).
import type { ReactNode } from "react";

export const metadata = { robots: { index: false, follow: false, nocache: true } };

export default function VendorSpaceLayout({ children }: { children: ReactNode }) {
  return children;
}
