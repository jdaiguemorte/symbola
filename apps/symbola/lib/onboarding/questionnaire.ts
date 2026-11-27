// Lot 74a (HUB-09, HUB-10, PAR-01 ; C-68, D6, B1 à B6, R3 ; page 22 des maquettes du lot 68) — l'assistant de
// démarrage : cinq questions au plus, une par écran. 1 métier, 2 types d'évènements, 3 « Avez-vous déjà des
// mariages en cours ? », 4 « Où les suivez-vous aujourd'hui ? » (seulement après « Oui »), 5 « Vos devis
// portent-ils la TVA ? ». Les questions gardent leur numéro en base (`setup_step`) ; l'écran compte celles qui
// se posent (« question 4 sur 4 » pour la TVA après « Non »). Règles pures, sans base.
import { onboardingSuggestsTakeover } from "@symbola/starter-templates";

export const QUESTION_COUNT = 5;
export type QuestionNumber = 1 | 2 | 3 | 4 | 5;

export const ONGOING_ANSWERS = ["yes", "no"] as const;
export type OngoingAnswer = (typeof ONGOING_ANSWERS)[number];
export const VAT_ANSWERS = ["no", "yes", "unknown"] as const;
export type VatAnswer = (typeof VAT_ANSWERS)[number];

export function isOngoingAnswer(value: unknown): value is OngoingAnswer {
  return (ONGOING_ANSWERS as readonly unknown[]).includes(value);
}

export function isVatAnswer(value: unknown): value is VatAnswer {
  return (VAT_ANSWERS as readonly unknown[]).includes(value);
}

// La question des outils ne se pose qu'après « Oui » (D6, R3).
function asked(question: number, ongoing: OngoingAnswer | null): boolean {
  return question !== 4 || ongoing !== "no";
}

export function nextQuestion(question: number, ongoing: OngoingAnswer | null): QuestionNumber | null {
  for (let candidate = question + 1; candidate <= QUESTION_COUNT; candidate += 1) if (asked(candidate, ongoing)) return candidate as QuestionNumber;
  return null;
}

export function previousQuestion(question: number, ongoing: OngoingAnswer | null): QuestionNumber | null {
  for (let candidate = question - 1; candidate >= 1; candidate -= 1) if (asked(candidate, ongoing)) return candidate as QuestionNumber;
  return null;
}

// « Question n sur 5 », ou « sur 4 » quand la question des outils ne se pose pas. Le total ne bouge qu'avec la
// réponse « Non ».
export function questionDisplay(question: number, ongoing: OngoingAnswer | null): { number: number; total: number } {
  const total = ongoing === "no" ? QUESTION_COUNT - 1 : QUESTION_COUNT;
  let number = 0;
  for (let candidate = 1; candidate <= question; candidate += 1) if (asked(candidate, ongoing)) number += 1;
  return { number, total };
}

// Critère 2 : sur l'accueil, « {n} questions sur 5 restent » ; `current` est la question où elle s'est arrêtée.
export function questionsLeft(current: number, ongoing: OngoingAnswer | null): { left: number; total: number } {
  const { number, total } = questionDisplay(current, ongoing);
  return { left: total - number + 1, total };
}

// La question montrée : celle demandée si elle a déjà été vue (on revient sur une réponse, jamais en avant),
// sinon celle où elle s'est arrêtée. La question des outils ne s'ouvre jamais après « Non ».
export function reachableQuestion(requested: number | null, current: number, ongoing: OngoingAnswer | null): QuestionNumber {
  const fallback = (asked(current, ongoing) ? current : (nextQuestion(current, ongoing) ?? QUESTION_COUNT)) as QuestionNumber;
  if (requested === null || !Number.isInteger(requested) || requested < 1 || requested > current) return fallback;
  return (asked(requested, ongoing) ? requested : fallback) as QuestionNumber;
}

// B5, L74-D4 : « Je ne sais pas encore » garde la franchise en base et pose un drapeau ; aucun devis ne
// s'envoie tant qu'il est posé.
export function vatAnswerEffect(answer: VatAnswer): { regime: "franchise" | "assujetti"; pending: boolean } {
  if (answer === "yes") return { regime: "assujetti", pending: false };
  return { regime: "franchise", pending: answer === "unknown" };
}

// Critère 7 : un seul premier pas, en bouton plein. « Non » : créer ; « Oui » et un tableur ou un autre
// logiciel : reprendre ; « Oui » et le papier, l'agenda ou un traitement de texte seulement : entrer un
// mariage en cours. Un parcours non choisi (question 3 sans réponse, L74-D8) suit les outils, sinon crée.
export type ReadyOutcome = "create" | "takeover" | "enter";

export function readyOutcome(ongoing: OngoingAnswer | null, tools: readonly string[]): ReadyOutcome {
  if (ongoing === "no") return "create";
  if (onboardingSuggestsTakeover(tools)) return "takeover";
  return ongoing === "yes" ? "enter" : "create";
}
