// Lot 20 (décision 1) — l'accès aux réglages d'un module : un bouton
// « Réglages », roue et libellé, toujours à la même place (à droite du titre
// de l'écran ou de la section). Remplace la roue crantée seule et les boutons
// de réglages des Événements. Le nom accessible commence par le libellé
// visible, puis précise la rubrique ouverte.
// Lot 63c (UX-09, UX-13 ; ADR 0107, M8) : les réglages s'ouvrent dans le panneau latéral, au-dessus
// de l'écran (navigation interceptée, app/@panel) ; une page sans panneau garde son adresse.
import Link from "next/link";
import { Settings } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { settingsPanelHref, type SettingsBackKey } from "@/app/reglages/panels";

export async function SettingsLink({ href, label, tour, back }: { href: string; label: string; tour?: string; back?: SettingsBackKey }) {
  const t = await getTranslations("Common");
  return (
    <Link href={settingsPanelHref(href, back)} className="button-link settings-link" title={label} data-tour={tour} scroll={false}>
      <Settings size={18} strokeWidth={1.75} aria-hidden="true" />
      {t("moduleSettings")}
      <span className="sr-only"> : {label}</span>
    </Link>
  );
}
