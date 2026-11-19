// Lot 58 (EVT-08 ; D5 ; ADR 0097) — règles pures d'un modèle d'évènement et de la duplication, sans
// base. Un modèle ne copie que des structures : rétroplanning (tâches et leurs écarts au jour J),
// programme (heures, libellés et lieux), structure du budget (postes et lignes, sans montant),
// questionnaires (leur modèle) et, si la planner coche la case, les prestataires (contacts
// professionnels). Le contrôle « aucune donnée personnelle » (critère d'EVT-08) refuse un nom de
// client, un e-mail ou un téléphone dans un texte copié, et dit où il se trouve.
import { z } from "zod";
import { findPersonalData, normalizeText } from "@symbola/privacy";

const text = (max: number) => z.string().trim().min(1).max(max);
const optionalText = (max: number) => z.string().max(max).nullable();

export const eventTemplateContentSchema = z.object({
  version: z.literal(1),
  tasks: z
    .array(z.object({ label: text(300), offsetDays: z.number().int().min(-3650).max(3650).nullable(), responsible: z.enum(["planner", "clients"]), isMilestone: z.boolean() }))
    .max(500),
  program: z
    .array(z.object({ startTime: z.string().regex(/^\d{2}:\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/).nullable(), label: text(300), location: optionalText(200) }))
    .max(300),
  slots: z.array(z.object({ label: text(120), icon: z.string().max(60).nullable(), notRequired: z.boolean(), lines: z.array(z.object({ label: text(200) })).max(50) })).max(100),
  questionnaires: z.array(z.object({ templateId: z.uuid(), name: text(120) })).max(50),
  vendors: z.array(z.object({ slotLabel: text(120), vendorId: z.uuid().nullable(), name: text(200) })).max(200),
});

export type EventTemplateContent = z.infer<typeof eventTemplateContentSchema>;

export type TemplateFindingPlace = "task" | "program" | "slot" | "budget_line" | "questionnaire" | "vendor" | "name";
export type TemplateFinding = { place: TemplateFindingPlace; label: string; kind: "email" | "phone" | "client_name" };

export type ClientName = { firstName: string; lastName: string | null };

function nameWords(clients: readonly ClientName[]): string[] {
  const words = clients.flatMap((client) => [client.firstName, client.lastName ?? ""]);
  return [...new Set(words.map((word) => normalizeText(word)).flatMap((word) => word.split(/[^a-z0-9]+/)).filter((word) => word.length >= 3))];
}

function hasWord(textValue: string, words: readonly string[]): boolean {
  if (words.length === 0) return false;
  const tokens = new Set(normalizeText(textValue).split(/[^a-z0-9]+/));
  return words.some((word) => tokens.has(word));
}

function inspect(place: TemplateFindingPlace, label: string, values: (string | null)[], words: readonly string[]): TemplateFinding[] {
  const found: TemplateFinding[] = [];
  for (const value of values) {
    if (!value) continue;
    for (const finding of findPersonalData(value)) if (!found.some((item) => item.kind === finding.kind)) found.push({ place, label, kind: finding.kind });
    if (hasWord(value, words) && !found.some((item) => item.kind === "client_name")) found.push({ place, label, kind: "client_name" });
  }
  return found;
}

// D5 : chaque texte copié est relu ; les prestataires (contacts professionnels, gardés à la demande)
// ne sont pas des clients, seul leur libellé de poste l'est.
export function findTemplatePersonalData(name: string, content: EventTemplateContent, clients: readonly ClientName[]): TemplateFinding[] {
  const words = nameWords(clients);
  return [
    ...inspect("name", name, [name], words),
    ...content.tasks.flatMap((task) => inspect("task", task.label, [task.label], words)),
    ...content.program.flatMap((item) => inspect("program", item.label, [item.label, item.location], words)),
    ...content.slots.flatMap((slot) => [...inspect("slot", slot.label, [slot.label], words), ...slot.lines.flatMap((line) => inspect("budget_line", line.label, [line.label], words))]),
    ...content.questionnaires.flatMap((questionnaire) => inspect("questionnaire", questionnaire.name, [questionnaire.name], words)),
    ...content.vendors.flatMap((vendor) => inspect("vendor", vendor.slotLabel, [vendor.slotLabel], words)),
  ];
}

// Les dates se recalculent à partir de la nouvelle date ; sans date, l'échéance attend.
export function dueDateFor(eventDate: string | null, offsetDays: number | null): string | null {
  if (eventDate === null || offsetDays === null) return null;
  const date = new Date(`${eventDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export const TEMPLATE_NAME_MAX = 120;

export class EventTemplateInvalidError extends Error {
  constructor(readonly reason: "name" | "content" | "personal_data", readonly findings: TemplateFinding[] = []) {
    super(`modèle d'évènement : ${reason}`);
    this.name = "EventTemplateInvalidError";
  }
}

export function cleanTemplateName(name: string): string {
  const cleaned = name.replace(/\s+/g, " ").trim();
  if (cleaned.length < 1 || cleaned.length > TEMPLATE_NAME_MAX) throw new EventTemplateInvalidError("name");
  return cleaned;
}
