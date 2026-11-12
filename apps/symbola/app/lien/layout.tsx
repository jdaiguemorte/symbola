// Lot 26a (SEC-17) : les pages à lien personnel ne sont pas indexées (en-tête
// X-Robots-Tag dans next.config.ts, et balise robots ici).
import type { ReactNode } from "react";

export const metadata = { robots: { index: false, follow: false, nocache: true } };

export default function LinkLayout({ children }: { children: ReactNode }) {
  return children;
}
