// Lot 49 (INV-01 à INV-04, INV-07, RGP-03, RGP-06 à RGP-08 ; D6, D8 à D13) — données de départ du
// module Invités : liste fermée des régimes et allergies (sans régime à caractère religieux, D6),
// règles (clôture, relances, préavis, seuil d'agrégation), textes de la page de réponse (mention
// d'information et accord aux régimes, à faire relire par la DPO), intitulés des colonnes d'import.
// Aucune de ces valeurs n'est écrite dans le code (CLAUDE.md § 2.6).
import { z } from "zod";
import dietaryOptionsFile from "./dietary-options.json";
import guestRulesFile from "./guest-rules.json";
import guestTextsFile from "./guest-texts.json";
import guestImportColumnsFile from "./guest-import-columns.json";
import mealTypesFile from "./meal-types.json";
import seatingRulesFile from "./seating-rules.json";

type Locale = "fr" | "en";
const translated = z.object({ fr: z.string().min(1), en: z.string().min(1) });

const dietaryOptionsSchema = z.object({
  version: z.literal(1),
  options: z
    .array(z.object({ key: z.string().regex(/^[a-z][a-z0-9_]*$/), kind: z.enum(["diet", "allergen"]), label: translated }))
    .min(1),
});

export type StarterDietaryOption = { key: string; kind: "diet" | "allergen"; label: string };

export function starterDietaryOptions(locale: Locale): StarterDietaryOption[] {
  return dietaryOptionsSchema.parse(dietaryOptionsFile).options.map((option) => ({ key: option.key, kind: option.kind, label: option.label[locale] }));
}

export function starterDietaryOptionLabel(key: string, locale: Locale): string | null {
  return dietaryOptionsSchema.parse(dietaryOptionsFile).options.find((option) => option.key === key)?.label[locale] ?? null;
}

const guestRulesSchema = z.object({
  version: z.literal(1),
  closingDaysBeforeFirstMoment: z.number().int().min(0).max(365),
  reminderDaysBeforeClosing: z.array(z.number().int().min(1).max(90)).max(3),
  maxReminders: z.number().int().min(0).max(3),
  purgeNoticeDays: z.number().int().min(1).max(30),
  aggregateThreshold: z.number().int().min(1).max(20),
  impactAssessmentUrl: z.url().nullable(),
});

export type StarterGuestRules = Omit<z.infer<typeof guestRulesSchema>, "version">;

export function starterGuestRules(): StarterGuestRules {
  const { version: _version, ...rules } = guestRulesSchema.parse(guestRulesFile);
  return { ...rules, reminderDaysBeforeClosing: [...rules.reminderDaysBeforeClosing] };
}

const guestTextsSchema = z.object({
  version: z.literal(1),
  notice: translated,
  consent: z.object({ version: z.string().min(1).max(40), text: translated, guardian: translated }),
});

// Mention d'information de la page de réponse (RGP-03, article 14), variables {organization},
// {clients}, {contact}, {dietDays}, {days}.
export function starterGuestPrivacyNotice(locale: Locale): string {
  return guestTextsSchema.parse(guestTextsFile).notice[locale];
}

// Texte de l'accord aux régimes (RGP-06) et sa version, gardée avec chaque preuve ; variables
// {organization}, {dietDays} ; déclaration du représentant légal, variable {name}.
export function starterDietConsent(locale: Locale): { version: string; text: string; guardian: string } {
  const { consent } = guestTextsSchema.parse(guestTextsFile);
  return { version: consent.version, text: consent.text[locale], guardian: consent.guardian[locale] };
}

const synonyms = z.object({ fr: z.array(z.string().min(1)), en: z.array(z.string().min(1)) });
export const GUEST_IMPORT_FIELDS = ["household", "firstName", "lastName", "email", "phone", "kind", "ageRange", "side", "group", "language"] as const;
export type GuestImportField = (typeof GUEST_IMPORT_FIELDS)[number];

const guestImportColumnsSchema = z.object({
  version: z.literal(1),
  columns: z.object(Object.fromEntries(GUEST_IMPORT_FIELDS.map((field) => [field, synonyms])) as Record<GuestImportField, typeof synonyms>),
  ignored: z.object({ diet: synonyms }),
  values: z.object({ child: synonyms, both: synonyms, en: synonyms }),
});

export type StarterGuestImportColumns = {
  columns: Record<GuestImportField, string[]>;
  ignoredDiet: string[];
  values: { child: string[]; both: string[]; en: string[] };
};

// Tous les intitulés connus, les deux langues réunies (un fichier peut mêler les deux).
export function starterGuestImportColumns(): StarterGuestImportColumns {
  const parsed = guestImportColumnsSchema.parse(guestImportColumnsFile);
  const both = (entry: z.infer<typeof synonyms>) => [...entry.fr, ...entry.en];
  return {
    columns: Object.fromEntries(GUEST_IMPORT_FIELDS.map((field) => [field, both(parsed.columns[field])])) as Record<GuestImportField, string[]>,
    ignoredDiet: both(parsed.ignored.diet),
    values: { child: both(parsed.values.child), both: both(parsed.values.both), en: both(parsed.values.en) },
  };
}

// Lot 50 (INV-05, INV-06 ; D2, D5) — types de repas de départ (adulte, enfant, bébé sans repas,
// prestataire) et règles du plan de table (capacité proposée par forme, bornes).
const mealTypesSchema = z.object({
  version: z.literal(1),
  types: z.array(z.object({ key: z.string().regex(/^[a-z][a-z0-9_]*$/), label: translated })).min(1),
});

export type StarterMealType = { key: string; label: string };

export function starterMealTypes(locale: Locale): StarterMealType[] {
  return mealTypesSchema.parse(mealTypesFile).types.map((type) => ({ key: type.key, label: type.label[locale] }));
}

export function starterMealTypeLabel(key: string, locale: Locale): string | null {
  return mealTypesSchema.parse(mealTypesFile).types.find((type) => type.key === key)?.label[locale] ?? null;
}

const capacity = z.number().int().min(1).max(200);
const seatingRulesSchema = z.object({
  version: z.literal(1),
  defaultCapacity: z.object({ round: capacity, rectangular: capacity, head: capacity }),
  maxCapacity: capacity,
  maxTablesPerSeries: z.number().int().min(1).max(200),
  maxTablesPerPlan: z.number().int().min(1).max(500),
});

export type StarterSeatingRules = Omit<z.infer<typeof seatingRulesSchema>, "version">;

export function starterSeatingRules(): StarterSeatingRules {
  const { version: _version, ...rules } = seatingRulesSchema.parse(seatingRulesFile);
  return { ...rules, defaultCapacity: { ...rules.defaultCapacity } };
}
