// DEV-01 — affichage des taux et des statuts de devis (libellés traduits,
// jamais de texte en dur dans les composants).
import type { Locale } from "@symbola/i18n";
import type { QuoteStatus } from "@/modules/quotes/service";

// 2000 → « 20 » ; 550 → « 5,5 » (fr) ou « 5.5 » (en).
export function formatRate(basisPoints: number, locale: Locale): string {
  return new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-GB", { maximumFractionDigits: 2 }).format(basisPoints / 100);
}

export const QUOTE_STATUS_LABEL_KEYS: Record<QuoteStatus, string> = {
  draft: "statusDraft",
  sent: "statusSent",
  signed: "statusSigned",
  declined: "statusDeclined",
  expired: "statusExpired",
};

// DEV-03 : « en retard » s'affiche toujours en texte, la couleur ne fait
// que l'accompagner (contraste supérieur à 7:1, même palette qu'PRD-EVT-03).
// Pastilles de la charte (globals.css) : le libellé porte toujours l'information.
export const OVERDUE_CLASS = "badge badge-terracotta";
// Lot 31c : « Payée le … (mode de paiement) » peut dépasser 375 px ; il passe à la ligne.
export const PAID_CLASS = "badge badge-sauge badge-wrap";

// Date du jour à Paris (« YYYY-MM-DD »), pour pré-remplir les dates.
export function parisTodayString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
