// Lot 31b (FAC-04, DOC-02, JUR-07 ; décisions D7 et D8) — texte des contrats, sans accès à la
// base : variables entre accolades (liste fixe et documentée), résolution, variables
// manquantes ou inconnues, clauses encore à rédiger ; alerte sur l'information légale à
// présenter selon le régime (canal de conclusion et catégorie du client) ; concordance de la
// clause des sommes versées d'avance ; fin du délai de rétractation. Les règles viennent des
// réponses de l'avocat du 13/11/2026, en données (packages/starter-templates/src/contract-rules.json).
import type { ClientCategoryKey, ConclusionChannelKey, ContractClauseRoleKey, ContractRules } from "@symbola/starter-templates";

export const CONTRACT_VARIABLES = [
  "client.noms",
  "evenement.date",
  "evenement.lieu",
  "devis.numero",
  "devis.total_ttc",
  "devis.echeancier",
  "devis.acompte_ou_arrhes",
  "organisation.nom",
  "organisation.adresse",
  "organisation.siren",
  "organisation.assurance",
  "organisation.mediateur",
  "contrat.date",
  "retractation.delai",
] as const;
export type ContractVariable = (typeof CONTRACT_VARIABLES)[number];
export type ContractVariableValues = Record<ContractVariable, string | null>;

const KNOWN = new Set<string>(CONTRACT_VARIABLES);
const VARIABLE = /\{([a-z_]+(?:\.[a-z_]+)+)\}/g;

export function isContractVariable(name: string): name is ContractVariable {
  return KNOWN.has(name);
}

// Variables citées dans un texte, dans l'ordre, sans doublon.
export function variablesIn(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(VARIABLE)) {
    if (!found.includes(match[1]!)) found.push(match[1]!);
  }
  return found;
}

export type ContractClauseText = { title: string; body: string; role: ContractClauseRoleKey | null };

export type ContractTextCheck = {
  // Clauses résolues ; une variable sans valeur reste écrite entre accolades.
  clauses: ContractClauseText[];
  // Variables connues sans valeur, dans l'ordre d'apparition (« Lieu de l'événement : vide »).
  missing: ContractVariable[];
  // Noms entre accolades qui ne sont pas des variables (faute de frappe).
  unknown: string[];
  // Titres des clauses qui portent encore un emplacement « [À rédiger …] ».
  unwritten: string[];
};

function filled(value: string | null | undefined): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

// FAC-04 : « Aucune variable non remplie ne part au client » — l'appelant refuse la génération
// tant que missing, unknown ou unwritten ne sont pas vides.
export function resolveContractText(clauses: ContractClauseText[], values: ContractVariableValues, placeholderMarkers: string[]): ContractTextCheck {
  const missing: ContractVariable[] = [];
  const unknown: string[] = [];
  const unwritten: string[] = [];
  const resolve = (text: string) =>
    text.replace(VARIABLE, (whole, name: string) => {
      if (!isContractVariable(name)) {
        if (!unknown.includes(name)) unknown.push(name);
        return whole;
      }
      const value = values[name];
      if (!filled(value)) {
        if (!missing.includes(name)) missing.push(name);
        return whole;
      }
      return value;
    });
  const resolved = clauses.map((clause) => {
    if (placeholderMarkers.some((marker) => clause.body.includes(marker) || clause.title.includes(marker))) unwritten.push(clause.title);
    return { title: resolve(clause.title), body: resolve(clause.body), role: clause.role };
  });
  return { clauses: resolved, missing, unknown, unwritten };
}

export function isContractTextComplete(check: Pick<ContractTextCheck, "missing" | "unknown" | "unwritten">): boolean {
  return check.missing.length === 0 && check.unknown.length === 0 && check.unwritten.length === 0;
}

