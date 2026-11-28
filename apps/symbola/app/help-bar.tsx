"use client";

// Lot 10 (AIDE-07), revu au lot 13 (L13-HUB-15) puis au lot 74d (B11 ; page 25 des maquettes du lot
// 68) — plus de barre permanente : une pastille « Reprendre » quand un tutoriel est en cours, sur
// l'onglet Tutoriels. L'invitation à un tutoriel (« Découvrir en N minutes », « Commencer le
// tutoriel », « Plus tard ») a quitté les écrans : les tutoriels vivent dans « Tutoriels » et dans
// l'aide de l'écran qu'ils concernent.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { useHelpContext } from "./help-context";

export function HelpBar({ tutorial }: { tutorial: { title: string; href: string } | null }) {
  const pathname = usePathname();
  const t = useTranslations("HelpBar");
  const help = useHelpContext();
  if (help?.tour?.open) return null;
  // Lot 18 (L18-HUB-23) : sur l'onglet Tutoriels seulement, pour ne pas gêner la navigation ailleurs.
  if (!tutorial || !(pathname === "/tutoriels" || pathname.startsWith("/tutoriels/"))) return null;
  return (
    <aside className="resume-zone" aria-label={t("resumeLabel")}>
      <Link href={tutorial.href} className="resume-chip">
        {t("resumeTutorial", { title: tutorial.title })}
      </Link>
    </aside>
  );
}
