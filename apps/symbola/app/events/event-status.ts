// PRD-EVT-02 — pastilles de statut de la charte (globals.css), partagées entre
// la liste, la fiche et l'agenda de l'accueil ; le libellé reste affiché.
// Lot 34a (EVT-05, ADR 0055) : statuts du cahier des charges, et « Jour J », affiché de lui-même.
import type { EventPhase } from "@/modules/events/service";

export const EVENT_STATUS_CLASSES: Record<EventPhase, string> = {
  option: "badge badge-bleu",
  confirmed: "badge badge-sauge",
  in_preparation: "badge badge-sauge",
  day_of: "badge badge-ambre",
  closed: "badge",
  postponed: "badge badge-ambre",
  cancelled: "badge badge-terracotta",
};

export const STATUS_LABEL_KEYS: Record<EventPhase, string> = {
  option: "statusOption",
  confirmed: "statusConfirmed",
  in_preparation: "statusInPreparation",
  day_of: "statusDayOf",
  closed: "statusClosed",
  postponed: "statusPostponed",
  cancelled: "statusCancelled",
};
