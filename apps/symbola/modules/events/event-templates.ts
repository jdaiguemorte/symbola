// Lot 58 (EVT-08 ; D5 ; ADR 0097) — modèles d'évènement et duplication, côté module events. Un modèle
// ne garde que des structures : les tâches du rétroplanning et leur écart au jour J, le programme
// (heures, libellés, lieux), les postes (sans montant), les questionnaires et, si la planner coche la
// case, les prestataires retenus (contacts professionnels). Le contrôle « aucune donnée personnelle »
// (template-rules) refuse tout enregistrement qui en contient. Les lignes du budget (module Budget)
// sont ajoutées par lib/events/event-templates, qui orchestre les deux modules (ADR 0011).
import { and, asc, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { eventQuestionnaires, events, eventTasks, eventTemplates, eventVendorCandidates, eventVendorSlots, programItems } from "@symbola/db/schema/events";
import { starterQuestionnaireTaskLabel } from "@symbola/starter-templates";
import { EventNotFoundError } from "./errors";
import { cleanTemplateName, dueDateFor, eventTemplateContentSchema, EventTemplateInvalidError, findTemplatePersonalData, type ClientName, type EventTemplateContent } from "./template-rules";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RETAINED = ["retained", "contract_signed", "paid_off"] as const;

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

export class EventTemplateNotFoundError extends Error {
  constructor() {
    super("modèle d'évènement introuvable");
    this.name = "EventTemplateNotFoundError";
  }
}

function time(value: string | null): string | null {
  return value ? value.slice(0, 5) : null;
}

// Les structures d'un évènement (sans les lignes du budget, ajoutées par l'orchestration).
export async function readEventStructure(organizationId: string, eventId: string, options: { includeVendors: boolean }): Promise<{ content: EventTemplateContent; eventTypeId: string | null; eventDate: string | null; prospectSourceId: string | null } | null> {
  if (!UUID.test(eventId)) return null;
  return inOrganization(organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id, eventTypeId: events.eventTypeId, eventDate: events.eventDate, prospectSourceId: events.prospectSourceId }).from(events).where(eq(events.id, eventId));
    if (!event) return null;
    const tasks = await tx
      .select({ label: eventTasks.label, offsetDays: eventTasks.offsetDays, dueDate: eventTasks.dueDate, responsible: eventTasks.responsible, isMilestone: eventTasks.isMilestone })
      .from(eventTasks)
      // Les tâches de suivi d'un prestataire retenu (lot 47) se recréent quand il est retenu à nouveau.
      .where(and(eq(eventTasks.eventId, eventId), isNull(eventTasks.followUpCandidateId)))
      .orderBy(asc(eventTasks.dueDate), asc(eventTasks.position));
    const program = await tx
      .select({ startTime: programItems.startTime, endTime: programItems.endTime, label: programItems.label, location: programItems.location })
      .from(programItems)
      .where(eq(programItems.eventId, eventId))
      .orderBy(asc(programItems.startTime));
    const slots = await tx.select().from(eventVendorSlots).where(eq(eventVendorSlots.eventId, eventId)).orderBy(asc(eventVendorSlots.position));
    const questionnaires = await tx
      .selectDistinct({ templateId: eventQuestionnaires.templateId, name: eventQuestionnaires.name })
      .from(eventQuestionnaires)
      .where(and(eq(eventQuestionnaires.eventId, eventId), isNotNull(eventQuestionnaires.templateId)));
    const candidates = options.includeVendors
      ? await tx
          .select({ slotId: eventVendorCandidates.vendorSlotId, vendorId: eventVendorCandidates.vendorId, name: eventVendorCandidates.vendorName })
          .from(eventVendorCandidates)
          .where(and(eq(eventVendorCandidates.eventId, eventId), inArray(eventVendorCandidates.status, [...RETAINED])))
      : [];
    const slotLabel = new Map(slots.map((slot) => [slot.id, slot.label]));
    const offsetOf = (task: (typeof tasks)[number]) => task.offsetDays ?? (event.eventDate ? Math.round((Date.parse(`${task.dueDate}T00:00:00Z`) - Date.parse(`${event.eventDate}T00:00:00Z`)) / 86_400_000) : null);
    const content: EventTemplateContent = {
      version: 1,
      tasks: tasks.map((task) => ({ label: task.label, offsetDays: offsetOf(task), responsible: task.responsible === "vendor" ? "planner" : task.responsible, isMilestone: task.isMilestone })),
      program: program.map((item) => ({ startTime: time(item.startTime)!, endTime: time(item.endTime), label: item.label, location: item.location })),
      slots: slots.map((slot) => ({ label: slot.label, icon: slot.icon, notRequired: slot.notRequired, lines: [] })),
      questionnaires: [...new Map(questionnaires.map((row) => [row.templateId!, { templateId: row.templateId!, name: row.name }])).values()],
      vendors: candidates.filter((candidate) => slotLabel.has(candidate.slotId)).map((candidate) => ({ slotLabel: slotLabel.get(candidate.slotId)!, vendorId: candidate.vendorId, name: candidate.name })),
    };
    return { content, eventTypeId: event.eventTypeId, eventDate: event.eventDate, prospectSourceId: event.prospectSourceId };
  });
}

