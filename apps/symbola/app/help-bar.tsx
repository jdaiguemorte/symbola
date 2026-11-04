"use client";

// Lot 10 (AIDE-07) — barre d'aide, en bas de chaque écran de l'équipe :
// progression de la prise en main, reprise de la visite mise de côté sur cet
// écran, ou du tutoriel en cours. Repliable (préférence gardée dans le
// navigateur, sans donnée personnelle).
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { useHelpContext } from "./help-context";
import { recordHelpProgressAction } from "./actions";

export type TutorialInvite = { key: string; screen: string; title: string; minutes: number; href: string };

const COLLAPSED_KEY = "symbola_aide_barre_repliee";

export function HelpBar({
  completed,
  total,
  tutorial,
  invites,
}: {
  completed: number;
  total: number;
  tutorial: { title: string; href: string } | null;
  // AIDE-06 : tutoriels jamais ouverts, proposés à la première visite de leur écran.
  invites: TutorialInvite[];
}) {
  const pathname = usePathname();
  const [dismissed, setDismissed] = useState<string[]>([]);
  const t = useTranslations("HelpBar");
  const help = useHelpContext();
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    try {
      setCollapsed(window.localStorage.getItem(COLLAPSED_KEY) === "1");
    } catch {
      // Stockage indisponible (navigation privée) : barre dépliée.
    }
  }, []);

  function toggle() {
    const next = !collapsed;
    setCollapsed(next);
    try {
      window.localStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
    } catch {
      // Sans stockage, le choix vaut pour cette page seulement.
    }
  }

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
    <aside className="help-bar" aria-label={t("label")} data-collapsed={collapsed ? "true" : "false"}>
      {collapsed ? (
        <button type="button" className="help-bar-toggle" onClick={toggle} aria-expanded="false">
          {t("progressShort", { completed, total })}
        </button>
      ) : (
        <>
          <Link href="/aide" className="help-bar-progress">
            {t("progress", { completed, total })}
          </Link>
          {tour && tour.postponedStep !== null ? (
            <button type="button" className="help-bar-resume" onClick={tour.resume}>
              {t("resumeTour", { step: tour.postponedStep + 1 })}
            </button>
          ) : tutorial ? (
            <Link href={tutorial.href} className="help-bar-resume">
              {t("resumeTutorial", { title: tutorial.title })}
            </Link>
          ) : null}
          <button type="button" className="help-bar-toggle" onClick={toggle} aria-expanded="true" aria-label={t("collapse")}>
            ×
          </button>
        </>
      )}
    </aside>
    </>
  );
}
