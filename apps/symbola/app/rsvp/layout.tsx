// Lot 49 (INV-03, SEC-17) : la page de réponse des invités n'est pas indexée (en-tête X-Robots-Tag
// dans next.config.ts, et balise robots ici) ; sans référent vers un autre site.
import type { ReactNode } from "react";

export const metadata = { robots: { index: false, follow: false, nocache: true }, referrer: "no-referrer" as const };

export default function RsvpLayout({ children }: { children: ReactNode }) {
  return children;
}
