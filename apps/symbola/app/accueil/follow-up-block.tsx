// Lot 13 (HUB-15) — bloc « À traiter » de l'accueil : devis envoyés sans
// réponse et prospects sans nouvelle au-delà des délais de relance de
// l'organisation (décision G). Chaque ligne mène à sa fiche. Un module non
// souscrit retire simplement sa partie (dégradation propre).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { loadFollowUps } from "./follow-ups";

export async function FollowUpBlock({ organizationId, modules }: { organizationId: string; modules: { events: boolean; quotes: boolean } }) {
  const t = await getTranslations("Home");
  const items = await loadFollowUps(organizationId, modules, {
    quote: (number, names) => t("followUpQuote", { number, names }),
    prospect: (names) => t("followUpProspect", { names }),
  });
  return (
    <section className="card" aria-labelledby="follow-up-title">
      <div className="section-head">
        <h2 id="follow-up-title">{t("followUpTitle")}</h2>
        <Link href="/parametres/relances">{t("followUpSettings")}</Link>
      </div>
      {items.length === 0 ? (
        <p>{t("followUpEmpty")}</p>
      ) : (
        <ul className="follow-up-list">
          {items.map((item) => (
            <li key={item.key}>
              <Link href={item.href}>{item.label}</Link>
              <span className="badge badge-ambre">{t("followUpDays", { days: item.days })}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
