// Modèles de départ facultatifs (CLAUDE.md §2.5) : des fichiers de données
// traduisibles, jamais des constantes dans le code. Une organisation les
// charge si elle le souhaite (ONB-01 : « partir d'un modèle de départ,
// partir de zéro, ou importer un fichier ») ; rien n'est créé d'office.
import { z } from "zod";
import demoEventFile from "./demo-event.json";
import demoQuoteFile from "./demo-quote.json";
import importSynonymsFile from "./import-synonyms.json";
import importProfilesFile from "./import-profiles.json";
import invoiceMentionsFile from "./invoice-mentions.json";
import documentStyleFile from "./document-style.json";
import lossReasonsFile from "./loss-reasons.json";
import paymentMethodsFile from "./payment-methods.json";
import privacyErasureResponseFile from "./privacy-erasure-response.json";
import privacyRequestResponsesFile from "./privacy-request-responses.json";
import privacySettingsFile from "./privacy-settings.json";
import followUpFile from "./follow-up.json";
import budgetAlertFile from "./budget-alert.json";
import programFile from "./program.json";
import prospectSourcesFile from "./prospect-sources.json";
import retroplanningFile from "./retroplanning.json";
import tutorialExamplesFile from "./tutorial-examples.json";
import vendorSlotsFile from "./vendor-slots.json";
import vendorTypesFile from "./vendor-types.json";
import vendorTypeSynonymsFile from "./vendor-type-synonyms.json";
import vendorFamiliesFile from "./vendor-families.json";
import agencyVendorSlotsFile from "./vendor-slots.event-agency.json";
import agencyProspectSourcesFile from "./prospect-sources.event-agency.json";
import agencyRetroplanningFile from "./retroplanning.event-agency.json";
import agencyProgramFile from "./program.event-agency.json";
import vendorTagsFile from "./vendor-tags.json";
import agencyVendorTagsFile from "./vendor-tags.event-agency.json";
import allocationFile from "./allocation.json";
import eventTypesFile from "./event-types.json";

export type StarterLocale = "fr" | "en";

// Lot 12 (ONB-03) — métier de l'organisation : chaque métier a ses modèles
// de départ ; « autre » prend ceux d'une agence événementielle.
export type StarterMetier = "wedding_planner" | "event_agency" | "autre";
const isWedding = (metier: StarterMetier) => metier === "wedding_planner";

// Icônes des lignes du budget et des familles de prestataires (présentation) :
// clés connues de l'app. Lot 16 (L16-PRE-14) : games, stage, truck, megaphone.
export const BUDGET_LINE_ICONS = [
  "venue", "catering", "camera", "video", "music", "flower", "decoration", "officiant", "cake", "beauty",
  "stationery", "transport", "lodging", "sound", "staff", "furniture", "attire", "rings", "games", "stage",
  "truck", "megaphone", "other",
] as const;
export type BudgetLineIcon = (typeof BUDGET_LINE_ICONS)[number];

const translatedLabelSchema = z.object({ fr: z.string().min(1), en: z.string().min(1) });

const vendorSlotsSchema = z.object({
  version: z.literal(1),
  items: z.array(z.object({ key: z.string().min(1), label: translatedLabelSchema, icon: z.enum(BUDGET_LINE_ICONS).optional() })).min(1),
});

const vendorSlots = vendorSlotsSchema.parse(vendorSlotsFile);
const agencyVendorSlots = vendorSlotsSchema.parse(agencyVendorSlotsFile);
const slotsFor = (metier: StarterMetier) => (isWedding(metier) ? vendorSlots : agencyVendorSlots);

// PRD-EVT-03 / L12-EVT-17 : lignes du budget par défaut (anciens « postes »), dans
// la langue demandée, pour le métier (mariage par défaut).
export function starterVendorSlots(locale: StarterLocale, metier: StarterMetier = "wedding_planner"): string[] {
  return slotsFor(metier).items.map((item) => item.label[locale]);
}

export function starterBudgetLines(locale: StarterLocale, metier: StarterMetier = "wedding_planner"): { key: string; label: string; icon: BudgetLineIcon }[] {
  return slotsFor(metier).items.map((item) => ({ key: item.key, label: item.label[locale], icon: item.icon ?? "other" }));
}