export type EventTemplateSummary = { id: string; name: string; eventTypeId: string | null; includesVendors: boolean; taskCount: number; programCount: number; slotCount: number; createdAt: string };
export type EventTemplateDetail = EventTemplateSummary & { content: EventTemplateContent };

function toSummary(row: typeof eventTemplates.$inferSelect): EventTemplateDetail {
  const content = eventTemplateContentSchema.parse(row.content);
  return {
    id: row.id,
    name: row.name,
    eventTypeId: row.eventTypeId,
    includesVendors: row.includesVendors,
    taskCount: content.tasks.length,
    programCount: content.program.length,
    slotCount: content.slots.length,
    createdAt: row.createdAt.toISOString(),
    content,
  };
}

// D5 : contrôle avant l'écriture ; les noms des clients de l'évènement source sont cherchés dans
// chaque texte copié, avec les e-mails et téléphones.
export async function saveEventTemplate(input: { organizationId: string; name: string; eventTypeId: string | null; sourceEventId: string | null; includesVendors: boolean; content: EventTemplateContent; clients: readonly ClientName[] }): Promise<EventTemplateDetail> {
  const name = cleanTemplateName(input.name);
  const parsed = eventTemplateContentSchema.safeParse(input.includesVendors ? input.content : { ...input.content, vendors: [] });
  if (!parsed.success) throw new EventTemplateInvalidError("content");
  const findings = findTemplatePersonalData(name, parsed.data, input.clients);
  if (findings.length > 0) throw new EventTemplateInvalidError("personal_data", findings);
  const [row] = await inOrganization(input.organizationId, (tx) =>
    tx
      .insert(eventTemplates)
      .values({ organizationId: input.organizationId, name, eventTypeId: input.eventTypeId, sourceEventId: input.sourceEventId, includesVendors: input.includesVendors, content: parsed.data })
      .returning(),
  );
  return toSummary(row!);
}

export async function listEventTemplates(organizationId: string): Promise<EventTemplateSummary[]> {
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(eventTemplates).orderBy(desc(eventTemplates.createdAt)));
  return rows.map((row) => {
    const { content: _content, ...summary } = toSummary(row);
    return summary;
  });
}

export async function getEventTemplate(organizationId: string, templateId: string): Promise<EventTemplateDetail | null> {
  if (!UUID.test(templateId)) return null;
  const [row] = await inOrganization(organizationId, (tx) => tx.select().from(eventTemplates).where(eq(eventTemplates.id, templateId)));
  return row ? toSummary(row) : null;
}

export async function removeEventTemplate(organizationId: string, templateId: string): Promise<void> {
  if (!UUID.test(templateId)) throw new EventTemplateNotFoundError();
  const removed = await inOrganization(organizationId, (tx) => tx.delete(eventTemplates).where(eq(eventTemplates.id, templateId)).returning({ id: eventTemplates.id }));
  if (removed.length === 0) throw new EventTemplateNotFoundError();
}

// Pose les structures d'un modèle sur un évènement neuf (créé par le service, sans client) : tâches à
// leurs dates recalculées, postes, prestataires gardés (présélectionnés), une tâche par questionnaire.
// Le programme passe par le service (temps fort du jour) ; renvoie les postes créés, par libellé.
export async function applyTemplateStructures(input: { organizationId: string; eventId: string; eventDate: string; content: EventTemplateContent; locale: "fr" | "en" }): Promise<Map<string, string>> {
  return inOrganization(input.organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId));
    if (!event) throw new EventNotFoundError();
    const tasks = [
      ...input.content.tasks.map((task) => ({ label: task.label, offsetDays: task.offsetDays, responsible: task.responsible, isMilestone: task.isMilestone })),
      ...input.content.questionnaires.map((questionnaire) => ({ label: starterQuestionnaireTaskLabel(input.locale, questionnaire.name).slice(0, 300), offsetDays: null, responsible: "planner" as const, isMilestone: false })),
    ];
    if (tasks.length > 0) {
      await tx.insert(eventTasks).values(
        tasks.map((task, position) => ({
          organizationId: input.organizationId,
          eventId: input.eventId,
          label: task.label,
          offsetDays: task.offsetDays,
          dueDate: dueDateFor(input.eventDate, task.offsetDays) ?? input.eventDate,
          responsible: task.responsible,
          isMilestone: task.isMilestone,
          position,
        })),
      );
    }
    await tx.update(events).set({ tasksScheduledFor: input.eventDate }).where(eq(events.id, input.eventId));
    const slotIds = new Map<string, string>();
    for (const [position, slot] of input.content.slots.entries()) {
      const [row] = await tx
        .insert(eventVendorSlots)
        .values({ organizationId: input.organizationId, eventId: input.eventId, label: slot.label, icon: slot.icon, notRequired: slot.notRequired, position })
        .returning({ id: eventVendorSlots.id });
      if (!slotIds.has(slot.label)) slotIds.set(slot.label, row!.id);
    }
    const vendors = input.content.vendors.filter((vendor) => slotIds.has(vendor.slotLabel));
    if (vendors.length > 0) {
      await tx.insert(eventVendorCandidates).values(
        vendors.map((vendor, position) => ({ organizationId: input.organizationId, eventId: input.eventId, vendorSlotId: slotIds.get(vendor.slotLabel)!, vendorId: vendor.vendorId, vendorName: vendor.name, status: "shortlisted" as const, position })),
      );
    }
    return slotIds;
  });
}
