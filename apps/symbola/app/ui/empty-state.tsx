// Lot 39c (UX-08 ; D11 ; spécification lot 39) — l'écran vide enseigne : une action principale, un
// exemple, et une aide lue en trente secondes avec le lien vers l'aide complète. Même forme partout.
import Link from "next/link";
import { useTranslations } from "next-intl";

export type EmptyStateKey = "events" | "tasks" | "contacts" | "vendors" | "quotes" | "documents" | "taskTemplates" | "programTemplates" | "quoteTemplates" | "messageTemplates" | "payments" | "trash";

// title : la phrase d'écran vide déjà connue de l'écran (sinon, celle de l'écran vide commun).
export function EmptyState({ screen, title, actionHref }: { screen: EmptyStateKey; title?: string; actionHref?: string }) {
  const t = useTranslations("EmptyStates");
  const id = `vide-${screen}`;
  return (
    <section className="empty-state" aria-labelledby={id}>
      <h2 id={id}>{title ?? t(`${screen}.title`)}</h2>
      <p>{t(`${screen}.help`)}</p>
      <p className="meta">{t(`${screen}.example`)}</p>
      <div className="row-wrap">
        {actionHref ? (
          <Link href={actionHref} className="button-link">
            {t(`${screen}.action`)}
          </Link>
        ) : null}
        <Link href="/aide">{t("moreHelp")}</Link>
      </div>
    </section>
  );
}
