"use client";

// Lot 10 (AIDE-07), revu au lot 13 (HUB-15) — plus de barre permanente :
// une pastille « Reprendre » quand un tutoriel est en cours, et l'invitation à un tutoriel à la
// première visite de son écran (AIDE-06). Le compteur des tutoriels est
// dans le menu.
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { useHelpContext } from "./help-context";
import { recordHelpProgressAction } from "./actions";

export type TutorialInvite = { key: string; screen: string; title: string; minutes: number; href: string };

export function HelpBar({
  tutorial,
  invites,
}: {
  tutorial: { title: string; href: string } | null;
  // AIDE-06 : tutoriels jamais ouverts, proposés à la première visite de leur écran.
  invites: TutorialInvite[];
}) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const t = useTranslations("HelpBar");
  const help = useHelpContext();
  const tour = help?.tour;
  if (tour?.open) return null;
  const invite = invites.find((candidate) => candidate.screen === pathname && !dismissed.includes(candidate.key));

  return (
    <>
      {invite ? (
        <section className="tutorial-invite" aria-labelledby="tutorial-invite-title">
          <p className="tutorial-invite-kicker">{t("inviteKicker", { minutes: invite.minutes })}</p>
          <h2 id="tutorial-invite-title">{invite.title}</h2>
          <div className="tutorial-invite-actions">
            <Link href={invite.href} className="button-link button-link-primary">
              {t("inviteStart")}
            </Link>
            <button
              type="button"
              className="tutorial-invite-later"
              onClick={() => {
                setDismissed((keys) => [...keys, invite.key]);
                void recordHelpProgressAction(`tutorial:${invite.key}`, "postponed", 0);
              }}
            >
              {t("inviteLater")}
            </button>
          </div>
        </section>
      ) : null}
      {/* Lot 13 (HUB-15) : plus de barre permanente ; une pastille seulement
          quand un tutoriel est à reprendre. Lot 18 (HUB-23) : sur l'onglet
          Tutoriels seulement, pour ne pas gêner la navigation ailleurs. */}
      {tutorial && (pathname === "/tutoriels" || pathname.startsWith("/tutoriels/")) ? (
        <aside className="resume-zone" aria-label={t("resumeLabel")}>
          <Link href={tutorial.href} className="resume-chip">
            {t("resumeTutorial", { title: tutorial.title })}
          </Link>
        </aside>
      ) : null}
    </>
  );
}
