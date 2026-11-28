// Lot 74f (HUB-11 ; maquette 27 ; C-07) — un sujet du centre d'aide : ses articles, une ligne chacun (titre
// et première phrase, rien de coupé). Un sujet inconnu, ou sans article pour la personne (module non
// souscrit, autre public), n'existe pas : même réponse qu'une adresse inconnue (ARC-06, SEC-13).
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { requireSignedIn } from "@/lib/guards";
import { articleHref, isHelpTopic } from "@/lib/help/articles";
import { loadHelpArticles, loadHelpViewer } from "@/lib/help/help-center";
import { firstSentence } from "../../help-answers";

export default async function HelpTopicPage({ params }: { params: Promise<{ sujet: string }> }) {
  const auth = await requireSignedIn();
  const { sujet } = await params;
  if (!isHelpTopic(sujet)) notFound();
  const viewer = await loadHelpViewer(auth.user);
  const articles = (await loadHelpArticles(viewer)).filter((article) => article.topic === sujet);
  if (articles.length === 0) notFound();
  const t = await getTranslations("HelpHome");
  const tCenter = await getTranslations("HelpCenter");
  return (
    <main className="help-home">
      <p>
        <Link href="/aide">{t("topic.back")}</Link>
      </p>
      <h1>{tCenter(`groups.${sujet}`)}</h1>
      <p className="meta">{t("topics.count", { count: articles.length })}</p>
      <ul className="help-rows">
        {articles.map((article) => (
          <li key={article.key}>
            <Link href={articleHref(article)} className="help-row help-row-article">
              <span className="help-row-title">{article.title}</span>
              <span className="help-row-body">{firstSentence(article.body)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
