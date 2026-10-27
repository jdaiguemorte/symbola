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
