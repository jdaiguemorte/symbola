// Lot 13 (L13-HUB-15) — bloc « À traiter » de l'accueil : devis envoyés sans
// réponse et prospects sans nouvelle au-delà des délais de relance de
// l'organisation (décision G). Chaque ligne mène à sa fiche. Un module non
// souscrit retire simplement sa partie (dégradation propre).
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { loadFollowUps } from "./follow-ups";
import { HOME_BLOCK_LINES } from "./home-blocks";

export async function FollowUpBlock({ organizationId, modules }: { organizationId: string; modules: { events: boolean; quotes: boolean } }) {
  const t = await getTranslations("Home");
  const locale = (await getLocale()) as Locale;
  const items = await loadFollowUps(organizationId, modules, {
    quote: (number, names) => t("followUpQuote", { number, names }),
    prospect: (names) => t("followUpProspect", { names }),
    depositWaiting: (number) => t("followUpDepositWaiting", { number }),
    depositBlocked: (number) => t("followUpDepositBlocked", { number }),
    depositBadge: (issueOn) => t("followUpDepositOn", { date: formatCalendarDate(issueOn, locale) }),
    depositBlockedBadge: t("followUpDepositBlockedBadge"),
  });
  return (
    <section className="card home-block" aria-labelledby="follow-up-title" data-tour="home-follow-up" data-urgent={items.length > 0 ? "true" : undefined}>
      <div className="section-head">
        <h2 id="follow-up-title">{t("followUpTitle")}</h2>
        <Link href="/parametres/relances">{t("followUpSettings")}</Link>
      </div>
      {items.length === 0 ? (
        <p>{t("followUpEmpty")}</p>
      ) : (
        <>
          <ul className="follow-up-list">
            {items.slice(0, HOME_BLOCK_LINES).map((item) => (
              <li key={item.key}>
                <Link href={item.href}>{item.label}</Link>
                <span className="badge badge-ambre">{item.badge ?? t("followUpDays", { days: item.days })}</span>
              </li>
            ))}
          </ul>
          {items.length > HOME_BLOCK_LINES ? <p className="home-more">{t("moreFollowUps", { count: items.length - HOME_BLOCK_LINES })}</p> : null}
        </>
      )}
    </section>
  );
}
