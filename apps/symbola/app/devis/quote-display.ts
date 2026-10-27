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
// que l'accompagner (contraste supérieur à 7:1, même palette qu'EVT-03).
export const OVERDUE_STYLE = { background: "#fde2e2", color: "#7f1d1d", padding: "0 0.4em", borderRadius: "0.3em" } as const;
export const PAID_STYLE = { background: "#dcfce7", color: "#14532d", padding: "0 0.4em", borderRadius: "0.3em" } as const;

// Date du jour à Paris (« YYYY-MM-DD »), pour pré-remplir les dates.
export function parisTodayString(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}
