// Modèles de départ facultatifs (CLAUDE.md §2.5) : des fichiers de données
// traduisibles, jamais des constantes dans le code. Une organisation les
// charge si elle le souhaite (ONB-01 : « partir d'un modèle de départ,
// partir de zéro, ou importer un fichier ») ; rien n'est créé d'office.
import { z } from "zod";
import demoEventFile from "./demo-event.json";
import demoQuoteFile from "./demo-quote.json";
import invoiceMentionsFile from "./invoice-mentions.json";
import paymentMethodsFile from "./payment-methods.json";
import programFile from "./program.json";
import retroplanningFile from "./retroplanning.json";
import vendorSlotsFile from "./vendor-slots.json";

export type StarterLocale = "fr" | "en";

const translatedLabelSchema = z.object({ fr: z.string().min(1), en: z.string().min(1) });

const vendorSlotsSchema = z.object({
  version: z.literal(1),
  items: z.array(z.object({ key: z.string().min(1), label: translatedLabelSchema })).min(1),
});

const vendorSlots = vendorSlotsSchema.parse(vendorSlotsFile);

// EVT-03 : postes prestataires par défaut, dans la langue demandée.
export function starterVendorSlots(locale: StarterLocale): string[] {
  return vendorSlots.items.map((item) => item.label[locale]);
}

// DEV-03 : modes de paiement de départ, même format que les postes.
const paymentMethods = vendorSlotsSchema.parse(paymentMethodsFile);

export function starterPaymentMethods(locale: StarterLocale): string[] {
  return paymentMethods.items.map((item) => item.label[locale]);
}

// DEV-04 : mentions de facturation de départ (conditions de paiement), à
// relire par le comptable de la planner avant la mise en production.
const invoiceMentions = z.object({ version: z.literal(1), text: translatedLabelSchema }).parse(invoiceMentionsFile);

export function starterInvoiceMentions(locale: StarterLocale): string {
  return invoiceMentions.text[locale];
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

export type StarterTaskTemplate = {
  name: string;
  items: { label: string; offsetDays: number; responsible: "planner" | "clients" }[];
};

// EVT-04 : modèle de rétroplanning de départ, dans la langue demandée.
export function starterRetroplanning(locale: StarterLocale): StarterTaskTemplate {
  return {
    name: retroplanning.name[locale],
    items: retroplanning.items.map((item) => ({
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

// EVT-05 : modèle de programme de départ, dans la langue demandée. Les
// intervenants portent les libellés des postes du modèle de départ, pour
// être rapprochés des postes de l'événement quand le modèle est appliqué.
export function starterProgram(locale: StarterLocale): StarterProgramTemplate {
  const slotLabels = new Map(vendorSlots.items.map((item) => [item.key, item.label[locale]]));
  return {
    name: program.name[locale],
    items: program.items.map((item) => ({
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
