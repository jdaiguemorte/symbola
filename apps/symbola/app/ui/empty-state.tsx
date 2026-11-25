// Lot 39c (UX-08 ; D11 ; spécification lot 39) — l'écran vide enseigne : une action principale, un
// exemple, et une aide lue en trente secondes avec le lien vers l'aide complète. Même forme partout.
import Link from "next/link";
import type { ReactNode } from "react";
import { useTranslations } from "next-intl";

export type EmptyStateKey = "events" | "tasks" | "contacts" | "vendors" | "quotes" | "documents" | "taskTemplates" | "programTemplates" | "quoteTemplates" | "messageTemplates" | "payments" | "trash";

// title : la phrase d'écran vide déjà connue de l'écran (sinon, celle de l'écran vide commun).
// Lot 63c (#30) : `helpHref`, l'article d'aide de l'écran plutôt que l'accueil de l'aide.
// Lot 67c (UX-08 ; recette du 24/11/2026, R08) : `action`, l'action principale quand elle n'est pas
// un lien (un bouton qui fait la chose), à la place d'`actionHref`. Un lien vers une ancre de la même
// page, déjà sous les yeux, ne fait rien : il n'est pas une action.
export function EmptyState({ screen, title, actionHref, action, helpHref = "/aide" }: { screen: EmptyStateKey; title?: string; actionHref?: string; action?: ReactNode; helpHref?: string }) {
  const t = useTranslations("EmptyStates");
  const id = `vide-${screen}`;
  return (
    <section className="empty-state" aria-labelledby={id}>
      <h2 id={id}>{title ?? t(`${screen}.title`)}</h2>
      <p>{t(`${screen}.help`)}</p>
      <p className="meta">{t(`${screen}.example`)}</p>
      <div className="row-wrap">
        {action}
        {!action && actionHref ? (
          <Link href={actionHref} className="button-link">
            {t(`${screen}.action`)}
          </Link>
        ) : null}
        <Link href={helpHref}>{t("moreHelp")}</Link>
      </div>
    </section>
  );
}