// Lot 12 : répartition du budget de départ (points de base par ligne).
const allocationSchema = z.object({
  version: z.literal(1),
  metiers: z.record(z.enum(["wedding_planner", "event_agency"]), z.object({ name: translatedLabelSchema, items: z.record(z.string(), z.number().int().min(0).max(10000)) })),
});
const allocation = allocationSchema.parse(allocationFile);

export function starterAllocation(locale: StarterLocale, metier: StarterMetier = "wedding_planner"): { name: string; items: { label: string; basisPoints: number }[] } {
  const model = allocation.metiers[isWedding(metier) ? "wedding_planner" : "event_agency"]!;
  const labels = new Map(slotsFor(metier).items.map((item) => [item.key, item.label[locale]]));
  return {
    name: model.name[locale],
    items: Object.entries(model.items).map(([key, basisPoints]) => {
      const label = labels.get(key);
      if (!label) throw new Error(`ligne inconnue dans la répartition de départ : ${key}`);
      return { label, basisPoints };
    }),
  };
}

// PRD-EVT-07 : sources de prospect de départ, même format que les postes.
const prospectSources = vendorSlotsSchema.parse(prospectSourcesFile);
const agencyProspectSources = vendorSlotsSchema.parse(agencyProspectSourcesFile);

export function starterProspectSources(locale: StarterLocale, metier: StarterMetier = "wedding_planner"): string[] {
  return (isWedding(metier) ? prospectSources : agencyProspectSources).items.map((item) => item.label[locale]);
}

// PRD-EVT-07 : motifs de perte de départ ; « Autre » demande une précision.
const lossReasonsSchema = z.object({
  version: z.literal(1),
  items: z.array(z.object({ key: z.string().min(1), label: translatedLabelSchema, freeText: z.boolean() })).min(1),
});
const lossReasons = lossReasonsSchema.parse(lossReasonsFile);

export function starterLossReasons(locale: StarterLocale): { label: string; isFreeText: boolean }[] {
  return lossReasons.items.map((item) => ({ label: item.label[locale], isFreeText: item.freeText }));
}

// DEV-03 : modes de paiement de départ, même format que les postes.
const paymentMethods = vendorSlotsSchema.parse(paymentMethodsFile);

export function starterPaymentMethods(locale: StarterLocale): string[] {
  return paymentMethods.items.map((item) => item.label[locale]);
}

// Lot 21 (DEV-13) : clé du mode de départ et ses libellés (français et
// anglais), pour reconnaître un mode et lui donner son icône sans stocker de
// clé en base.
export function starterPaymentMethodKinds(): { key: string; labels: string[] }[] {
  return paymentMethods.items.map((item) => ({ key: item.key, labels: [item.label.fr, item.label.en] }));
}

// DEV-04 : mentions de facturation de départ (conditions de paiement), à
// relire par le comptable de la planner avant la mise en production.
const invoiceMentions = z.object({ version: z.literal(1), text: translatedLabelSchema }).parse(invoiceMentionsFile);

export function starterInvoiceMentions(locale: StarterLocale): string {
  return invoiceMentions.text[locale];
}

// Lot 17 (DEV-09, DEV-10) — apparence des documents : couleur neutre (celle
// d'une organisation qui n'a rien choisi et des documents antérieurs au
// lot 17), nuances proposées, conditions particulières du devis de départ.
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/);
const documentStyle = z
  .object({
    version: z.literal(1),
    defaultColor: hexColor,
    swatches: z.array(z.object({ color: hexColor, label: translatedLabelSchema })).min(1),
    quoteTerms: translatedLabelSchema,
  })
  .parse(documentStyleFile);

export type StarterDocumentStyle = { defaultColor: string; swatches: { color: string; label: string }[] };

export function starterDocumentStyle(locale: StarterLocale): StarterDocumentStyle {
  return {
    defaultColor: documentStyle.defaultColor,
    swatches: documentStyle.swatches.map((swatch) => ({ color: swatch.color, label: swatch.label[locale] })),
  };
}

export function starterQuoteTerms(locale: StarterLocale): string {
  return documentStyle.quoteTerms[locale];
}

