// Point d'entrée de @symbola/i18n (CLAUDE.md §4, HUB-04) : langues
// prises en charge, formats commun date/montant. Les catalogues de
// messages (fr.json/en.json) sont importés directement par leur chemin
// (voir package.json "exports") depuis la config next-intl de l'app.
export const LOCALES = ["fr", "en"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "fr";

const INTL_LOCALE: Record<Locale, string> = { fr: "fr-FR", en: "en-US" };

// Montants en centimes entiers (CLAUDE.md §5, jamais de float) : cette
// fonction est le seul endroit qui les convertit en unités pour
// l'affichage. « 1 234,56 € » en fr, « €1,234.56 » en en.
export function formatAmount(cents: number, locale: Locale): string {
  return new Intl.NumberFormat(INTL_LOCALE[locale], {
    style: "currency",
    currency: "EUR",
  }).format(cents / 100);
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

// Langue par défaut d'un nouvel utilisateur (HUB-04) : celle de son
// navigateur, français si elle n'est ni FR ni EN.
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const preferred = header.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return preferred === "en" ? "en" : DEFAULT_LOCALE;
}
