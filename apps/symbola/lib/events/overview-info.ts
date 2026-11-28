// Lot 72e (EVT-02, EVT-03 ; C-28, C-55, P-05, P-09 ; page 16 des maquettes du lot 68) — ce que la Synthèse
// dit en mots, sans base : les lignes d'« Informations » (une valeur absente dit « non renseigné » et mène à
// la rubrique de « Modifier les informations » qui la remplit) et les nombres d'« Où en est le mariage »
// (rien n'est dit complet qui ne l'est pas ; zéro tâche n'a pas d'avis).
import type { DetailsRubric } from "./event-details";

export type InformationInput = {
  clients: string[];
  guests: { estimated: number | null; confirmed: number | null; answered: number | null };
  places: string[];
  wantedBudgetCents: number | null;
  style: string | null;
  type: string | null;
  source: string | null;
  // La plage occupée en mots (lot 64) ; null : pas encore de date, donc rien de bloqué.
  busy: string | null;
  // Prénoms, la planner principale nommée ; une planner seule n'a pas de ligne « Équipe ».
  team: { members: string[]; soloPlanner: boolean };
  // « hidden » : des notes confidentielles que la personne ne lit pas (lot 48a).
  notes: { kind: "text"; text: string | null } | { kind: "hidden" };
};

export type InformationKey = "clients" | "guests" | "places" | "wantedBudget" | "style" | "type" | "source" | "busy" | "team" | "notes";

// `rubric` : où la valeur se change (null : ailleurs, l'écran de l'équipe).
export type InformationRow = { key: InformationKey; missing: boolean; rubric: DetailsRubric | null };

export function informationRows(input: InformationInput): InformationRow[] {
  const guestsKnown = input.guests.estimated !== null || input.guests.confirmed !== null || input.guests.answered !== null;
  const rows: InformationRow[] = [
    { key: "clients", missing: input.clients.length === 0, rubric: "clients" },
    { key: "guests", missing: !guestsKnown, rubric: "guests" },
    { key: "places", missing: input.places.length === 0, rubric: "dates" },
    { key: "wantedBudget", missing: input.wantedBudgetCents === null, rubric: "guests" },
    { key: "style", missing: !input.style, rubric: "style" },
    { key: "type", missing: !input.type, rubric: "origin" },
    { key: "source", missing: !input.source, rubric: "origin" },
    { key: "busy", missing: input.busy === null, rubric: "dates" },
  ];
  if (!input.team.soloPlanner) rows.push({ key: "team", missing: input.team.members.length === 0, rubric: null });
  rows.push({ key: "notes", missing: input.notes.kind === "text" && !input.notes.text, rubric: "style" });
  return rows;
}

export type ProgressInput = {
  tasks: { done: number; total: number; late: number };
  // Lot 71f (I7) : postes complets (un prestataire retenu et un prévu connu) sur les postes requis ; un
  // contrat attendu : un prestataire retenu dont le contrat n'est pas signé.
  vendors: { complete: number; total: number; contractsAwaited: number };
  decisions: { pending: number; since: string | null };
};

export type ProgressFacts = {
  tasks: { kind: "none" } | { kind: "count"; done: number; total: number; late: number };
  vendors: { kind: "none" } | { kind: "count"; complete: number; total: number; contractsAwaited: number };
  decisions: { kind: "none" } | { kind: "pending"; count: number; since: string | null };
};

export function progressFacts(input: ProgressInput): ProgressFacts {
  return {
    tasks: input.tasks.total === 0 ? { kind: "none" } : { kind: "count", ...input.tasks },
    vendors: input.vendors.total === 0 ? { kind: "none" } : { kind: "count", ...input.vendors },
    decisions: input.decisions.pending === 0 ? { kind: "none" } : { kind: "pending", count: input.decisions.pending, since: input.decisions.since },
  };
}
