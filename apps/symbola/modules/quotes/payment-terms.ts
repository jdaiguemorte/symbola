// Lot 31c (FAC-07, JUR-01 ; décision D18, réponse 1 de l'expert-comptable) — conditions de
// paiement selon la catégorie du client : le texte des particuliers et des non-professionnels, ou
// celui des professionnels avec le taux des pénalités choisi par la planner. Fonctions pures ; la
// phrase des pénalités est dans lib/documents/payment-terms.ts (partagée avec les PDF).
import type { LatePenaltyRateKey } from "@symbola/starter-templates";

export { latePenaltySentence, professionalTermsText } from "@/lib/documents/payment-terms";

export type PaymentTermsSettings = {
  individual: string | null;
  professional: string | null;
  latePenaltyRate: LatePenaltyRateKey | null;
};

export function paymentTermsFor(
  settings: PaymentTermsSettings,
  clientKind: "individual" | "professional" | "non_professional",
): { text: string | null; latePenaltyRate: LatePenaltyRateKey | null } {
  if (clientKind === "professional") return { text: settings.professional, latePenaltyRate: settings.latePenaltyRate };
  return { text: settings.individual, latePenaltyRate: null };
}

// Lot 41 (JUR-12, D11 ; réponse 7 de l'avocat, AV-1) — délai de paiement entre professionnels :
// borné par l'article L441-10 du Code de commerce (données : 60 jours après l'émission, ou 45 jours
// fin de mois) ; un réglage hors bornes est refusé, les bornes atteintes sont acceptées.
export type ProfessionalTermBounds = { maxDaysAfterIssue: number; maxDaysEndOfMonth: number };

export function professionalTermAllowed(days: number, endOfMonth: boolean, bounds: ProfessionalTermBounds): boolean {
  if (!Number.isInteger(days) || days < 0) return false;
  return days <= (endOfMonth ? bounds.maxDaysEndOfMonth : bounds.maxDaysAfterIssue);
}

// Échéance d'une facture à un professionnel (dates sans heure, calculées en UTC) : n jours après
// l'émission ; « fin de mois » : n jours après l'émission, puis le dernier jour de ce mois (la plus
// courte des deux lectures usuelles, à faire confirmer : AV-1).
export function professionalDueDate(issuedOn: string, days: number, endOfMonth: boolean): string {
  const [year, month, day] = issuedOn.split("-").map(Number) as [number, number, number];
  const due = new Date(Date.UTC(year, month - 1, day + days));
  if (!endOfMonth) return due.toISOString().slice(0, 10);
  return new Date(Date.UTC(due.getUTCFullYear(), due.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
}
