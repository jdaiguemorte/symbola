// Lot 34a (EVT-05, ADR 0055 ; décisions D2 à D4) — règles du cycle de vie d'un événement, sans
// accès à la base : statut affiché (« Jour J » le jour même, dans le fuseau de l'événement),
// statuts posés à la main, report, clôture proposée, et les groupes de statuts que lisent les
// écrans (en cours, sûrs, provisoires).
import type { EventDisplayStep, EventPhase, EventStatus } from "@symbola/contracts";
import { dateInTimeZone } from "@symbola/i18n";

// Lot 72a (J1, ADR 0121) : « En préparation » retiré ; un évènement signé est « Confirmé ».
export const EVENT_STATUS_ORDER: readonly EventStatus[] = ["option", "confirmed", "closed", "postponed", "cancelled"];

// Frise : les étapes du cycle ; Reporté et Annulé sont des écarts, affichés à part.
export const TIMELINE_PHASES: readonly EventPhase[] = ["option", "confirmed", "day_of", "closed"];

// Posés à la main depuis la frise ; le report et l'annulation ont leur propre geste.
export const MANUAL_STATUSES: readonly EventStatus[] = ["option", "confirmed", "closed"];

// En cours : l'accueil, le portefeuille, l'alerte « même jour » et les tâches les lisent.
export const IN_PROGRESS_STATUSES: readonly EventStatus[] = ["option", "confirmed", "postponed"];

// Calendrier : sûrs (la date tient) ou provisoires (option, report en cours).
export const FIRM_STATUSES: readonly EventStatus[] = ["confirmed", "closed"];
export const TENTATIVE_STATUSES: readonly EventStatus[] = ["option", "postponed"];

// Terminés : ni tâche à faire, ni relance, ni rappel.
export const FINISHED_STATUSES: readonly EventStatus[] = ["closed", "cancelled"];

const LIVE_STATUSES: readonly EventStatus[] = ["confirmed"];

type Dated = { status: EventStatus; eventDate: string | null; timeZone: string };

export function isInProgress(status: EventStatus): boolean {
  return IN_PROGRESS_STATUSES.includes(status);
}

// D3 : « Jour J » s'applique de lui-même le jour de l'événement, dans son fuseau.
export function eventPhase(event: Dated, now: Date = new Date()): EventPhase {
  if (LIVE_STATUSES.includes(event.status) && event.eventDate !== null && event.eventDate === dateInTimeZone(now, event.timeZone)) return "day_of";
  return event.status;
}

// D3 : la clôture se propose dès le lendemain d'un événement confirmé.
export function closingDue(event: Dated, now: Date = new Date()): boolean {
  return LIVE_STATUSES.includes(event.status) && event.eventDate !== null && event.eventDate < dateInTimeZone(now, event.timeZone);
}

// D4 : seul un événement confirmé se reporte (une option change de date).
export function canPostpone(status: EventStatus): boolean {
  return LIVE_STATUSES.includes(status);
}

// Un statut posé à la main : pas depuis un report en cours (il se confirme ou s'annule) ni depuis
// une annulation (elle se réactive en Option).
export function canSetStatus(from: EventStatus, to: EventStatus): boolean {
  if (!MANUAL_STATUSES.includes(to) || from === to) return false;
  if (from === "postponed") return false;
  if (from === "cancelled") return to === "option";
  return true;
}

// Lot 72a (EVT-05 ; E1, J1) : l'étape de la frise (quatre : une demande, signé et en préparation, jour
// J, clôturé). Reporté et Annulé n'en ont pas : la frise laisse place à une ligne d'état.
export function displayStep(status: EventStatus, phase: EventPhase): EventDisplayStep | null {
  if (phase === "day_of") return "day_of";
  switch (status) {
    case "option":
      return "request";
    case "confirmed":
      return "signed";
    case "closed":
      return "closed";
    default:
      return null;
  }
}
