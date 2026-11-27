"use client";

// Lot 72d (P-12, règle 6 de DESIGN.md ; C-16 ; page 15 des maquettes du lot 68) — le retour de la fiche d'un
// évènement : « ← Évènements » au-dessus du nom à l'ordinateur ; sur téléphone, « ← » et le nom du mariage
// à la place du nom du menu dans la barre du haut. Il ramène à l'écran d'où l'on vient — la liste des
// évènements (ses filtres compris), « Aujourd'hui » ou « Tâches » —, sinon à la liste des évènements.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { PhoneTitleOverride } from "@/app/phone-screen-title";
import { useOrigin } from "@/app/navigation-origin";

export function EventBack({ names }: { names: string }) {
  const t = useTranslations("EventHeader.back");
  const pathname = usePathname();
  const origin = useOrigin(pathname);
  const screen = t(origin?.screen ?? "events");
  const href = origin?.href ?? "/events";
  return (
    <>
      <PhoneTitleOverride title={names} backHref={href} backLabel={t("label", { screen })} />
      <Link href={href} className="object-header-back" aria-label={t("label", { screen })}>
        <span aria-hidden="true">←</span> {screen}
      </Link>
    </>
  );
}
