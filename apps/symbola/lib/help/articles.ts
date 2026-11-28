// Lot 74f (HUB-11, HUB-12 ; spécification du lot 74, § 6.6 ; maquette 27) — les articles du centre d'aide :
// un article par écran de l'aide (lib/help/screens.ts), avec son titre, son texte, ses questions fréquentes
// et, pour certains, un résumé en étapes (« Help.<clé>.steps »). Un seul mot pour l'objet : « article » (C-07).
// Construits des messages traduits, jamais de constantes dans le code ; un article d'un module non souscrit,
// d'un autre public ou réservé à la titulaire n'est jamais construit pour la personne (ARC-06, SEC-13).
import type { HelpArticle } from "./search";
import { HELP_GROUP_ORDER, helpScreenHref, screensFor, type HelpGroup, type HelpScreen, type HelpViewer } from "./screens";

export type HelpMessage = { title?: string; body?: string; faq?: { q: string; a: string }[]; steps?: string[]; keywords?: string };

// L'adresse d'un écran qui s'ouvre tel quel (sans élément) ; une ancre de réglage s'ouvre aussi.
function screenHref(screen: HelpScreen): string | null {
  return screen.path;
}

export function articlesFor(viewer: HelpViewer, help: Record<string, HelpMessage | undefined>): HelpArticle[] {
  return screensFor(viewer).flatMap((screen) => {
    const message = help[screen.key];
    if (!message?.title) return [];
    return [
      {
        key: screen.key,
        topic: screen.group,
        title: message.title,
        body: message.body ?? "",
        keywords: message.keywords ?? "",
        faq: (message.faq ?? []).map((item) => `${item.q} ${item.a}`).join(" "),
        steps: message.steps ?? [],
        screenHref: screenHref(screen),
      },
    ];
  });
}

export type HelpTopicCount = { topic: HelpGroup; count: number };

// Les sujets de la personne, dans l'ordre du centre d'aide, avec leur nombre d'articles ; un sujet vide
// n'est pas montré.
export function topicCounts(articles: readonly HelpArticle[]): HelpTopicCount[] {
  return HELP_GROUP_ORDER.map((topic) => ({ topic, count: articles.filter((article) => article.topic === topic).length })).filter((entry) => entry.count > 0);
}

export function isHelpTopic(value: string): value is HelpGroup {
  return (HELP_GROUP_ORDER as readonly string[]).includes(value);
}

export function helpTopicHref(topic: HelpGroup): string {
  return `/aide/sujets/${topic}`;
}

export function articleHref(article: Pick<HelpArticle, "key">): string {
  return helpScreenHref(article.key);
}
