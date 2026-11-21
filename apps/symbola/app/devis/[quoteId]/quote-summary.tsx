// Lot 62d (UX-12) — l'encart « Avant d'envoyer » (brouillon) ou « Suivi du devis » (ensuite) : une
// ligne par rubrique, son état en une phrase, et le lien qui y mène. Rien de ce qui engage n'est caché
// derrière un onglet sans être annoncé ici.
import Link from "next/link";
import type { ReactNode } from "react";
import { getTranslations } from "next-intl/server";
import { rubricHref } from "./rubrics";
import type { RubricState } from "./rubric-states";

export async function QuoteSummary({ quoteId, title, states, children }: { quoteId: string; title: string; states: RubricState[]; children?: ReactNode }) {
  const t = await getTranslations("QuoteRubrics");
  return (
    <section className="card quote-summary" aria-labelledby="quote-summary-title">
      <h2 id="quote-summary-title">{title}</h2>
      <ul className="quote-summary-list">
        {states.map((item) => (
          <li key={item.rubric}>
            <Link href={rubricHref(quoteId, item.rubric)} className="quote-summary-link">
              <span className="quote-summary-text">
                <span className="quote-summary-label">{item.label}</span>
                <span className="quote-summary-state">
                  {item.attention ? <span className="badge badge-ambre">{t("toCheck")}</span> : null} {item.state}
                </span>
              </span>
              <span className="quote-summary-open" aria-hidden="true">
                {t("open")}
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {children}
    </section>
  );
}
