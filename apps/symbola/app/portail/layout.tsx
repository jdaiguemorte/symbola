// Lot 26a (SEC-17) : le portail d'un lien personnel n'est pas indexé (en-tête
// X-Robots-Tag dans next.config.ts, et balise robots ici).
import type { ReactNode } from "react";

export const metadata = { robots: { index: false, follow: false, nocache: true } };

export default function PortalLayout({ children }: { children: ReactNode }) {
  return children;
}
