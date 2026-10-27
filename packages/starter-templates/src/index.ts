// Modèles de départ facultatifs (CLAUDE.md §2.5) : des fichiers de données
// traduisibles, jamais des constantes dans le code. Une organisation les
// charge si elle le souhaite (ONB-01 : « partir d'un modèle de départ,
// partir de zéro, ou importer un fichier ») ; rien n'est créé d'office.
import { z } from "zod";
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
