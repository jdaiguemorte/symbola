// Lot 27b (POR-03, BUD-07, EVT-09 ; décisions D9 et D10) — règles pures des
// décisions demandées au client : qui peut les voir et y répondre, ce qu'une
// réponse doit contenir. Sans base ni horloge implicite.
import type { DecisionKind, DecisionSnapshot, LinkAccess } from "@symbola/contracts";

export const DECISION_COMMENT_MAX = 500;
export const DECISION_NOTE_MAX = 500;

// D10 : toute personne dont le lien ouvre la rubrique concernée (Options,
// Budget avec la catégorie, Programme) ; jamais un lien de prestataire.
export function decisionOpenTo(decision: { kind: DecisionKind; slotId: string | null }, access: Pick<LinkAccess, "audience" | "rights">): boolean {
  if (access.audience !== "client") return false;
  const { rubrics, budgetScope, sharedSlotIds } = access.rights;
  if (decision.kind === "option") return rubrics.includes("vendor_options");
  if (decision.kind === "program") return rubrics.includes("program");
  return rubrics.includes("budget") && (budgetScope === "all" || (decision.slotId !== null && sharedSlotIds.includes(decision.slotId)));
}

export type AnswerProblem = "choice" | "comment" | null;

// Une option se choisit parmi celles figées à la demande ; on la valide ou on
// la refuse sans en choisir pour les autres sortes.
export function answerProblem(snapshot: DecisionSnapshot, answer: { answer: "approved" | "declined"; choiceId: string | null; comment: string | null }): AnswerProblem {
  if ((answer.comment ?? "").length > DECISION_COMMENT_MAX) return "comment";
  if (snapshot.kind === "option") {
    if (answer.answer !== "approved") return answer.choiceId === null ? null : "choice";
    return answer.choiceId !== null && snapshot.options.some((option) => option.candidateId === answer.choiceId) ? null : "choice";
  }
  return answer.choiceId === null ? null : "choice";
}

// Le programme approuvé a-t-il changé depuis ? (version = dernière modification)
export function programChangedSince(snapshot: DecisionSnapshot, currentUpdatedAt: string | null): boolean {
  return snapshot.kind === "program" && snapshot.programUpdatedAt !== currentUpdatedAt;
}
