// Roue crantée (maquette validée) : accès direct aux paramètres d'un module
// depuis l'écran où on en a besoin.
import Link from "next/link";
import { Settings } from "lucide-react";

export function GearLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="gear-link" aria-label={label} title={label}>
      <Settings size={20} strokeWidth={1.75} aria-hidden="true" />
    </Link>
  );
}