const retroplanningSchema = z.object({
  version: z.literal(1),
  name: translatedLabelSchema,
  items: z
    .array(
      z.object({
        key: z.string().min(1),
        label: translatedLabelSchema,
        offsetDays: z.number().int(),
        responsible: z.enum(["planner", "clients"]),
      }),
    )
    .min(1),
});

const retroplanning = retroplanningSchema.parse(retroplanningFile);
const agencyRetroplanning = retroplanningSchema.parse(agencyRetroplanningFile);

export type StarterTaskTemplate = {
  name: string;
  items: { label: string; offsetDays: number; responsible: "planner" | "clients" }[];
};

// PRD-EVT-04 : modèle de rétroplanning de départ, dans la langue demandée.
export function starterRetroplanning(locale: StarterLocale, metier: StarterMetier = "wedding_planner"): StarterTaskTemplate {
  const source = isWedding(metier) ? retroplanning : agencyRetroplanning;
  return {
    name: source.name[locale],
    items: source.items.map((item) => ({
      label: item.label[locale],
      offsetDays: item.offsetDays,
      responsible: item.responsible,
    })),
  };
}

const programSchema = z.object({
  version: z.literal(1),
  name: translatedLabelSchema,
  items: z
    .array(
      z.object({
        key: z.string().min(1),
        startTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
        endTime: z
          .string()
          .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
          .nullable(),
        // Intervenants : clés des postes du modèle de départ (vendor-slots.json).
        vendorSlotKeys: z.array(z.string().min(1)),
        label: translatedLabelSchema,
        location: z.object({ fr: z.string(), en: z.string() }),
      }),
    )
    .min(1),
});

const program = programSchema.parse(programFile);
const agencyProgram = programSchema.parse(agencyProgramFile);

export type StarterProgramTemplate = {
  name: string;
  items: {
    startTime: string;
    endTime: string | null;
    label: string;
    location: string | null;
    participantLabels: string[];
  }[];
};

// PRD-EVT-05 : modèle de programme de départ, dans la langue demandée. Les
// intervenants portent les libellés des postes du modèle de départ, pour
// être rapprochés des postes de l'événement quand le modèle est appliqué.
export function starterProgram(locale: StarterLocale, metier: StarterMetier = "wedding_planner"): StarterProgramTemplate {
  const source = isWedding(metier) ? program : agencyProgram;
  const slotLabels = new Map(slotsFor(metier).items.map((item) => [item.key, item.label[locale]]));
  return {
    name: source.name[locale],
    items: source.items.map((item) => ({
      startTime: item.startTime,
      endTime: item.endTime,
      label: item.label[locale],
      location: item.location[locale] || null,
      participantLabels: item.vendorSlotKeys.map((key) => {
        const label = slotLabels.get(key);
        if (!label) throw new Error(`poste inconnu dans le modèle de programme : ${key}`);
        return label;
      }),
    })),
  };
}

const demoEventSchema = z.object({
  version: z.literal(1),
  // Date de l'événement fictif : aujourd'hui + ce nombre de jours, pour que
  // le rétroplanning de départ tombe dans le futur.
  daysFromToday: z.number().int().positive(),
  clients: z.array(z.object({ firstName: translatedLabelSchema, lastName: translatedLabelSchema })).min(1),
  venueName: translatedLabelSchema,
  venueCity: translatedLabelSchema,
});

const demoEvent = demoEventSchema.parse(demoEventFile);

export type StarterDemoEvent = {
  daysFromToday: number;
  clients: { firstName: string; lastName: string }[];
  venueName: string;
  venueCity: string;
};

// AIDE-02 : couple et lieu fictifs de l'essai guidé du module événements,
// dans la langue demandée.
export function starterDemoEvent(locale: StarterLocale): StarterDemoEvent {
  return {
    daysFromToday: demoEvent.daysFromToday,
    clients: demoEvent.clients.map((client) => ({
      firstName: client.firstName[locale],
      lastName: client.lastName[locale],
    })),
    venueName: demoEvent.venueName[locale],
    venueCity: demoEvent.venueCity[locale],
  };
}

