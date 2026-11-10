// Lot 20 (décision 1) — l'accès aux réglages d'un module : un bouton
// « Réglages », roue et libellé, toujours à la même place (à droite du titre
// de l'écran ou de la section). Remplace la roue crantée seule et les boutons
// de réglages des Événements. Le nom accessible commence par le libellé
// visible, puis précise la rubrique ouverte.
import Link from "next/link";
import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";

export async function SettingsLink({ href, label, tour }: { href: string; label: string; tour?: string }) {
  const t = await getTranslations("Common");
  return (
    <Link href={href} className="button-link settings-link" title={label} data-tour={tour}>
      <Settings size={18} strokeWidth={1.75} aria-hidden="true" />
      {t("moduleSettings")}
      <span className="sr-only"> : {label}</span>
    </Link>
  );
}
