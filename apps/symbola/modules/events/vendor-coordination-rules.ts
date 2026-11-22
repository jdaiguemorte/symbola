// Lot 47 (PAR-05, PRE-03, PRE-04, BUD-05 ; D2, D3, D6, D8 ; ADR 0085) — règles pures des
// prestataires par lien. Sans base ni horloge implicite : chaque fonction reçoit le jour ou
// l'instant qu'elle juge ; les délais viennent des données de départ ou des réglages de
// l'organisation (CLAUDE.md § 2.6).
import { ENGAGED_CANDIDATE_STATUSES, type VendorCandidateStatus, type VendorLinkStage, type VendorRoadmapStage } from "@symbola/contracts";
import type { StarterVendorCoordination } from "@symbola/starter-templates";
import { addDays } from "./schedule";

type Policy = Pick<StarterVendorCoordination, "reminderDaysBefore" | "roadmapDaysBefore" | "choiceNoticeDays">;

const DAY_MS = 24 * 60 * 60 * 1000;

// D2 : la relance part la veille de la date limite ; une panne de la veille est rattrapée le jour
// même, jamais après.
export function briefReminderDue(deadline: string, today: string, policy: Pick<Policy, "reminderDaysBefore">): boolean {
  return today >= addDays(deadline, -policy.reminderDaysBefore) && today <= deadline;
}

// D8 : la feuille de route due ce jour (dans le fuseau de l'évènement). J-30 part trente jours
// avant et se rattrape jusqu'à la veille de J-7 ; J-7 part sept jours avant et se rattrape jusqu'à
// la veille de l'évènement. Rien le jour même.
export function roadmapStageDue(eventDate: string, today: string, enabled: { month: boolean; week: boolean }, policy: Pick<Policy, "roadmapDaysBefore">): VendorRoadmapStage | null {
  if (today >= eventDate) return null;
  const week = addDays(eventDate, -policy.roadmapDaysBefore.week);
  const month = addDays(eventDate, -policy.roadmapDaysBefore.month);
  if (today >= week) return enabled.week ? "j7" : null;
  if (today >= month) return enabled.month ? "j30" : null;
  return null;
}

// D8 : sans confirmation N jours après l'envoi de J-7, une alerte dans « Aujourd'hui ».
export function roadmapAlertDue(roadmap: { stage: VendorRoadmapStage; sentAt: Date; confirmedAt: Date | null }, now: Date, alertDays: number): boolean {
  return roadmap.stage === "j7" && roadmap.confirmedAt === null && now.getTime() >= roadmap.sentAt.getTime() + alertDays * DAY_MS;
}

// D6 : le choix d'un client est signalé dans « Aujourd'hui » quelques jours (simple affichage) ; la
// planner modifie le prestataire retenu à tout moment, sans délai.
export function choiceNoticeShown(engagedAt: Date, now: Date, policy: Pick<Policy, "choiceNoticeDays">): boolean {
  return now.getTime() < engagedAt.getTime() + policy.choiceNoticeDays * DAY_MS;
}

// BUD-05 : total d'un scénario au centime ; un devis sans montant compte « à préciser ».
export function scenarioTotals(lines: { amountCents: number | null }[]): { totalCents: number; pendingCount: number } {
  let totalCents = 0;
  let pendingCount = 0;
  for (const line of lines) {
    if (line.amountCents === null) pendingCount += 1;
    else totalCents += line.amountCents;
  }
  return { totalCents, pendingCount };
}

// PRE-03 : le comparatif trié par montant, les devis sans montant à la fin, puis par nom.
export function compareByAmount(a: { quoteAmountCents: number | null; vendorName: string }, b: { quoteAmountCents: number | null; vendorName: string }): number {
  if (a.quoteAmountCents === null && b.quoteAmountCents !== null) return 1;
  if (a.quoteAmountCents !== null && b.quoteAmountCents === null) return -1;
  if (a.quoteAmountCents !== null && b.quoteAmountCents !== null && a.quoteAmountCents !== b.quoteAmountCents) return a.quoteAmountCents - b.quoteAmountCents;
  return a.vendorName.localeCompare(b.vendorName, "fr");
}

const isEngaged = (status: VendorCandidateStatus) => ENGAGED_CANDIDATE_STATUSES.includes(status);

// D3 : un seul lien du brief au jour J ; le serveur ne montre que ce que le statut permet.
export function vendorLinkStage(candidate: { status: VendorCandidateStatus; briefId: string | null }): VendorLinkStage {
  if (isEngaged(candidate.status)) return "retained";
  if (candidate.status === "dismissed") return "declined";
  return candidate.briefId ? "consultation" : "none";
}

// Le prestataire répond, ou change d'avis, tant que la planner n'a pas tranché : aucun prestataire
// du poste n'est retenu, et lui n'a pas été écarté pour un autre.
export function vendorCanAnswer(candidate: { status: VendorCandidateStatus; dismissalReason: string | null; briefId: string | null }, slotDecided: boolean): boolean {
  if (!candidate.briefId || slotDecided || isEngaged(candidate.status)) return false;
  if (candidate.status === "dismissed") return candidate.dismissalReason === "unavailable";
  return true;
}

