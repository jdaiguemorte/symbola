// Lot 48a (PRE-05, PRE-06 ; D3, D4 ; ADR 0093) — données de départ des pièces et des lieux : natures
// de pièces et délai d'alerte (vendor-document-kinds.json), règles du chrono tirées des champs d'une
// fiche de lieu (venue-rules.json : sens de chaque champ, contrôle, séquences concernées, fin de la
// nuit, types de prestataires « musique »). Le libellé des champs de lieu vit avec les autres champs
// de départ (vendor-types.json, propriété « rule »). Aucune de ces valeurs n'est écrite dans le code
// (CLAUDE.md § 2.6).
import { z } from "zod";
import vendorDocumentKindsFile from "./vendor-document-kinds.json";
import venueRulesFile from "./venue-rules.json";
import vendorTypesFile from "./vendor-types.json";

type Locale = "fr" | "en";
const label = z.object({ fr: z.string().min(1), en: z.string().min(1) });
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);

const documentKindsSchema = z.object({
  version: z.literal(1),
  alertDaysBefore: z.number().int().min(1).max(180),
  items: z.array(z.object({ key: z.string().regex(/^[a-z_]+$/), label, expires: z.boolean() })).min(1),
});
const documentKinds = documentKindsSchema.parse(vendorDocumentKindsFile);

export type StarterVendorDocumentKind = { key: string; label: string; expires: boolean };

export function starterVendorDocumentKinds(locale: Locale): StarterVendorDocumentKind[] {
  return documentKinds.items.map((item) => ({ key: item.key, label: item.label[locale], expires: item.expires }));
}

// PRE-05 : alerte N jours avant la fin de validité (réglage de l'organisation, valeur proposée).
export function starterVendorDocumentAlertDays(): number {
  return documentKinds.alertDaysBefore;
}

export const VENUE_RULE_CHECKS = ["end_after", "start_before", "capacity", "none"] as const;
export const VENUE_RULE_SCOPES = ["all", "music", "vendors"] as const;
export type VenueRuleCheck = (typeof VENUE_RULE_CHECKS)[number];
export type VenueRuleScope = (typeof VENUE_RULE_SCOPES)[number];
export type VenueRuleDefinition = { key: string; check: VenueRuleCheck; appliesTo: VenueRuleScope };
export type VenueRules = { nightEndsAt: string; musicTypeKeys: string[]; rules: VenueRuleDefinition[] };

const venueRulesSchema = z.object({
  version: z.literal(1),
  nightEndsAt: time,
  musicTypeKeys: z.array(z.string().min(1)).min(1),
  rules: z.array(z.object({ key: z.string().regex(/^[a-z][a-z_]{1,40}$/), check: z.enum(VENUE_RULE_CHECKS), appliesTo: z.enum(VENUE_RULE_SCOPES) })).min(1),
});
const venueRules = venueRulesSchema.parse(venueRulesFile);

export function starterVenueRules(): VenueRules {
  return { nightEndsAt: venueRules.nightEndsAt, musicTypeKeys: [...venueRules.musicTypeKeys], rules: venueRules.rules.map((rule) => ({ ...rule })) };
}

// Champs de lieu porteurs d'une règle (type de départ « venue »), avec leurs deux libellés : pour
// reconnaître un champ existant d'une organisation et pour poser ceux qui manquent, une fois.
const venueFieldsSchema = z.object({
  items: z.array(
    z.object({
      key: z.string(),
      fields: z.array(z.object({ label, kind: z.enum(["number", "text", "time", "amount", "choice", "boolean"]), isFilter: z.boolean(), rule: z.string().optional(), choices: z.object({ fr: z.array(z.string()), en: z.array(z.string()) }).optional() })),
    }),
  ),
});

export type StarterVenueRuleField = { rule: string; label: string; labels: string[]; kind: "number" | "text" | "time" | "amount" | "choice" | "boolean"; isFilter: boolean; choices?: string[] };

export function starterVenueRuleFields(locale: Locale): StarterVenueRuleField[] {
  const venue = venueFieldsSchema.parse(vendorTypesFile).items.find((item) => item.key === "venue");
  return (venue?.fields ?? []).flatMap((field) =>
    field.rule
      ? [{ rule: field.rule, label: field.label[locale], labels: [field.label.fr, field.label.en], kind: field.kind, isFilter: field.isFilter, ...(field.choices ? { choices: field.choices[locale] } : {}) }]
      : [],
  );
}
