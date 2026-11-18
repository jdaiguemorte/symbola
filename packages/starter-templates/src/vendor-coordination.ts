// Lot 47 (PAR-05, PRE-03, PRE-04, PRE-09 ; D2, D6, D8 ; ADR 0085) — données de départ des
// prestataires par lien : délais (date limite d'un brief, relance, feuilles de route, alerte,
// annulation du choix, heures d'envoi) et tâches de suivi créées au choix du client, par métier.
// Aucune de ces valeurs n'est écrite dans le code (CLAUDE.md § 2.6).
import { z } from "zod";
import vendorCoordinationFile from "./vendor-coordination.json";
import vendorFollowUpTasksFile from "./vendor-follow-up-tasks.json";

type Locale = "fr" | "en";
type Metier = "wedding_planner" | "event_agency" | "autre";

const days = z.number().int().min(1).max(365);
const vendorCoordinationSchema = z
  .object({
    version: z.literal(1),
    briefDeadlineDays: days,
    reminderDaysBefore: days,
    roadmapDaysBefore: z.object({ month: days, week: days }),
    roadmapAlertDays: days,
    engagementUndoDays: days,
    sendingHours: z.object({ from: z.number().int().min(0).max(23), until: z.number().int().min(1).max(24) }),
  })
  .refine((value) => value.roadmapDaysBefore.week < value.roadmapDaysBefore.month && value.roadmapAlertDays < value.roadmapDaysBefore.week && value.sendingHours.from < value.sendingHours.until);

export type StarterVendorCoordination = {
  briefDeadlineDays: number;
  reminderDaysBefore: number;
  roadmapDaysBefore: { month: number; week: number };
  roadmapAlertDays: number;
  engagementUndoDays: number;
  sendingHours: { from: number; until: number };
};

export function starterVendorCoordination(): StarterVendorCoordination {
  const { version: _version, ...policy } = vendorCoordinationSchema.parse(vendorCoordinationFile);
  return { ...policy, roadmapDaysBefore: { ...policy.roadmapDaysBefore }, sendingHours: { ...policy.sendingHours } };
}

const followUpTaskSchema = z.object({ label: z.object({ fr: z.string().min(1).max(200), en: z.string().min(1).max(200) }), dueInDays: z.number().int().min(0).max(365) });
const followUpTasksSchema = z.object({
  version: z.literal(1),
  wedding_planner: z.array(followUpTaskSchema).min(1),
  event_agency: z.array(followUpTaskSchema).min(1),
});

export type StarterVendorFollowUpTask = { label: string; dueInDays: number };

// La variante agence pour une agence évènementielle ; celle du mariage sinon.
export function starterVendorFollowUpTasks(locale: Locale, metier: Metier = "wedding_planner"): StarterVendorFollowUpTask[] {
  const file = followUpTasksSchema.parse(vendorFollowUpTasksFile);
  const list = metier === "event_agency" ? file.event_agency : file.wedding_planner;
  return list.map((task) => ({ label: task.label[locale], dueInDays: task.dueInDays }));
}
