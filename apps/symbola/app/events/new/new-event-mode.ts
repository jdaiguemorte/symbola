// Lot 63c (EVT-01, HUB-07 ; maquette M7) — les trois façons de créer un évènement depuis le bouton
// « Nouveau » de la liste, et ce que chacune demande. Règles pures, sans base : testées seules.
//
// - « Prospect » : une demande à étudier ; un client et une source (PRD-EVT-07) ; rétroplanning
//   proposé décoché.
// - « Évènement confirmé » : en préparation d'emblée, client et source facultatifs (un shooting
//   photo) ; rétroplanning proposé coché.
// - « Pour un client existant » : un contact déjà connu, choisi par la recherche ; la planner dit si
//   c'est une demande à étudier ou un évènement confirmé.
export const NEW_EVENT_MODES = ["prospect", "confirmed", "client"] as const;
export type NewEventMode = (typeof NEW_EVENT_MODES)[number];

// Le paramètre `type` de l'adresse : `evenement` (déjà employé par l'agenda, L12-HUB-13) et `client`.
export function newEventModeOf(type: string | undefined): NewEventMode {
  if (type === "evenement") return "confirmed";
  if (type === "client") return "client";
  return "prospect";
}

export function newEventHref(mode: NewEventMode): string {
  if (mode === "confirmed") return "/events/new?type=evenement";
  if (mode === "client") return "/events/new?type=client";
  return "/events/new";
}

export type NewEventRules = {
  // Le premier client : un nom saisi ou un contact choisi.
  clientRequired: boolean;
  // Seul un contact existant convient (pas de saisie d'un nouveau nom).
  existingContactOnly: boolean;
  sourceRequired: boolean;
  // La case « Partir du rétroplanning » est cochée d'emblée.
  templateCheckedByDefault: boolean;
};

export function newEventRules(mode: NewEventMode, confirmed: boolean): NewEventRules {
  if (mode === "client") return { clientRequired: true, existingContactOnly: true, sourceRequired: !confirmed, templateCheckedByDefault: confirmed };
  if (mode === "confirmed") return { clientRequired: false, existingContactOnly: false, sourceRequired: false, templateCheckedByDefault: true };
  return { clientRequired: true, existingContactOnly: false, sourceRequired: true, templateCheckedByDefault: false };
}

// Le statut voulu : confirmé pour « Évènement confirmé », au choix pour un client existant.
export function isConfirmedChoice(mode: NewEventMode, status: string | null | undefined): boolean {
  if (mode === "confirmed") return true;
  if (mode === "client") return status === "confirmed";
  return false;
}
