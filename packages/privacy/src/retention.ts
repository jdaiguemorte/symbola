// RGPD-05 — règles de conservation (cahier des charges § 6, décisions de
// Julien du 02/11/2026), pures et testées avec des dates simulées. Toutes
// les dates sont des jours (AAAA-MM-JJ, heure de Paris). Une donnée est
// échue le jour même de son échéance, jamais la veille.
import { addMonths } from "./deadlines";

export type RetentionMonths = {
  prospectRetentionMonths: number;
  clientRetentionMonths: number;
  inactiveAccountMonths: number;
};

function latest(dates: (string | null | undefined)[]): string | null {
  const present = dates.filter((date): date is string => typeof date === "string" && date !== "");
  return present.length > 0 ? present.sort().at(-1)! : null;
}

export function isExpired(today: string, dueOn: string): boolean {
  return dueOn <= today;
}

// Prospect sans suite : durée réglée après la dernière activité de la fiche
// (création, dernière modification, dernier changement de statut).
export function prospectDueOn(lastActivity: (string | null)[], months: RetentionMonths): string | null {
  const last = latest(lastActivity);
  return last ? addMonths(last, months.prospectRetentionMonths) : null;
}

// Client : durée réglée après la fin de la relation, la plus tardive entre
// la date de l'événement et le dernier encaissement. Sans aucune des deux, la
// relation n'est pas terminée : rien n'est échu.
export function clientDueOn(input: { eventDate: string | null; lastPaymentOn: string | null }, months: RetentionMonths): string | null {
  const end = latest([input.eventDate, input.lastPaymentOn]);
  return end ? addMonths(end, months.clientRetentionMonths) : null;
}

// Compte d'accès d'un marié : durée réglée sans connexion ; un compte qui ne
// s'est jamais connecté depuis le lot 6 part de sa date de création.
export function inactiveAccountDueOn(input: { lastLoginOn: string | null; createdOn: string }, months: RetentionMonths): string {
  return addMonths(input.lastLoginOn ?? input.createdOn, months.inactiveAccountMonths);
}

// RGPD-09 — preuve d'une demande d'exercice de droits close : gardée la durée
// réglée après le jour de sa clôture (5 ans par défaut, prescription civile,
// décision de Julien du 09/11/2026), puis anonymisée par la purge mensuelle
// validée. Une demande en cours n'est jamais échue.
export function requestProofDueOn(input: { closedOn: string | null }, months: { requestProofRetentionMonths: number }): string | null {
  return input.closedOn ? addMonths(input.closedOn, months.requestProofRetentionMonths) : null;
}