// AIDE-02 / lot 4 : devis fictif de l'essai guidé (module Devis), lignes et
// échéancier dans la langue demandée ; dates relatives au jour de l'essai.
const demoQuoteSchema = z.object({
  version: z.literal(1),
  lines: z
    .array(
      z.object({
        label: translatedLabelSchema,
        unit: translatedLabelSchema,
        quantityMilli: z.number().int().positive(),
        unitPriceCents: z.number().int().nonnegative(),
        vatRateBasisPoints: z.number().int().min(0).max(10000),
      }),
    )
    .min(1),
  schedule: z.array(
    z.object({
      label: translatedLabelSchema,
      percentageBasisPoints: z.number().int().min(1).max(10000),
      dueOffsetDays: z.number().int().nonnegative(),
    }),
  ),
});

const demoQuote = demoQuoteSchema.parse(demoQuoteFile);

export type StarterDemoQuote = {
  lines: { label: string; unit: string; quantityMilli: number; unitPriceCents: number; vatRateBasisPoints: number }[];
  schedule: { label: string; percentageBasisPoints: number; dueOffsetDays: number }[];
};

export function starterDemoQuote(locale: StarterLocale): StarterDemoQuote {
  return {
    lines: demoQuote.lines.map((line) => ({ ...line, label: line.label[locale], unit: line.unit[locale] })),
    schedule: demoQuote.schedule.map((item) => ({ ...item, label: item.label[locale] })),
  };
}

// Lot 5 (IMP-02) : synonymes d'intitulés de colonnes et de valeurs pour la
// reconnaissance des colonnes d'un fichier d'import. Les deux langues sont
// fusionnées : la langue d'un fichier ne suit pas celle de l'interface.
const translatedListSchema = z.object({ fr: z.array(z.string().min(1)), en: z.array(z.string().min(1)) });

const importSynonymsSchema = z.object({
  version: z.literal(1),
  columns: z.record(z.string(), translatedListSchema),
  choices: z.record(z.string(), z.record(z.string(), translatedListSchema)),
  booleans: z.object({ true: translatedListSchema, false: translatedListSchema }),
});

export type StarterImportSynonyms = {
  // Clé de champ (packages/contracts, IMPORT_FIELDS) → intitulés possibles.
  columns: Record<string, string[]>;
  // Clé de champ « choice » → valeur → libellés possibles.
  choices: Record<string, Record<string, string[]>>;
  booleans: { true: string[]; false: string[] };
};

const importSynonyms = importSynonymsSchema.parse(importSynonymsFile);

function bothLanguages(list: { fr: string[]; en: string[] }): string[] {
  return [...new Set([...list.fr, ...list.en])];
}

export function starterImportSynonyms(): StarterImportSynonyms {
  return {
    columns: Object.fromEntries(Object.entries(importSynonyms.columns).map(([key, list]) => [key, bothLanguages(list)])),
    choices: Object.fromEntries(
      Object.entries(importSynonyms.choices).map(([key, values]) => [
        key,
        Object.fromEntries(Object.entries(values).map(([value, list]) => [value, bothLanguages(list)])),
      ]),
    ),
    booleans: { true: bothLanguages(importSynonyms.booleans.true), false: bothLanguages(importSynonyms.booleans.false) },
  };
}

// Lot 14 (ADR 0034) — profils d'export de logiciels tiers : repères de
// reconnaissance et de lecture (intitulés de colonnes, libellés de la fiche
// événement PDF, mois et jours), en données.
const vendorsExportProfileSchema = z.object({
  headers: z.array(z.string().min(1)).min(1),
  minimumHeaderMatches: z.number().int().positive(),
  columns: z.record(z.string(), z.string().min(1)),
  swapWhenContentDiffers: z.array(z.tuple([z.string(), z.string()])),
  listSeparator: z.string().min(1),
  // Lot 16 (IMP-11) : colonnes annexes ignorées ou gardées en champ libre d'office.
  annexColumns: z.object({ ignore: z.array(z.string().min(1)), keep: z.array(z.string().min(1)) }).optional(),
});
const eventSheetProfileSchema = z.object({
  dateLabel: z.string().min(1),
  placesHeading: z.string().min(1),
  budgetHeading: z.string().min(1),
  emailPrefix: z.string().min(1),
  addressPrefix: z.string().min(1),
  phonesPrefix: z.string().min(1),
  budgetLabels: z.object({ wanted: z.string(), paid: z.string(), balance: z.string(), total: z.string() }),
  placeTimeSeparator: z.string().min(1),
  footerFromRatio: z.number().gt(0).lt(1),
  weekdays: z.array(z.string()).length(7),
  months: z.array(z.string()).length(12),
  // Lot 14c : intitulés des colonnes de la ligne d'import tirée d'une fiche.
  columnHeaders: z.record(z.string(), z.string().min(1)),
});
const importProfilesSchema = z.object({
  planningSoftware: z.object({ vendors: vendorsExportProfileSchema, eventSheet: eventSheetProfileSchema }),
});

