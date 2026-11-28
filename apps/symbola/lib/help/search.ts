// Lot 74f (HUB-12, HUB-11, UX-10 ; spécification du lot 74, § 6.6 ; maquette 27 ; C-07) — le moteur de la
// recherche de l'aide. Il lit une phrase : les petits mots écartés (« mes », « comment »), chaque mot gardé
// rapproché de ses mots voisins (« importer », « reprendre » ; « contacts », « clients »), une faute de frappe
// tolérée sur les mots longs. Il classe les articles par le nombre d'idées de la phrase qu'ils couvrent, puis
// par l'endroit où ils les disent (titre, puis texte, puis questions fréquentes), et rend une meilleure
// réponse et quatre autres au plus. Sans état ni service extérieur : les articles et les mots lui sont
// donnés (lib/help/articles.ts côté serveur, les fichiers de messages dans les tests). Il ne journalise
// rien : une phrase cherchée n'est écrite nulle part (SEC-20).
import { foldSearchText } from "@symbola/db/search";

export type HelpLexicon = { stopWords: readonly string[]; synonyms: readonly (readonly string[])[] };

export type HelpArticle = {
  key: string;
  // Le sujet (rubrique) de l'article.
  topic: string;
  title: string;
  body: string;
  // Les mots de la planner pour cet article (« Help.<clé>.keywords »), comptés presque comme le titre.
  keywords: string;
  // Les questions fréquentes, en un texte.
  faq: string;
  // Le résumé en étapes, montré par la meilleure réponse (peut être vide).
  steps: readonly string[];
  // L'écran concerné, s'il s'ouvre d'une adresse ; null pour un écran propre à un élément.
  screenHref: string | null;
};

export type HelpSearchHit = { article: HelpArticle; score: number; concepts: number };

export type HelpSearchResult = {
  // Les mots de la phrase gardés, dans l'ordre (« importer », « contacts ») : « Compris : … ».
  understood: string[];
  best: HelpArticle | null;
  others: HelpArticle[];
};

export const HELP_SEARCH_OTHERS = 4;
export const HELP_SEARCH_MAX_WORDS = 8;
// La recherche à la frappe part à trois lettres (maquette 27).
export const HELP_SEARCH_MIN_LENGTH = 3;

const FIELD_WEIGHT = { title: 6, keywords: 5, body: 3, faq: 1 } as const;
// Un mot voisin compte un peu moins que le mot écrit.
const SYNONYM_FACTOR = 0.7;

function tokens(text: string): string[] {
  return foldSearchText(text)
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 0);
}

// Les mots tels qu'écrits (minuscules, accents gardés), alignés sur `tokens` : « consœur » reste « consœur »
// dans « Compris : … ».
function writtenTokens(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

// Distance d'édition bornée (au plus 2), pour les fautes de frappe.
function editDistance(a: string, b: string, limit: number): number {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let previous = Array.from({ length: b.length + 1 }, (_, index) => index);
  for (let i = 1; i <= a.length; i += 1) {
    const current = [i];
    let rowMin = i;
    for (let j = 1; j <= b.length; j += 1) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      const value = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
      current.push(value);
      rowMin = Math.min(rowMin, value);
    }
    if (rowMin > limit) return limit + 1;
    previous = current;
  }
  return previous[b.length]!;
}

// Un mot de la phrase et un mot de l'article se valent : égaux ; l'un est le début de l'autre (« import »,
// « importer » ; « contact », « contacts ») ; ou une faute de frappe sur un mot long (« prestatair »). Le
// rapprochement avec un groupe de mots voisins ne tolère pas de faute : « contrat » n'est pas « contact ».
export function sameWord(term: string, word: string): boolean {
  if (term === word) return true;
  const [shorter, longer] = term.length <= word.length ? [term, word] : [word, term];
  return longer.startsWith(shorter) && (shorter.length >= 5 || (shorter.length >= 4 && longer.length - shorter.length <= 2));
}

export function wordsMatch(term: string, word: string): boolean {
  if (sameWord(term, word)) return true;
  if (term.length >= 5 && word.length >= 4) return editDistance(term, word, term.length >= 8 ? 2 : 1) <= (term.length >= 8 ? 2 : 1);
  return false;
}

type Concept = {
  // Ce que la phrase a écrit (pour « Compris : … »).
  label: string;
  // Le mot écrit, puis ses voisins ; une expression garde ses espaces.
  words: { text: string; direct: boolean }[];
};

