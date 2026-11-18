// Lot 51 (JRJ-06 ; ADR 0091) — listes de contrôle du jour J : modèles de l'organisation (copiés des
// données de départ day-checklists.json à la première lecture, puis modifiés par la planner,
// HUB-20), et listes d'un évènement par temps fort (installation, démontage), copiées d'un modèle à
// l'application (HUB-21 : modifier le modèle ensuite ne change pas la liste). Une case se coche d'un
// toucher dans le mode Jour J (day-of.ts). Accès aux données du module events ; exposé seulement par
// service.ts (ADR 0011).
import { and, asc, eq, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { dayChecklistItems, dayChecklists, dayChecklistTemplates, events, keyMoments } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { starterDayChecklists } from "@symbola/starter-templates";
import type { DayChecklistPhase, DayChecklistTemplate, DayChecklistTemplateInput } from "@symbola/contracts";
import { DAY_CHECKLIST_PHASES } from "@symbola/contracts";
import { DAY_UUID } from "./day-of";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type TemplateRow = typeof dayChecklistTemplates.$inferSelect;

export const DAY_CHECKLIST_NAME_MAX = 100;
export const DAY_CHECKLIST_ITEM_MAX = 200;
export const DAY_CHECKLIST_ITEMS_MAX = 100;

export class DayChecklistInvalidError extends Error {
  constructor(readonly reason: "name" | "phase" | "items" | "moment") {
    super(`liste du jour J invalide : ${reason}`);
    this.name = "DayChecklistInvalidError";
  }
}

// Modèle, liste ou case d'une autre organisation, ou inexistants : même réponse (SEC-13).
export class DayChecklistNotFoundError extends Error {
  constructor() {
    super("liste du jour J introuvable");
    this.name = "DayChecklistNotFoundError";
  }
}

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

const oneLine = (value: string) => value.replace(/\s+/g, " ").trim();

export function cleanChecklistInput(input: DayChecklistTemplateInput): DayChecklistTemplateInput {
  const name = oneLine(input.name);
  if (!name || name.length > DAY_CHECKLIST_NAME_MAX) throw new DayChecklistInvalidError("name");
  if (!(DAY_CHECKLIST_PHASES as readonly string[]).includes(input.phase)) throw new DayChecklistInvalidError("phase");
  const items = input.items.map(oneLine).filter(Boolean);
  if (items.length > DAY_CHECKLIST_ITEMS_MAX || items.some((item) => item.length > DAY_CHECKLIST_ITEM_MAX)) throw new DayChecklistInvalidError("items");
  return { name, phase: input.phase, items };
}

function toTemplate(row: TemplateRow): DayChecklistTemplate {
  return { id: row.id, starterKey: row.starterKey, name: row.name, phase: row.phase as DayChecklistPhase, items: row.items, position: row.position };
}

// La première lecture copie les modèles de départ, dans la langue de l'organisation ; ensuite la
// liste est celle de l'organisation (un modèle supprimé ne revient pas).
export async function listDayChecklistTemplates(organizationId: string, locale: "fr" | "en"): Promise<DayChecklistTemplate[]> {
  return inOrganization(organizationId, async (tx) => {
    let rows = await tx.select().from(dayChecklistTemplates).orderBy(asc(dayChecklistTemplates.position), asc(dayChecklistTemplates.createdAt));
    if (rows.length === 0) {
      const [{ seeded } = { seeded: 0 }] = await tx.select({ seeded: sql<number>`count(*)::int` }).from(dayChecklistTemplates).where(sql`${dayChecklistTemplates.starterKey} is not null`);
      if (seeded === 0) {
        await tx
          .insert(dayChecklistTemplates)
          .values(starterDayChecklists(locale).map((template, position) => ({ organizationId, starterKey: template.key, name: template.name, phase: template.phase, items: template.items, position })))
          .onConflictDoNothing();
        rows = await tx.select().from(dayChecklistTemplates).orderBy(asc(dayChecklistTemplates.position), asc(dayChecklistTemplates.createdAt));
      }
    }
    return rows.map(toTemplate);
  });
}

export async function saveDayChecklistTemplate(organizationId: string, templateId: string | null, input: DayChecklistTemplateInput): Promise<DayChecklistTemplate> {
  const clean = cleanChecklistInput(input);
  return inOrganization(organizationId, async (tx) => {
    if (templateId) {
      if (!DAY_UUID.test(templateId)) throw new DayChecklistNotFoundError();
      const [row] = await tx.update(dayChecklistTemplates).set({ ...clean, updatedAt: new Date() }).where(eq(dayChecklistTemplates.id, templateId)).returning();
      if (!row) throw new DayChecklistNotFoundError();
      return toTemplate(row);
    }
    const [{ next } = { next: 0 }] = await tx.select({ next: sql<number>`coalesce(max(${dayChecklistTemplates.position}) + 1, 0)::int` }).from(dayChecklistTemplates);
    const [row] = await tx.insert(dayChecklistTemplates).values({ organizationId, ...clean, position: next }).returning();
    return toTemplate(row!);
  });
}

export async function removeDayChecklistTemplate(organizationId: string, templateId: string): Promise<void> {
  if (!DAY_UUID.test(templateId)) throw new DayChecklistNotFoundError();
  const removed = await inOrganization(organizationId, (tx) => tx.delete(dayChecklistTemplates).where(eq(dayChecklistTemplates.id, templateId)).returning({ id: dayChecklistTemplates.id }));
  if (removed.length === 0) throw new DayChecklistNotFoundError();
}

// Une liste pour un temps fort de l'évènement : copiée d'un modèle (nom, nature, cases), ou vide.
export async function createDayChecklist(input: { organizationId: string; eventId: string; keyMomentId: string | null; templateId: string | null; name?: string; phase?: DayChecklistPhase }): Promise<string> {
  if (!DAY_UUID.test(input.eventId)) throw new DayChecklistNotFoundError();
  return inOrganization(input.organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId));
    if (!event) throw new DayChecklistNotFoundError();
    if (input.keyMomentId) {
      if (!DAY_UUID.test(input.keyMomentId)) throw new DayChecklistInvalidError("moment");
      const [moment] = await tx.select({ id: keyMoments.id }).from(keyMoments).where(and(eq(keyMoments.id, input.keyMomentId), eq(keyMoments.eventId, input.eventId)));
      if (!moment) throw new DayChecklistInvalidError("moment");
    }
    let values: DayChecklistTemplateInput;
    if (input.templateId) {
      if (!DAY_UUID.test(input.templateId)) throw new DayChecklistNotFoundError();
      const [template] = await tx.select().from(dayChecklistTemplates).where(eq(dayChecklistTemplates.id, input.templateId));
      if (!template) throw new DayChecklistNotFoundError();
      values = { name: template.name, phase: template.phase as DayChecklistPhase, items: template.items };
    } else {
      values = cleanChecklistInput({ name: input.name ?? "", phase: input.phase ?? "setup", items: [] });
    }
    const [{ next } = { next: 0 }] = await tx.select({ next: sql<number>`coalesce(max(${dayChecklists.position}) + 1, 0)::int` }).from(dayChecklists).where(eq(dayChecklists.eventId, input.eventId));
    const [list] = await tx
      .insert(dayChecklists)
      .values({ organizationId: input.organizationId, eventId: input.eventId, keyMomentId: input.keyMomentId, templateId: input.templateId, name: values.name, phase: values.phase, position: next })
      .returning({ id: dayChecklists.id });
    if (values.items.length > 0) await tx.insert(dayChecklistItems).values(values.items.map((label, position) => ({ organizationId: input.organizationId, checklistId: list!.id, label, position })));
    return list!.id;
  });
}