export type VendorsExportProfile = z.infer<typeof vendorsExportProfileSchema>;
export type EventSheetProfile = z.infer<typeof eventSheetProfileSchema>;

const importProfiles = importProfilesSchema.parse(importProfilesFile);

// Export d'un logiciel de planification tiers (prestataires en Excel, fiches événement en PDF).
export function planningSoftwareProfile(): { vendors: VendorsExportProfile; eventSheet: EventSheetProfile } {
  return importProfiles.planningSoftware;
}

// Lot 14 (décision N) — groupes de types de prestataires équivalents
// (« Coiffeur(se) », « Coiffure »), en français et en anglais, pour
// rapprocher les types d'un fichier importé de ceux du carnet.
const vendorTypeSynonymsSchema = z.object({
  version: z.literal(1),
  items: z.array(z.object({ key: z.string().min(1), fr: z.array(z.string().min(1)).min(1), en: z.array(z.string().min(1)).min(1) })),
});
const vendorTypeSynonyms = vendorTypeSynonymsSchema.parse(vendorTypeSynonymsFile);

export function starterVendorTypeSynonymGroups(): string[][] {
  return vendorTypeSynonyms.items.map((item) => [...item.fr, ...item.en]);
}

// Lot 6 (RGPD-04/RGPD-05) : réglages RGPD de départ d'une organisation —
// seuil d'alerte des demandes et durées de conservation du cahier des
// charges (§ 6), modifiables par la titulaire, à faire valider par un juriste
// avant l'ouverture SaaS.
const privacySettingsSchema = z.object({
  version: z.literal(1),
  requestAlertDays: z.number().int().positive(),
  prospectRetentionMonths: z.number().int().positive(),
  clientRetentionMonths: z.number().int().positive(),
  accountingRetentionMonths: z.number().int().positive(),
  inactiveAccountMonths: z.number().int().positive(),
  // RGPD-03 : devis signés gardés comme preuve du contrat (prescription
  // civile de 5 ans, décision de Julien du 02/11/2026, à valider par un juriste).
  signedQuoteRetentionMonths: z.number().int().positive(),
  // RGPD-09 : preuve d'une demande d'exercice de droits close (nom de la
  // personne), gardée 5 ans après la clôture puis anonymisée par la purge
  // (prescription civile, décision de Julien du 09/11/2026, à valider par un juriste).
  requestProofRetentionMonths: z.number().int().positive(),
});

export type StarterPrivacySettings = Omit<z.infer<typeof privacySettingsSchema>, "version">;

export function starterPrivacySettings(): StarterPrivacySettings {
  const parsed = privacySettingsSchema.parse(privacySettingsFile);
  return {
    requestAlertDays: parsed.requestAlertDays,
    prospectRetentionMonths: parsed.prospectRetentionMonths,
    clientRetentionMonths: parsed.clientRetentionMonths,
    accountingRetentionMonths: parsed.accountingRetentionMonths,
    inactiveAccountMonths: parsed.inactiveAccountMonths,
    signedQuoteRetentionMonths: parsed.signedQuoteRetentionMonths,
    requestProofRetentionMonths: parsed.requestProofRetentionMonths,
  };
}

// RGPD-03 : modèle de réponse à une demande d'effacement, dans la langue
// demandée. Variables entre accolades, remplies par l'app : {person},
// {receivedOn}, {completedOn}, {organization}, {kept}.
const privacyErasureResponse = z
  .object({ version: z.literal(1), subject: translatedLabelSchema, body: translatedLabelSchema })
  .parse(privacyErasureResponseFile);

