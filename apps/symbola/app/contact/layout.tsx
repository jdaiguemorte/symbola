// Lot 44 (CRM-01 ; D1, D2 ; ADR 0084) : le formulaire de contact public n'est pas indexé (en-tête
// X-Robots-Tag dans next.config.ts, et balise robots ici), ni cité comme référent.
import type { ReactNode } from "react";

export const metadata = { robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" as const };

export default function ContactLayout({ children }: { children: ReactNode }) {
  return children;
}
