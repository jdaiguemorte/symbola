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

// Montant maximal stockable en centimes (colonne integer PostgreSQL).
const MAX_CENTS = 2_147_483_647;

// Saisie en euros (« 2 500,50 », « 1,234.56 », « 12 € ») vers des centimes
// entiers, par manipulation de texte : aucun calcul à virgule flottante
// (CLAUDE.md §5). null = saisie vide ; undefined = saisie invalide, trop
// grande ou ambiguë (« 1,005 » : 1,005 € en français ou 1 005 € en anglais).
export function parseAmountToCents(input: string): number | null | undefined {
  const compact = input.replace(/[\s\u00a0\u202f€]/g, "");
  if (compact === "") return null;
  if (!/^\d[\d.,]*$/.test(compact)) return undefined;

  const lastSeparator = Math.max(compact.lastIndexOf(","), compact.lastIndexOf("."));
  let integerPart = compact;
  let decimals = "";
  if (lastSeparator !== -1) {
    const separator = compact[lastSeparator]!;
    const otherSeparator = separator === "," ? "." : ",";
    const usesBoth = compact.includes(otherSeparator);
    const occurrences = compact.split(separator).length - 1;
    const tail = compact.slice(lastSeparator + 1);
    if (usesBoth || (occurrences === 1 && tail.length <= 2)) {
      // Le dernier séparateur est la virgule décimale ; l'autre, s'il
      // existe, sépare les milliers.
      if (tail.length === 0 || tail.length > 2 || compact.split(separator).length - 1 > 1) return undefined;
      decimals = tail;
      integerPart = compact.slice(0, lastSeparator);
      if (usesBoth) {
        const groups = integerPart.split(otherSeparator);
        if (!groups.slice(1).every((group) => /^\d{3}$/.test(group))) return undefined;
        integerPart = groups.join("");
      }
    } else {
      // Séparateur de milliers seul : « 1,234,567 ». Un groupe unique de
      // trois chiffres (« 1,005 ») reste ambigu, donc refusé.
      if (occurrences === 1) return undefined;
      const groups = compact.split(separator);
      if (!groups.slice(1).every((group) => /^\d{3}$/.test(group))) return undefined;
      integerPart = groups.join("");
    }
  }
  if (!/^\d+$/.test(integerPart) || !/^\d{0,2}$/.test(decimals)) return undefined;

  const cents = Number(integerPart + decimals.padEnd(2, "0"));
  return Number.isSafeInteger(cents) && cents <= MAX_CENTS ? cents : undefined;
}

export function formatDate(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(date);
}

// Dates sans heure (« AAAA-MM-JJ », CLAUDE.md §5) : formatées en UTC,
// faute de quoi un fuseau à l'ouest de Greenwich afficherait la veille.
function calendarDateToUtc(date: string): Date {
  return new Date(`${date}T00:00:00Z`);
}

export function formatCalendarDate(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(calendarDateToUtc(date));
}

export function formatMonth(date: string, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], { year: "numeric", month: "long", timeZone: "UTC" }).format(
    calendarDateToUtc(date),
  );
}

// Horodatage affiché à l'heure de Paris (CLAUDE.md §5), par exemple la
// date de version d'un document exporté. Les espaces insécables
// d'Intl sont remplacées par des espaces simples : les polices standard
// des PDF ne les ont pas toutes.
export function formatDateTime(date: Date, locale: Locale): string {
  return new Intl.DateTimeFormat(INTL_LOCALE[locale], {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Paris",
  })
    .format(date)
    .replace(/[\u00a0\u202f]/g, " ");
}

// Langue par défaut d'un nouvel utilisateur (HUB-04) : celle de son
// navigateur, français si elle n'est ni FR ni EN.
export function localeFromAcceptLanguage(header: string | null): Locale {
  if (!header) return DEFAULT_LOCALE;
  const preferred = header.split(",")[0]?.trim().slice(0, 2).toLowerCase();
  return preferred === "en" ? "en" : DEFAULT_LOCALE;
}