async function listOfEvent(tx: Tx, eventId: string, checklistId: string): Promise<boolean> {
  if (!DAY_UUID.test(checklistId)) return false;
  const [row] = await tx.select({ id: dayChecklists.id }).from(dayChecklists).where(and(eq(dayChecklists.id, checklistId), eq(dayChecklists.eventId, eventId)));
  return Boolean(row);
}

export async function addDayChecklistItem(input: { organizationId: string; eventId: string; checklistId: string; label: string }): Promise<void> {
  const label = oneLine(input.label);
  if (!label || label.length > DAY_CHECKLIST_ITEM_MAX) throw new DayChecklistInvalidError("items");
  await inOrganization(input.organizationId, async (tx) => {
    if (!(await listOfEvent(tx, input.eventId, input.checklistId))) throw new DayChecklistNotFoundError();
    const [{ count, next } = { count: 0, next: 0 }] = await tx
      .select({ count: sql<number>`count(*)::int`, next: sql<number>`coalesce(max(${dayChecklistItems.position}) + 1, 0)::int` })
      .from(dayChecklistItems)
      .where(eq(dayChecklistItems.checklistId, input.checklistId));
    if (count >= DAY_CHECKLIST_ITEMS_MAX) throw new DayChecklistInvalidError("items");
    await tx.insert(dayChecklistItems).values({ organizationId: input.organizationId, checklistId: input.checklistId, label, position: next });
  });
}

// Une case cochée garde sa trace : seule une case encore vide se retire.
export async function removeDayChecklistItem(input: { organizationId: string; eventId: string; itemId: string }): Promise<void> {
  if (!DAY_UUID.test(input.itemId)) throw new DayChecklistNotFoundError();
  await inOrganization(input.organizationId, async (tx) => {
    const [row] = await tx
      .select({ id: dayChecklistItems.id, checkedAt: dayChecklistItems.checkedAt })
      .from(dayChecklistItems)
      .innerJoin(dayChecklists, eq(dayChecklists.id, dayChecklistItems.checklistId))
      .where(and(eq(dayChecklistItems.id, input.itemId), eq(dayChecklists.eventId, input.eventId)));
    if (!row) throw new DayChecklistNotFoundError();
    if (row.checkedAt) throw new DayChecklistInvalidError("items");
    await tx.delete(dayChecklistItems).where(eq(dayChecklistItems.id, row.id));
  });
}

// Une liste dont une case est cochée reste (bilan) ; une liste encore vierge se retire.
export async function removeDayChecklist(input: { organizationId: string; eventId: string; checklistId: string }): Promise<void> {
  await inOrganization(input.organizationId, async (tx) => {
    if (!(await listOfEvent(tx, input.eventId, input.checklistId))) throw new DayChecklistNotFoundError();
    const [checked] = await tx.select({ id: dayChecklistItems.id }).from(dayChecklistItems).where(and(eq(dayChecklistItems.checklistId, input.checklistId), sql`${dayChecklistItems.checkedAt} is not null`)).limit(1);
    if (checked) throw new DayChecklistInvalidError("items");
    await tx.delete(dayChecklists).where(eq(dayChecklists.id, input.checklistId));
  });
}
