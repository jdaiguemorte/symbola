// Lot 51 (EVT-04, CHR-08, JRJ-05, JRJ-06, ARC-09 ; ADR 0091) — données de départ du jour J de
// terrain : listes de contrôle (installation, démontage), réglages (nom du temps fort créé de
// lui-même, seuil de retard, taille des photos, rafraîchissement), intitulés des colonnes d'un chrono
// importé. Aucune de ces valeurs n'est écrite dans le code (CLAUDE.md § 2.6).
import { z } from "zod";
import dayChecklistsFile from "./day-checklists.json";
import dayOfFile from "./day-of.json";
import programImportColumnsFile from "./program-import-columns.json";

type Locale = "fr" | "en";
const translated = z.object({ fr: z.string().min(1).max(100), en: z.string().min(1).max(100) });
const translatedList = z.object({ fr: z.array(z.string().min(1).max(200)).max(100), en: z.array(z.string().min(1).max(200)).max(100) });

const dayChecklistsSchema = z.object({
  version: z.literal(1),
  templates: z
    .array(
      z.object({
        key: z.string().regex(/^[a-z][a-z0-9_]*$/),
        phase: z.enum(["setup", "teardown"]),
        eventTypes: z.array(z.string()),
        name: translated,
        items: translatedList,
      }),
    )
    .min(1),
});

export type StarterDayChecklist = { key: string; phase: "setup" | "teardown"; eventTypes: string[]; name: string; items: string[] };

export function starterDayChecklists(locale: Locale): StarterDayChecklist[] {
  return dayChecklistsSchema.parse(dayChecklistsFile).templates.map((template) => ({
    key: template.key,
    phase: template.phase,
    eventTypes: template.eventTypes,
    name: template.name[locale],
    items: template.items[locale],
  }));
}

const dayOfSchema = z.object({
  version: z.literal(1),
  mainMomentName: translated,
  // Lot 67d (EVT-04) : nom du jour créé pour la veille et pour le lendemain d'un évènement de plusieurs jours.
  eveMomentName: translated,
  nextDayMomentName: translated,
  shiftThresholdMinutes: z.number().int().min(1).max(120),
  photoMaxSide: z.number().int().min(320).max(8000),
  photoMaxBytes: z.number().int().min(100_000).max(20 * 1024 * 1024),
  refreshSeconds: z.number().int().min(5).max(300),
});

export type StarterDayOfSettings = { mainMomentName: string; eveMomentName: string; nextDayMomentName: string; shiftThresholdMinutes: number; photoMaxSide: number; photoMaxBytes: number; refreshSeconds: number };

export function starterDayOfSettings(locale: Locale): StarterDayOfSettings {
  const settings = dayOfSchema.parse(dayOfFile);
  return { ...settings, mainMomentName: settings.mainMomentName[locale], eveMomentName: settings.eveMomentName[locale], nextDayMomentName: settings.nextDayMomentName[locale] };
}

const columnSynonyms = z.object({ fr: z.array(z.string().min(1)), en: z.array(z.string().min(1)) });
const programImportColumnsSchema = z.object({
  version: z.literal(1),
  columns: z.object({
    moment: columnSynonyms,
    date: columnSynonyms,
    start: columnSynonyms,
    end: columnSynonyms,
    label: columnSynonyms,
    location: columnSynonyms,
    responsible: columnSynonyms,
    note: columnSynonyms,
  }),
});

export type ProgramImportColumnKey = "moment" | "date" | "start" | "end" | "label" | "location" | "responsible" | "note";

// Tous les intitulés reconnus d'une colonne, en français et en anglais.
export function starterProgramImportColumns(): Record<ProgramImportColumnKey, string[]> {
  const { columns } = programImportColumnsSchema.parse(programImportColumnsFile);
  return Object.fromEntries(Object.entries(columns).map(([key, labels]) => [key, [...labels.fr, ...labels.en]])) as Record<ProgramImportColumnKey, string[]>;
}
