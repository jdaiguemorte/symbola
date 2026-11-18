// Lot 45 (CRM-06 ; D2, D3 ; ADR 0090) — règles pures des relances d'un prospect. Une relance se
// compte depuis le dernier envoi de la planner (réponse depuis un modèle, envoyée ou préparée) : la
// relance de rang r est prête à ce jour plus ses jours, à la même heure de Paris (le passage à l'heure
// d'été ne la décale pas). Une relance ne se prépare que si les précédentes sont parties (ou retirées)
// et qu'aucun fait ne l'arrête ; les faits sont revérifiés juste avant l'envoi.
import type { EventStatus, FollowUpStep, FollowUpStopReason } from "@symbola/contracts";

const DAY_MS = 86_400_000;

// Décalage de Paris sur l'UTC à un instant, en minutes (60 l'hiver, 120 l'été).
function parisOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Europe/Paris",
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const value = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? 0);
  const local = Date.UTC(value("year"), value("month") - 1, value("day"), value("hour"), value("minute"), value("second"));
  return Math.round((local - Math.floor(at.getTime() / 1000) * 1000) / 60_000);
}

// Ajoute des jours de calendrier à Paris en gardant l'heure affichée.
export function addParisDays(at: Date, days: number): Date {
  const naive = new Date(at.getTime() + days * DAY_MS);
  return new Date(naive.getTime() - (parisOffsetMinutes(naive) - parisOffsetMinutes(at)) * 60_000);
}

export const FOLLOW_UP_DAYS_MIN = 1;
export const FOLLOW_UP_DAYS_MAX = 60;

export class FollowUpSettingsInvalidError extends Error {
  constructor(readonly reason: "too_many" | "days" | "order") {
    super(`réglage des relances invalide : ${reason}`);
    this.name = "FollowUpSettingsInvalidError";
  }
}

// Trois relances au plus, chacune après la précédente, entre 1 et 60 jours.
export function validateFollowUpSteps(steps: FollowUpStep[]): FollowUpStep[] {
  if (steps.length > 3) throw new FollowUpSettingsInvalidError("too_many");
  let previous = 0;
  for (const step of steps) {
    if (!Number.isInteger(step.days) || step.days < FOLLOW_UP_DAYS_MIN || step.days > FOLLOW_UP_DAYS_MAX) throw new FollowUpSettingsInvalidError("days");
    if (step.days <= previous) throw new FollowUpSettingsInvalidError("order");
    previous = step.days;
  }
  return steps.map((step) => ({ days: step.days, messageTemplateId: step.messageTemplateId }));
}

// Les faits connus de Symbola qui arrêtent une relance (D3) ; aucune lecture de la boîte e-mail.
export type FollowUpFacts = {
  status: EventStatus;
  // Dernier envoi de la planner (le point de départ des relances).
  anchorAt: Date;
  // « A répondu », noté par la planner.
  lastAnsweredAt: Date | null;
  // « Ne plus relancer », noté par la planner : vaut pour toujours.
  stoppedAt: Date | null;
  // Passage de la carte à une autre étape du pipeline.
  lastStageChangeAt: Date | null;
  // Le prospect a agi dans Symbola : portail ouvert, questionnaire, rendez-vous, signature.
  lastProspectActionAt: Date | null;
  // Envoi le plus récent de la planner (une réponse plus récente que le point de départ repart à zéro).
  lastPlannerMessageAt: Date | null;
};

function after(fact: Date | null, anchor: Date): boolean {
  return fact !== null && fact.getTime() > anchor.getTime();
}

// La raison d'arrêter, ou null : la relance peut partir.
export function followUpStopReason(facts: FollowUpFacts): FollowUpStopReason | null {
  if (facts.stoppedAt) return "stopped";
  if (facts.status === "cancelled") return "lost";
  if (facts.status !== "option") return "confirmed";
  if (after(facts.lastAnsweredAt, facts.anchorAt)) return "answered";
  if (after(facts.lastStageChangeAt, facts.anchorAt)) return "stage_changed";
  if (after(facts.lastProspectActionAt, facts.anchorAt)) return "prospect_action";
  if (after(facts.lastPlannerMessageAt, facts.anchorAt)) return "new_message";
  return null;
}

export type ExistingFollowUp = { rank: number; sentAt: Date | null; stoppedAt: Date | null; stopReason: FollowUpStopReason | null };

// La relance à préparer maintenant, s'il y en a une : la première absente dont le jour est venu,
// quand toutes celles d'avant sont parties ou retirées. Une relance arrêtée par un fait clôt la série.
export function nextFollowUpToPrepare(steps: FollowUpStep[], anchorAt: Date, now: Date, existing: ExistingFollowUp[]): { rank: number; readyAt: Date } | null {
  const byRank = new Map(existing.map((row) => [row.rank, row]));
  for (const [index, step] of steps.entries()) {
    const rank = index + 1;
    const row = byRank.get(rank);
    if (row) {
      if (row.sentAt || row.stopReason === "withdrawn") continue;
      return null;
    }
    const readyAt = addParisDays(anchorAt, step.days);
    return readyAt.getTime() <= now.getTime() ? { rank, readyAt } : null;
  }
  return null;
}

// AV-9 — la phrase de chaque relance (« Vous ne souhaitez plus de nouvelles ? Répondez simplement. »),
// ajoutée au texte s'il ne la porte pas déjà.
export function withOptOut(body: string, optOut: string): string {
  const text = body.replace(/\r\n/g, "\n").trim();
  return text.includes(optOut) ? text : `${text}\n\n${optOut}`;
}
