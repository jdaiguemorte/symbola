// Lot 46 (RDV-02, D11 ; ADR 0080) : la page publique de réservation n'est pas indexée (en-tête
// X-Robots-Tag dans next.config.ts, et balise robots ici), ni citée comme référent.
import type { ReactNode } from "react";

export const metadata = { robots: { index: false, follow: false, nocache: true } };

export default function BookingLayout({ children }: { children: ReactNode }) {
  return children;
}
