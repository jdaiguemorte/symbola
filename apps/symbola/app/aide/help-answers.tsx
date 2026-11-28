// Lot 74f (HUB-12, UX-10 ; maquette 27 ; C-07) — la réponse de la recherche de l'aide : le compte en mots et ce
// que la recherche a compris ; la meilleure réponse, lisible sans l'ouvrir (son résumé en étapes, sinon son
// texte), avec le bouton secondaire de l'écran concerné ; puis quatre autres au plus. Sans réponse, la phrase
// le dit avec les mots cherchés, puis la page montre les sujets : jamais une page vide. Rendu côté serveur ;
// le « ? » de chaque écran (74e) peut rendre le même bloc avec `compact`.
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { articleHref } from "@/lib/help/articles";
import type { HelpSearchResult } from "@/lib/help/search";

// La première phrase d'un article, entière (rien de coupé) : la ligne d'une autre réponse.
export function firstSentence(text: string): string {
  const match = /^.+?[.!?](?=\s|$)/u.exec(text.trim());
  return match ? match[0] : text.trim();
}

export async function HelpAnswers({ query, result, compact = false }: { query: string; result: HelpSearchResult; compact?: boolean }) {
  const t = await getTranslations("HelpHome.answers");
  const tCenter = await getTranslations("HelpCenter");
  const count = (result.best ? 1 : 0) + result.others.length;

  if (!result.best) {
    return (
      <section className="help-answers help-answers-none" aria-labelledby="help-answers-title">
        <div role="status">
          <h2 id="help-answers-title">{t("noneTitle", { query })}</h2>
          <p>{t("noneHint")}</p>
        </div>
      </section>
    );
  }
  const best = result.best;
  return (
    <section className="help-answers" aria-labelledby="help-answers-title">
      <p id="help-answers-title" className="help-answers-count" role="status">
        <strong>{t("count", { count, query })}</strong>
        {result.understood.length > 0 ? <span className="meta">{t("understood", { words: result.understood.join(" · ") })}</span> : null}
      </p>
      <article className="card help-best" aria-labelledby="help-best-title">
        <p className="meta">{t("bestLabel", { topic: tCenter(`groups.${best.topic}`) })}</p>
        <h2 id="help-best-title">{best.title}</h2>
        {best.steps.length > 0 && !compact ? (
          <ol className="help-best-steps">
            {best.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        ) : (
          <p>{best.body}</p>
        )}
        <div className="help-best-actions">
          {best.screenHref ? (
            <Link href={best.screenHref} className="button-link">
              {t("openScreen")}
            </Link>
          ) : null}
          <Link href={articleHref(best)}>{t("readArticle")}</Link>
        </div>
      </article>
      {result.others.length > 0 ? (
        <section className="help-others" aria-labelledby="help-others-title">
          <h3 id="help-others-title">{t("others", { count: result.others.length })}</h3>
          <ul className="help-rows">
            {result.others.map((article) => (
              <li key={article.key}>
                <Link href={articleHref(article)} className="help-row help-row-article">
                  <span className="help-row-title">{article.title}</span>
                  {compact ? null : <span className="help-row-body">{firstSentence(article.body)}</span>}
                  <span className="meta">{tCenter(`groups.${article.topic}`)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
