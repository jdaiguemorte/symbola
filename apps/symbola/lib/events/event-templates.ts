// Lot 58 (EVT-08 ; D5 ; ADR 0097) — modèle d'évènement et duplication, orchestrés entre les modules
// events et budget par leurs service.ts (ADR 0011) : les structures de l'évènement (module events) et
// les libellés des lignes de son budget, sans montant (module Budget). Ni client, ni invité, ni devis,
// ni facture ; le contrôle « aucune donnée personnelle » s'applique avant tout enregistrement.
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { addBudgetLine, listBudgetLines } from "@/modules/budget/service";
import {
  createEventFromStructure,
  EventNotFoundError,
  findTemplatePersonalData,
  getEvent,
  getEventTemplate,
  EventTemplateNotFoundError,
  readEventStructureOf,
  saveEventTemplate,
  EventTemplateInvalidError,
  type EventTemplateContent,
  type EventTemplateDetail,
} from "@/modules/events/service";

async function structureWithBudget(organizationId: string, eventId: string, includeVendors: boolean) {
  const structure = await readEventStructureOf(organizationId, eventId, includeVendors);
  if (!structure) throw new EventNotFoundError();
  if (await isBudgetModuleEnabled(organizationId)) {
    const budget = await listBudgetLines(organizationId, eventId);
    const slots = structure.content.slots.map((slot) => {
      const category = budget.categories.find((entry) => entry.label === slot.label);
      const labels = [...new Set((category?.lines ?? []).map((line) => line.label.trim()).filter((label) => label && label !== slot.label))].slice(0, 50);
      return { ...slot, lines: labels.map((label) => ({ label: label.slice(0, 200) })) };
    });
    return { ...structure, content: { ...structure.content, slots } };
  }
  return structure;
}

async function addBudgetStructure(organizationId: string, eventId: string, content: EventTemplateContent, slotIds: Map<string, string>): Promise<void> {
  if (!(await isBudgetModuleEnabled(organizationId))) return;
  for (const slot of content.slots) {
    const slotId = slotIds.get(slot.label);
    if (!slotId) continue;
    for (const line of slot.lines) await addBudgetLine({ organizationId, eventId, eventVendorSlotId: slotId, label: line.label });
  }
}

// EVT-08 : enregistrer comme modèle. Les noms des clients de l'évènement sont cherchés dans chaque
// texte copié ; les prestataires ne sont gardés que si la planner a coché la case.
export async function saveEventAsTemplate(organizationId: string, eventId: string, input: { name: string; includeVendors: boolean }): Promise<EventTemplateDetail> {
  const event = await getEvent(organizationId, eventId);
  if (!event) throw new EventNotFoundError();
  const structure = await structureWithBudget(organizationId, eventId, input.includeVendors);
  return saveEventTemplate({
    organizationId,
    name: input.name,
    eventTypeId: structure.eventTypeId,
    sourceEventId: eventId,
    includesVendors: input.includeVendors,
    content: structure.content,
    clients: event.clients.map((client) => ({ firstName: client.firstName, lastName: client.lastName ?? null })),
  });
}

// EVT-08 : dupliquer à une nouvelle date ; la copie passe le même contrôle que le modèle.
export async function duplicateEvent(organizationId: string, eventId: string, input: { eventDate: string; userId: string; locale: "fr" | "en"; includeVendors: boolean }): Promise<string> {
  const event = await getEvent(organizationId, eventId);
  if (!event) throw new EventNotFoundError();
  const structure = await structureWithBudget(organizationId, eventId, input.includeVendors);
  const findings = findTemplatePersonalData("—", structure.content, event.clients.map((client) => ({ firstName: client.firstName, lastName: client.lastName ?? null })));
  if (findings.length > 0) throw new EventTemplateInvalidError("personal_data", findings);
  const created = await createEventFromStructure({ organizationId, userId: input.userId, eventDate: input.eventDate, eventTypeId: structure.eventTypeId, prospectSourceId: structure.prospectSourceId, content: structure.content, locale: input.locale });
  await addBudgetStructure(organizationId, created.eventId, structure.content, created.slotIds);
  return created.eventId;
}

export async function createEventFromTemplate(organizationId: string, templateId: string, input: { eventDate: string; userId: string; locale: "fr" | "en" }): Promise<string> {
  const template = await getEventTemplate(organizationId, templateId);
  if (!template) throw new EventTemplateNotFoundError();
  const created = await createEventFromStructure({ organizationId, userId: input.userId, eventDate: input.eventDate, eventTypeId: template.eventTypeId, prospectSourceId: null, content: template.content, locale: input.locale });
  await addBudgetStructure(organizationId, created.eventId, template.content, created.slotIds);
  return created.eventId;
}
