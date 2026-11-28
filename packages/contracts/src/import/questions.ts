// Lot 71a (HUB-14, UX-10 ; spécification du lot 71, § 4.4 ; ADR 0119) — les réponses de l'étape
// « Questions » de l'assistant d'import (écran du paquet 71c), gardées dans hub.imports.matching. Aucune
// réponse n'est cochée d'avance : une question sans réponse est absente. Un import commencé avant le lot
// n'a pas de réponses et se termine avec les règles d'avant.

export const DEPOSITS_PAID_ANSWERS = ["yes", "no", "some"] as const;
export const CONTRACTS_ANSWERS = ["all", "none", "per_line"] as const;
export const PAST_DUE_TASKS_ANSWERS = ["keep", "redate", "done"] as const;
export const EVENT_STAGE_ANSWERS = ["enquiry", "signed"] as const;
export const NAME_CASE_ANSWERS = ["app", "keep"] as const;

export type ImportAnswers = {
  // Le mariage visé, quand le fichier n'a pas de colonne pour le désigner (contrôlé par le service).
  targetEvent?: string;
  // Lot 71c (C-52) : « Un mariage qui n'est pas encore dans Symbola » : son nom et sa date ; il est
  // créé à l'écriture de l'import, avec sa reprise. Exclusif de targetEvent.
  newEvent?: { name: string; eventDate: string | null };
  // « Les montants de l'acompte ont-ils été payés ? » ; « some » : les lignes du fichier (rowIndex)
  // dont l'acompte est payé.
  depositsPaid?: { answer: (typeof DEPOSITS_PAID_ANSWERS)[number]; paidRows?: number[] };
  // « Leurs contrats sont-ils signés ? » (décision I1) ; « per_line » : les lignes signées.
  contracts?: { answer: (typeof CONTRACTS_ANSWERS)[number]; signedRows?: number[] };
  // Tâches non faites à l'échéance passée (R16) ; « redate » : la nouvelle date (AAAA-MM-JJ).
  pastDueTasks?: { answer: (typeof PAST_DUE_TASKS_ANSWERS)[number]; date?: string };
  // Le type d'évènement (un des types de l'organisation), et où en est le mariage.
  eventTypeId?: string;
  eventStage?: (typeof EVENT_STAGE_ANSWERS)[number];
  // La source du prospect, facultative ; absente : « non renseignée ».
  prospectSourceId?: string;
  // Noms et villes à la casse de l'app (par défaut) ou tels qu'écrits dans le fichier.
  nameCase?: (typeof NAME_CASE_ANSWERS)[number];
};

// Le contrat d'un prestataire retenu par une reprise, selon la réponse (I1) ; sans réponse,
// « non renseigné ». Jamais une relance d'office (I2).
export type TakeoverContract = "signed" | "unsigned" | "unknown";

export function takeoverContractFor(answers: ImportAnswers | null | undefined, rowIndex: number): TakeoverContract {
  const contracts = answers?.contracts;
  if (!contracts) return "unknown";
  if (contracts.answer === "all") return "signed";
  if (contracts.answer === "none") return "unsigned";
  return (contracts.signedRows ?? []).includes(rowIndex) ? "signed" : "unsigned";
}

// L'acompte d'une ligne du fichier est-il payé ? null : la question n'a pas été posée (règle d'avant).
export function depositPaidFor(answers: ImportAnswers | null | undefined, rowIndex: number): boolean | null {
  const deposits = answers?.depositsPaid;
  if (!deposits) return null;
  if (deposits.answer === "yes") return true;
  if (deposits.answer === "no") return false;
  return (deposits.paidRows ?? []).includes(rowIndex);
}

// « Où en est-il ? » : les mots de « Nouvel évènement » (A10 du lot 70).
export function eventStatusForStage(stage: (typeof EVENT_STAGE_ANSWERS)[number]): "option" | "confirmed" {
  return stage === "signed" ? "confirmed" : "option";
}

// Lot 71c (HUB-14, UX-10 ; maquette 07) — les questions de l'étape « Questions », dans l'ordre où
// l'écran les pose. `prospectSource` est facultative ; les autres attendent une réponse.
export const IMPORT_QUESTION_KEYS = ["targetEvent", "depositsPaid", "contracts", "eventType", "eventStage", "prospectSource", "pastDueTasks"] as const;
export type ImportQuestionKey = (typeof IMPORT_QUESTION_KEYS)[number];