export function starterErasureResponse(locale: StarterLocale): { subject: string; body: string } {
  return { subject: privacyErasureResponse.subject[locale], body: privacyErasureResponse.body[locale] };
}

// Lot 18 (RGPD-07) : réponses aux autres demandes (accès, portabilité,
// rectification, opposition), à relire par la titulaire.
export type StarterRequestResponseType = "access" | "portability" | "rectification" | "objection";
const responseSchema = z.object({ subject: translatedLabelSchema, body: translatedLabelSchema });
const privacyRequestResponses = z
  .object({
    version: z.literal(1),
    responses: z.object({ access: responseSchema, portability: responseSchema, rectification: responseSchema, objection: responseSchema }),
  })
  .parse(privacyRequestResponsesFile);

export function starterRequestResponse(type: StarterRequestResponseType, locale: StarterLocale): { subject: string; body: string } {
  const response = privacyRequestResponses.responses[type];
  return { subject: response.subject[locale], body: response.body[locale] };
}

// Lot 10 (AIDE-06) — exemples fictifs des tutoriels « en faisant » : un type
// d'événement par tutoriel (anniversaire, séminaire, mariage, baptême…),
// pour que l'aide ne se limite pas aux mariages ; plus le modèle de
// rétroplanning et la prestation d'exemple.
const tutorialEventSchema = z.object({
  kind: translatedLabelSchema,
  daysFromToday: z.number().int().positive(),
  withPlanning: z.boolean(),
  clients: z.array(z.object({ firstName: translatedLabelSchema, lastName: translatedLabelSchema })).min(1),
  venueName: translatedLabelSchema,
  venueCity: translatedLabelSchema,
});

const tutorialExamples = z
  .object({
    version: z.literal(1),
    events: z.record(z.string(), tutorialEventSchema),
    taskTemplate: z.object({
      name: translatedLabelSchema,
      items: z.array(z.object({ label: translatedLabelSchema, offsetDays: z.number().int(), responsible: z.enum(["planner", "clients"]) })).min(1),
    }),
    catalogItem: z.object({ label: translatedLabelSchema, unit: translatedLabelSchema, unitPriceCents: z.number().int().nonnegative() }),
  })
  .parse(tutorialExamplesFile);

export type StarterTutorialEvent = StarterDemoEvent & { kind: string; withPlanning: boolean };

export function starterTutorialEvent(key: string, locale: StarterLocale): StarterTutorialEvent | null {
  const example = tutorialExamples.events[key];
  if (!example) return null;
  return {
    kind: example.kind[locale],
    withPlanning: example.withPlanning,
    daysFromToday: example.daysFromToday,
    clients: example.clients.map((client) => ({ firstName: client.firstName[locale], lastName: client.lastName[locale] })),
    venueName: example.venueName[locale],
    venueCity: example.venueCity[locale],
  };
}

export function starterTutorialTaskTemplate(locale: StarterLocale): StarterTaskTemplate {
  return {
    name: tutorialExamples.taskTemplate.name[locale],
    items: tutorialExamples.taskTemplate.items.map((item) => ({ label: item.label[locale], offsetDays: item.offsetDays, responsible: item.responsible })),
  };
}

export function starterTutorialCatalogItem(locale: StarterLocale): { label: string; unit: string; unitPriceCents: number } {
  const item = tutorialExamples.catalogItem;
  return { label: item.label[locale], unit: item.unit[locale], unitPriceCents: item.unitPriceCents };
}

// Lot 11 (L11-PRE-02) : catalogue des types de prestataires de départ et de leurs
// champs, modifiables ensuite par l'organisation. Lot 16 (L16-PRE-14) : la couleur
// est celle de la famille (vendor-families*.json), plus celle du type.
const vendorTypesSchema = z.object({
  version: z.literal(1),
  items: z
    .array(
      z.object({
        key: z.string().min(1),
        label: translatedLabelSchema,
        fields: z.array(
          z.object({
            label: translatedLabelSchema,
            kind: z.enum(["number", "text", "time", "amount", "choice", "boolean"]),
            choices: z.object({ fr: z.array(z.string().min(1)), en: z.array(z.string().min(1)) }).optional(),
            isFilter: z.boolean(),
          }),
        ),
      }),
    )
    .min(1),
});

const vendorTypes = vendorTypesSchema.parse(vendorTypesFile);

