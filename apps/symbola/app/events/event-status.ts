// EVT-02 — pastilles de statut de la charte (globals.css), partagées entre
// la liste, la fiche et l'agenda de l'accueil ; le libellé reste affiché.
import type { EventStatus } from "@/modules/events/service";

export const EVENT_STATUS_CLASSES: Record<EventStatus, string> = {
  prospect: "badge badge-bleu",
  quote_sent: "badge badge-ambre",
  confirmed: "badge badge-sauge",
  done: "badge",
  lost: "badge badge-terracotta",
};

export const STATUS_LABEL_KEYS: Record<EventStatus, string> = {
  prospect: "statusProspect",
  quote_sent: "statusQuoteSent",
  confirmed: "statusConfirmed",
  done: "statusDone",
  lost: "statusLost",
};