// La phrase lue : les expressions connues d'abord (« plan de table »), puis les mots ; les petits mots
// écartés ; deux mots du même groupe ne font qu'une idée (« tableau excel »), où chacun compte comme écrit.
export function readQuery(query: string, lexicon: HelpLexicon): Concept[] {
  const stop = new Set(lexicon.stopWords.map((word) => foldSearchText(word)));
  const groups = lexicon.synonyms.map((group) => group.map((word) => tokens(word).join(" ")));
  const folded = tokens(query);
  const written = writtenTokens(query);
  const label = (from: number, count: number) => (written.length === folded.length ? written : folded).slice(from, from + count).join(" ");
  const used = new Array<boolean>(folded.length).fill(false);
  const byGroup = new Map<number, { concept: Concept; position: number }>();
  const loose: { concept: Concept; position: number }[] = [];
  // Expressions de plusieurs mots, les plus longues d'abord.
  const phrases = groups
    .flatMap((group, index) => group.filter((word) => word.includes(" ")).map((word) => ({ index, words: word.split(" ") })))
    .sort((a, b) => b.words.length - a.words.length);
  for (const phrase of phrases) {
    for (let at = 0; at + phrase.words.length <= folded.length; at += 1) {
      if (phrase.words.some((word, offset) => used[at + offset] || folded[at + offset] !== word)) continue;
      phrase.words.forEach((_, offset) => (used[at + offset] = true));
      const text = phrase.words.join(" ");
      const existing = byGroup.get(phrase.index);
      if (existing) existing.concept.words.push({ text, direct: true });
      else byGroup.set(phrase.index, { concept: { label: label(at, phrase.words.length), words: groupWords(groups[phrase.index]!, text) }, position: at });
    }
  }
  folded.forEach((raw, position) => {
    if (used[position] || stop.has(raw) || raw.length < 2) return;
    const index = groups.findIndex((group) => group.some((word) => !word.includes(" ") && sameWord(raw, word)));
    if (index === -1) {
      loose.push({ concept: { label: label(position, 1), words: [{ text: raw, direct: true }] }, position });
      return;
    }
    const existing = byGroup.get(index);
    if (existing) {
      if (!existing.concept.words.some((word) => word.text === raw && word.direct)) existing.concept.words.push({ text: raw, direct: true });
      return;
    }
    byGroup.set(index, { concept: { label: label(position, 1), words: [{ text: raw, direct: true }, ...groupWords(groups[index]!, raw).filter((word) => word.text !== raw)] }, position });
  });
  return [...byGroup.values(), ...loose]
    .sort((a, b) => a.position - b.position)
    .slice(0, HELP_SEARCH_MAX_WORDS)
    .map((entry) => entry.concept);
}

function groupWords(group: readonly string[], written: string): { text: string; direct: boolean }[] {
  return group.map((word) => ({ text: word, direct: word === written }));
}

type Field = { words: string[]; text: string };
type IndexedArticle = { article: HelpArticle; title: Field; keywords: Field; body: Field; faq: Field };

function field(text: string): Field {
  const words = tokens(text);
  return { words, text: ` ${words.join(" ")} ` };
}

export function indexArticles(articles: readonly HelpArticle[]): IndexedArticle[] {
  return articles.map((article) => ({
    article,
    title: field(article.title),
    keywords: field(article.keywords),
    body: field(`${article.body} ${article.steps.join(" ")}`),
    faq: field(article.faq),
  }));
}

function fieldHas(target: Field, candidate: string): boolean {
  if (candidate.includes(" ")) return target.text.includes(` ${candidate} `);
  return target.words.some((word) => wordsMatch(candidate, word));
}

// Le poids d'une idée dans un article : le meilleur endroit où l'un de ses mots est dit.
function conceptScore(concept: Concept, indexed: IndexedArticle): number {
  let best = 0;
  for (const word of concept.words) {
    const candidate = word.text;
    if (!candidate) continue;
    const factor = word.direct ? 1 : SYNONYM_FACTOR;
    for (const name of ["title", "keywords", "body", "faq"] as const) {
      if (FIELD_WEIGHT[name] * factor <= best) break;
      if (fieldHas(indexed[name], candidate)) {
        best = FIELD_WEIGHT[name] * factor;
        break;
      }
    }
  }
  return best;
}

// La part du titre que la phrase couvre : « Reprendre et importer » (tout) passe devant « Confirmer un
// import » (moitié) pour « import ».
function titleCoverage(concepts: Concept[], indexed: IndexedArticle, stop: Set<string>): number {
  const words = indexed.title.words.filter((word) => !stop.has(word));
  if (words.length === 0) return 0;
  const candidates = concepts.flatMap((concept) => concept.words.map((word) => word.text));
  const inPhrase = new Set(candidates.filter((text) => text.includes(" ") && indexed.title.text.includes(` ${text} `)).flatMap((text) => text.split(" ")));
  const covered = words.filter((word) => inPhrase.has(word) || candidates.some((text) => !text.includes(" ") && wordsMatch(text, word)));
  return covered.length / words.length;
}

export function rankArticles(query: string, articles: readonly HelpArticle[] | readonly IndexedArticle[], lexicon: HelpLexicon): { concepts: Concept[]; hits: HelpSearchHit[] } {
  const concepts = readQuery(query, lexicon);
  if (concepts.length === 0) return { concepts, hits: [] };
  const indexed = (articles.length > 0 && "keywords" in articles[0]! && typeof (articles[0] as IndexedArticle).keywords === "object" ? articles : indexArticles(articles as readonly HelpArticle[])) as IndexedArticle[];
  const stop = new Set(lexicon.stopWords.map((word) => foldSearchText(word)));
  // Une phrase de plusieurs idées : un article doit en couvrir au moins la moitié.
  const needed = Math.max(1, Math.ceil(concepts.length / 2));
  const hits: HelpSearchHit[] = [];
  for (const entry of indexed) {
    const scores = concepts.map((concept) => conceptScore(concept, entry));
    const covered = scores.filter((score) => score > 0).length;
    if (covered < needed) continue;
    const score = covered * 10 + scores.reduce((sum, value) => sum + value, 0) + 4 * titleCoverage(concepts, entry, stop) + (entry.article.screenHref ? 1 : 0);
    hits.push({ article: entry.article, score, concepts: covered });
  }
  hits.sort((a, b) => b.score - a.score || a.article.title.localeCompare(b.article.title));
  return { concepts, hits };
}

export function searchHelp(query: string, articles: readonly HelpArticle[] | readonly IndexedArticle[], lexicon: HelpLexicon): HelpSearchResult {
  const { concepts, hits } = rankArticles(query, articles, lexicon);
  const [best, ...others] = hits;
  return {
    understood: concepts.map((concept) => concept.label),
    best: best?.article ?? null,
    others: others.slice(0, HELP_SEARCH_OTHERS).map((hit) => hit.article),
  };
}