export type StarterVendorTypeField = { label: string; kind: "number" | "text" | "time" | "amount" | "choice" | "boolean"; choices?: string[]; isFilter: boolean };

export type StarterVendorType = { key: string; label: string; fields: StarterVendorTypeField[] };

export function starterVendorTypes(locale: StarterLocale): StarterVendorType[] {
  return vendorTypes.items.map((item) => ({
    key: item.key,
    label: item.label[locale],
    fields: item.fields.map((field) => ({
      label: field.label[locale],
      kind: field.kind,
      ...(field.choices ? { choices: field.choices[locale] } : {}),
      isFilter: field.isFilter,
    })),
  }));
}

// Lot 16 (L16-PRE-14) — familles de types de prestataires de départ, par métier :
// une dizaine de familles, chacune avec ses types du catalogue. Une
// organisation les renomme, les scinde ou en crée d'autres (L16-PRE-15) ; ces
// données ne sont qu'un point de départ, jamais rétablies d'office.
const vendorFamiliesSchema = z.object({
  version: z.literal(1),
  items: z
    .array(
      z.object({
        key: z.string().min(1),
        label: translatedLabelSchema,
        color: z.string().regex(/^#[0-9a-f]{6}$/),
        icon: z.enum(BUDGET_LINE_ICONS),
        types: z.array(z.string().min(1)).min(1),
      }),
    )
    .min(1),
  // Lot 16 (ADR 0045) : types propres au mariage, installés seulement pour une
  // organisation qui organise des mariages.
  weddingOnlyTypes: z.array(z.string().min(1)),
});

const vendorFamilies = vendorFamiliesSchema.parse(vendorFamiliesFile);

export type StarterVendorCatalogType = StarterVendorType & { synonyms: string[] };

export type StarterVendorFamily = { key: string; label: string; color: string; icon: BudgetLineIcon; types: StarterVendorCatalogType[] };

// Lot 16 (ADR 0045) : un seul catalogue pour tous les métiers (une agence fait
// aussi des mariages, une wedding planner d'autres événements). Les types
// propres au mariage (robe de mariée, officiant…) n'y sont que si
// l'organisation organise des mariages.
export function starterVendorCatalog(locale: StarterLocale, options: { weddings?: boolean } = {}): StarterVendorFamily[] {
  const weddings = options.weddings ?? true;
  const weddingOnly = new Set(vendorFamilies.weddingOnlyTypes);
  const types = new Map(starterVendorTypes(locale).map((type) => [type.key, type]));
  const synonyms = new Map(vendorTypeSynonyms.items.map((item) => [item.key, [...item.fr, ...item.en]]));
  return vendorFamilies.items
    .map((family) => ({
      key: family.key,
      label: family.label[locale],
      color: family.color,
      icon: family.icon,
      types: family.types
        .filter((key) => weddings || !weddingOnly.has(key))
        .map((key) => {
          const type = types.get(key);
          if (!type) throw new Error(`type de départ inconnu : ${key}`);
          return { ...type, synonyms: synonyms.get(key) ?? [type.label] };
        }),
    }))
    .filter((family) => family.types.length > 0);
}

// Lot 11 : prestataires d'exemple du tutoriel « comparer plusieurs devis ».
const tutorialVendorsSchema = z.array(
  z.object({ name: translatedLabelSchema, city: z.string().min(1), note: translatedLabelSchema }),
);

export function starterTutorialVendors(locale: StarterLocale): { name: string; city: string; note: string }[] {
  const raw = (tutorialExamplesFile as { vendors?: unknown }).vendors ?? [];
  return tutorialVendorsSchema.parse(raw).map((vendor) => ({ name: vendor.name[locale], city: vendor.city, note: vendor.note[locale] }));
}

// Lot 13 (L13-HUB-15) — délais de relance du bloc « À traiter » de l'accueil :
// valeurs de départ, chaque organisation les règle dans ses paramètres.
export type StarterFollowUpDelays = { quoteFollowUpDays: number; prospectFollowUpDays: number };

const followUpSchema = z.object({
  version: z.literal(1),
  quoteFollowUpDays: z.number().int().min(1).max(365),
  prospectFollowUpDays: z.number().int().min(1).max(365),
});

export function starterFollowUpDelays(): StarterFollowUpDelays {
  const parsed = followUpSchema.parse(followUpFile);
  return { quoteFollowUpDays: parsed.quoteFollowUpDays, prospectFollowUpDays: parsed.prospectFollowUpDays };
}

// Lot 16 (ADR 0045) — types d'événement de départ. Chaque type dit qui sont
// les clients : « les mariés » (couple) ou « le client » (clients), et donc le
// vocabulaire de l'événement. Même liste pour tous les métiers (une agence fait
// aussi des mariages, une wedding planner d'autres événements), dans l'ordre
// du métier ; « autre » prend celui d'une agence.
export type StarterEventTypeAudience = "couple" | "clients";
export type StarterEventType = { key: string; label: string; audience: StarterEventTypeAudience };

const eventTypeKeys = z.array(z.string().min(1)).min(1);
const eventTypesSchema = z.object({
  version: z.literal(1),
  items: z.array(z.object({ key: z.string().min(1), label: translatedLabelSchema, audience: z.enum(["couple", "clients"]) })).min(1),
  orders: z.object({ wedding_planner: eventTypeKeys, event_agency: eventTypeKeys }),
});
const eventTypes = eventTypesSchema.parse(eventTypesFile);

export function starterEventTypes(locale: StarterLocale, metier: StarterMetier = "wedding_planner"): StarterEventType[] {
  const byKey = new Map(eventTypes.items.map((item) => [item.key, item]));
  return eventTypes.orders[isWedding(metier) ? "wedding_planner" : "event_agency"].map((key) => {
    const item = byKey.get(key);
    if (!item) throw new Error(`type d'événement de départ inconnu : ${key}`);
    return { key: item.key, label: item.label[locale], audience: item.audience };
  });
}

// Lot 21 (L21-PRE-18, ADR 0050) — étiquettes de départ des prestataires, rangées
// en groupes (certains « paliers », à choix unique) et rattachées aux familles
// de départ (clés de vendor-families.json ; vide = toutes les familles). Les
// agences reçoivent en plus vendor-tags.event-agency.json, fusionné par clé de
// groupe. Chaque organisation les modifie ensuite : jamais rétablies d'office.
const vendorTagsSchema = z.object({
  version: z.literal(1),
  groups: z.array(
    z.object({
      key: z.string().min(1),
      label: translatedLabelSchema,
      exclusive: z.boolean(),
      families: z.array(z.string().min(1)),
      tags: z.array(translatedLabelSchema.extend({ families: z.array(z.string().min(1)).optional() })).min(1),
    }),
  ),
});

const starterTagGroups = vendorTagsSchema.parse(vendorTagsFile);
const agencyTagGroups = vendorTagsSchema.parse(agencyVendorTagsFile);

export type StarterVendorTagGroup = { key: string; label: string; exclusive: boolean; tags: { label: string; aliases: string[]; familyKeys: string[] }[] };

export function starterVendorTags(locale: StarterLocale, metier: StarterMetier = "wedding_planner"): StarterVendorTagGroup[] {
  const groups = starterTagGroups.groups.map((group) => ({ ...group, tags: [...group.tags] }));
  if (metier === "event_agency") {
    for (const extra of agencyTagGroups.groups) {
      const same = groups.find((group) => group.key === extra.key);
      if (same) same.tags.push(...extra.tags.map((tag) => ({ ...tag, families: tag.families ?? extra.families })));
      else groups.push({ ...extra, tags: [...extra.tags] });
    }
  }
  return groups.map((group) => ({
    key: group.key,
    label: group.label[locale],
    exclusive: group.exclusive,
    tags: group.tags.map((tag) => ({ label: tag[locale], aliases: [tag.fr, tag.en], familyKeys: tag.families ?? group.families })),
  }));
}

// Lot 28a (BUD-02, décision D4) — seuil d'alerte de départ du budget, en
// pourcentage de l'enveloppe du client.
const budgetAlertSchema = z.object({
  version: z.literal(1),
  alertThresholdPercent: z.number().int().min(1).max(500),
});

export function starterBudgetAlertThreshold(): number {
  return budgetAlertSchema.parse(budgetAlertFile).alertThresholdPercent;
}

