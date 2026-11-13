// Lot 31c (FAC-07, JUR-01 ; décision D18, réponse 1 de l'expert-comptable) — phrase des pénalités
// de retard au taux choisi par la planner, et texte imprimé pour un client professionnel. Fonctions
// pures, partagées par le module quotes et les PDF (serveur et aperçu) ; les mots viennent des
// données (packages/starter-templates/late-penalty.json), jamais du code.
import { formatAmount, type Locale } from "@symbola/i18n";
import type { LatePenaltyData, LatePenaltyRateKey } from "@symbola/starter-templates";

export function latePenaltySentence(rate: LatePenaltyRateKey, data: LatePenaltyData, locale: Locale): string {
  const entry = data.rates.find((candidate) => candidate.key === rate);
  if (!entry) throw new RangeError("taux des pénalités inconnu");
  return data.sentence[locale].replace("{taux}", entry.phrase[locale]).replace("{indemnite}", formatAmount(data.recoveryIndemnityCents, locale));
}

// Son texte, puis la phrase des pénalités au taux choisi ; sans taux, rien n'est inventé.
export function professionalTermsText(text: string | null, rate: LatePenaltyRateKey | null, data: LatePenaltyData, locale: Locale): string | null {
  const parts = [text?.trim() || null, rate ? latePenaltySentence(rate, data, locale) : null].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join("\n") : null;
}
