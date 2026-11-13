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
