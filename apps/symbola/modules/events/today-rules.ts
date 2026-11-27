// Lot 71a (HUB-08, HUB-14, C-53 ; décisions I1 et I2 de Julien du 27/11/2026) — la règle de « Contrat de …
// à faire signer » (findUncontractedVendors, today-sources.ts), écrite en règle pure : un prestataire
// retenu, sans contrat signé, sur un évènement en cours dont la date n'est pas passée ; une relance notée
// le retire jusqu'à son rappel (lot 65d). Un prestataire retenu par une reprise (contrat déclaré, signé
// ou non) n'y paraît jamais d'office : seulement le jour du rappel d'une relance notée par la planner.
import type { EventStatus, TakeoverContract } from "@symbola/contracts";

export const CONTRACT_REMINDER_CLOSED_STATUSES: readonly EventStatus[] = ["cancelled", "closed"];

export type ContractReminderFacts = {
  status: string;
  takeoverContract: TakeoverContract | null;
  eventDate: string | null;
  eventStatus: EventStatus;
  isDemo: boolean;
  // Date de rappel de la relance notée la plus lointaine, ou null.
  reminderRecallOn: string | null;
};

export function needsContractReminder(facts: ContractReminderFacts, today: string): boolean {
  if (facts.status !== "retained" || facts.isDemo || CONTRACT_REMINDER_CLOSED_STATUSES.includes(facts.eventStatus)) return false;
  if (facts.eventDate !== null && facts.eventDate < today) return false;
  if (facts.reminderRecallOn !== null && facts.reminderRecallOn > today) return false;
  if (facts.takeoverContract !== null) return facts.reminderRecallOn !== null && facts.reminderRecallOn <= today;
  return true;
}