// JUR-07 (réponse 1 de l'avocat, D11) — régime d'un contrat : la rétractation s'applique à
// distance ou hors établissement, pour un consommateur, ou hors établissement pour une petite
// entreprise confirmée par la planner ; foire ou salon : modèle dédié, génération refusée.
export type ContractRegimeInput = { channel: ConclusionChannelKey; category: ClientCategoryKey; smallBusinessConfirmed: boolean };
export type ContractRegime = {
  blocked: boolean;
  withdrawalApplies: boolean;
  // Éléments que le contrat doit porter (D12, bloquant).
  requiredRoles: ContractClauseRoleKey[];
  // À distance : bouton « commande avec obligation de paiement » avant la signature (D13).
  orderRequired: boolean;
  // Hors établissement : aucun paiement avant la signature plus ce nombre de jours.
  noPaymentDays: number | null;
};

export function contractRegime(input: ContractRegimeInput, rules: Pick<ContractRules, "regime" | "requiredRoles">): ContractRegime {
  const { regime } = rules;
  const blocked = regime.blockedChannels.includes(input.channel);
  const consumer = regime.consumerCategories.includes(input.category);
  const smallBusiness = !consumer && input.smallBusinessConfirmed && regime.smallBusinessChannels.includes(input.channel);
  const withdrawalApplies = !blocked && regime.withdrawalChannels.includes(input.channel) && (consumer || smallBusiness);
  const requiredRoles = withdrawalApplies ? rules.requiredRoles.withdrawal : input.category === "professional" ? rules.requiredRoles.professional : rules.requiredRoles.noWithdrawal;
  return {
    blocked,
    withdrawalApplies,
    requiredRoles: [...requiredRoles],
    orderRequired: withdrawalApplies && regime.orderChannels.includes(input.channel),
    noPaymentDays: withdrawalApplies ? (regime.noPaymentDays[input.channel] ?? null) : null,
  };
}

export function missingRoles(required: ContractClauseRoleKey[], roles: (ContractClauseRoleKey | null)[]): ContractClauseRoleKey[] {
  const present = new Set(roles.filter((role): role is ContractClauseRoleKey => role !== null));
  return required.filter((role) => !present.has(role));
}

// Réponse 2 de l'avocat (D12, D21) — la clause des sommes versées d'avance concorde avec le choix
// du devis : « missing » si le devis a un échéancier sans la clause, « mismatch » si le contrat
// porte la clause de l'autre choix.
export function advanceClauseProblem(
  advanceKind: "deposit" | "earnest" | null,
  hasSchedule: boolean,
  roles: (ContractClauseRoleKey | null)[],
  rules: Pick<ContractRules, "advanceRoles">,
): "missing" | "mismatch" | null {
  const present = new Set(roles);
  const other = advanceKind === "earnest" ? rules.advanceRoles.deposit : rules.advanceRoles.earnest;
  if (advanceKind && present.has(other)) return "mismatch";
  if (!advanceKind) return present.has(rules.advanceRoles.deposit) || present.has(rules.advanceRoles.earnest) ? "mismatch" : null;
  if (hasSchedule && !present.has(rules.advanceRoles[advanceKind])) return "missing";
  return null;
}

// AAAA-MM-JJ + n jours (calendrier, sans heure : aucun passage à l'heure d'été).
export function addCalendarDays(date: string, days: number): string {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

function weekday(date: string): number {
  const [year, month, day] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

// JUR-07 (D6) — délai qui court à partir du jour de la signature (jour de Paris) : il finit à la
// fin du N-ième jour suivant ; un délai qui finit un samedi ou un dimanche est prolongé au lundi
// (valeur de départ ; les jours fériés restent à traiter, fiche de l'avocat). La facture
// d'acompte s'émet le lendemain du dernier jour.
export function withdrawalPeriod(signedOn: string, rules: ContractRules["withdrawal"]): { lastDay: string; issueOn: string } {
  let lastDay = addCalendarDays(signedOn, rules.periodDays);
  if (rules.extendWeekendToMonday) {
    const day = weekday(lastDay);
    if (day === 6) lastDay = addCalendarDays(lastDay, 2);
    else if (day === 0) lastDay = addCalendarDays(lastDay, 1);
  }
  return { lastDay, issueOn: addCalendarDays(lastDay, 1) };
}
