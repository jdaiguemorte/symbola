// Lot 13 (L13-EVT-19) — bandeau « Prochaine étape » de la fiche événement ; réécrit au lot 72e (EVT-02,
// UX-01 ; C-24, C-55, P-05, P-08 ; page 16 des maquettes du lot 68) : **une seule suite** par mariage, en
// tête de la Synthèse, dont la forme suit l'état. Plus de bandeau à part : une étape en attente (le
// programme à trois mois, le lien des mariés, la simulation du budget à confirmer) est une ligne de la
// suite. Règle pure, sans base : la page lui donne l'état lu par les modules.
//
// Ordre (première règle qui s'applique) :
// 1. reporté, annulé, clôturé ou archivé : rien (la ligne d'état de la frise porte la seule suite) ;
// 2. repris, tant que « À compléter après la reprise » a un point (lot 71f) : ce bloc ;
// 3. le lendemain du jour J, tant que l'évènement n'est pas clôturé : « Clôturer l'évènement… » ;
// 4. une demande en cours : le devis à envoyer ; envoyé, sa relance ; signé, le passage en signé (jamais
//    « faire signer » ce qui l'est) ; sans le module Devis, les points de la demande ;
// 5. signé sans tâches : « Créer la liste des tâches » ;
// 6. sinon, les points de l'évènement (les mêmes que l'accueil), et les étapes en attente en lignes.
import type { EventStatus } from "@/modules/events/service";

export type PendingStep = "prepare_program" | "invite_clients" | "confirm_budget";

// Le devis le plus avancé de l'évènement (null : aucun).
export type SuiteQuote = { id: string; number: string | null; status: "draft" | "sent" | "signed"; sentOn: string | null } | null;

export type SuiteInput = {
  status: EventStatus;
  archived: boolean;
  isDemo: boolean;
  quotesAvailable: boolean;
  quote: SuiteQuote;
  taskCount: number;
  templateCount: number;
  eventDate: string | null;
  programItemCount: number;
  clientLinkCount: number;
  // PRD-BUD-01/02 : une simulation existe et aucune ligne de budget n'a encore été créée.
  budgetSimulationPending: boolean;
  // Lot 71f : « À compléter après la reprise » a encore un point.
  takeoverOpen: boolean;
  // Lot 58 (PAR-09) : le lendemain du jour J, dans le fuseau de l'évènement.
  closingDue: boolean;
  today: string;
};

export type Suite =
  | { kind: "none" }
  | { kind: "takeover" }
  | { kind: "close" }
  | { kind: "send_quote"; draftId: string | null }
  | { kind: "follow_quote"; quoteId: string; number: string | null; sentOn: string | null }
  | { kind: "quote_signed"; quoteId: string; number: string | null }
  | { kind: "enquiry" }
  | { kind: "create_tasks"; withTemplate: boolean; needsDate: boolean }
  | { kind: "lines"; steps: PendingStep[] };

// Le programme se prépare dans les 3 mois qui précèdent l'événement.
function withinThreeMonths(eventDate: string, today: string): boolean {
  const limit = new Date(`${today}T00:00:00Z`);
  limit.setUTCMonth(limit.getUTCMonth() + 3);
  return eventDate >= today && eventDate <= limit.toISOString().slice(0, 10);
}

// Les étapes de la préparation qui attendent (règle du lot 13, gardée) : chacune devient une ligne.
export function pendingSteps(input: Pick<SuiteInput, "isDemo" | "eventDate" | "programItemCount" | "clientLinkCount" | "budgetSimulationPending" | "today">): PendingStep[] {
  if (input.isDemo) return [];
  const steps: PendingStep[] = [];
  if (input.budgetSimulationPending) steps.push("confirm_budget");
  if (input.programItemCount === 0 && input.eventDate && withinThreeMonths(input.eventDate, input.today)) steps.push("prepare_program");
  if (input.clientLinkCount === 0) steps.push("invite_clients");
  return steps;
}

export function eventSuite(input: SuiteInput): Suite {
  if (input.archived || input.status === "postponed" || input.status === "cancelled" || input.status === "closed") return { kind: "none" };
  if (input.takeoverOpen) return { kind: "takeover" };
  if (input.closingDue && !input.isDemo) return { kind: "close" };
  if (input.status === "option") {
    if (!input.quotesAvailable || input.isDemo) return { kind: "enquiry" };
    const quote = input.quote;
    if (quote?.status === "signed") return { kind: "quote_signed", quoteId: quote.id, number: quote.number };
    if (quote?.status === "sent") return { kind: "follow_quote", quoteId: quote.id, number: quote.number, sentOn: quote.sentOn };
    return { kind: "send_quote", draftId: quote?.status === "draft" ? quote.id : null };
  }
  if (input.taskCount === 0 && !input.isDemo) return { kind: "create_tasks", withTemplate: input.templateCount > 0, needsDate: input.eventDate === null };
  return { kind: "lines", steps: pendingSteps(input) };
}

// Le devis qui dit où en est la demande : signé, sinon envoyé (le plus récent), sinon un brouillon.
export function suiteQuote(quotes: readonly { id: string; number: string | null; status: string; sentAt?: string | null; createdAt?: string }[]): SuiteQuote {
  const rank = (status: string) => (status === "signed" ? 3 : status === "sent" ? 2 : status === "draft" ? 1 : 0);
  const best = [...quotes].filter((quote) => rank(quote.status) > 0).sort((a, b) => rank(b.status) - rank(a.status) || (b.sentAt ?? b.createdAt ?? "").localeCompare(a.sentAt ?? a.createdAt ?? ""))[0];
  if (!best) return null;
  const status = rank(best.status) === 3 ? "signed" : rank(best.status) === 2 ? "sent" : "draft";
  return { id: best.id, number: best.number, status, sentOn: best.sentAt ? best.sentAt.slice(0, 10) : null };
}
