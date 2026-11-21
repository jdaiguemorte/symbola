// Lot 64 (HUB-29, RDV-02 ; D1 à D6 ; ADR 0108) — plages occupées : règles des types, réglage propre
// d'un évènement, réglages de l'organisation, et plages d'une fenêtre pour le flux d'agenda et la page
// de rendez-vous. Accès aux données du module events ; exposé seulement par service.ts (ADR 0011).
import { and, eq, gte, inArray, isNotNull, lte, ne } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { busySettings, eventTeamMembers, eventTypes, events } from "@symbola/db/schema/events";
import type { BusyRangeItem, BusyRule, BusyRuleSource, BusySettingsView, EventBusyView, EventStatus, EventTypeBusyRule } from "@symbola/contracts";
import { starterBusyRule, starterBusySettings } from "@symbola/starter-templates";
import { assertEventWritable } from "./closing";
import { busyRange, busyRangeDates, isBlocking, isValidBusyRule, overlapsWindow, resolveBusyRule, shortTime } from "./busy-ranges";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export class BusyRuleInvalidError extends Error {
  constructor(readonly reason: "rule" | "not_found") {
    super("plage occupée refusée");
    this.name = "BusyRuleInvalidError";
  }
}

type RuleColumns = { startDay: number | null; startTime: string | null; endDay: number | null; endTime: string | null };

function ruleOf(columns: RuleColumns): BusyRule | null {
  if (columns.startDay === null || columns.startTime === null || columns.endDay === null || columns.endTime === null) return null;
  return { startDayOffset: columns.startDay, startTime: shortTime(columns.startTime), endDayOffset: columns.endDay, endTime: shortTime(columns.endTime) };
}

function normalizedRule(input: unknown): BusyRule {
  const value = input as Partial<Record<keyof BusyRule, unknown>> | null;
  const rule = {
    startDayOffset: Number(value?.startDayOffset),
    startTime: String(value?.startTime ?? ""),
    endDayOffset: Number(value?.endDayOffset),
    endTime: String(value?.endTime ?? ""),
  };
  if (!isValidBusyRule(rule)) throw new BusyRuleInvalidError("rule");
  return { ...rule, startTime: shortTime(rule.startTime), endTime: shortTime(rule.endTime) };
}

// —— Réglages de l'organisation (D2) ——————————————————————————————————————————————————————

async function readSettings(tx: Tx, organizationId: string): Promise<BusySettingsView> {
  const [row] = await tx.select().from(busySettings).where(eq(busySettings.organizationId, organizationId));
  if (!row) return { ...starterBusySettings(), isStarter: true };
  const fallback = ruleOf({ startDay: row.fallbackStartDayOffset, startTime: row.fallbackStartTime, endDay: row.fallbackEndDayOffset, endTime: row.fallbackEndTime })!;
  return { optionsBlock: row.optionsBlock, fallback, isStarter: false };
}

export async function getBusySettings(organizationId: string): Promise<BusySettingsView> {
  return inOrganization(organizationId, (tx) => readSettings(tx, organizationId));
}

export async function setBusySettings(organizationId: string, input: { optionsBlock?: boolean; fallback?: unknown }): Promise<BusySettingsView> {
  const fallback = input.fallback === undefined ? undefined : normalizedRule(input.fallback);
  return inOrganization(organizationId, async (tx) => {
    const current = await readSettings(tx, organizationId);
    const next = { optionsBlock: input.optionsBlock ?? current.optionsBlock, fallback: fallback ?? current.fallback };
    const values = {
      optionsBlock: next.optionsBlock,
      fallbackStartDayOffset: next.fallback.startDayOffset,
      fallbackStartTime: next.fallback.startTime,
      fallbackEndDayOffset: next.fallback.endDayOffset,
      fallbackEndTime: next.fallback.endTime,
    };
    await tx
      .insert(busySettings)
      .values({ organizationId, ...values })
      .onConflictDoUpdate({ target: busySettings.organizationId, set: { ...values, updatedAt: new Date() } });
    return { ...next, isStarter: false };
  });
}

// —— Règle de chaque type (D1) ————————————————————————————————————————————————————————————

function typeRule(row: { starterKey: string | null } & RuleColumns, fallback: BusyRule): { rule: BusyRule; isStarter: boolean } {
  const own = ruleOf(row);
  if (own) return { rule: own, isStarter: false };
  return { rule: row.starterKey ? starterBusyRule(row.starterKey) : fallback, isStarter: true };
}

const typeColumns = {
  id: eventTypes.id,
  label: eventTypes.label,
  position: eventTypes.position,
  starterKey: eventTypes.starterKey,
  startDay: eventTypes.busyStartDayOffset,
  startTime: eventTypes.busyStartTime,
  endDay: eventTypes.busyEndDayOffset,
  endTime: eventTypes.busyEndTime,
};

export async function listEventTypeBusyRules(organizationId: string): Promise<EventTypeBusyRule[]> {
  return inOrganization(organizationId, async (tx) => {
    const settings = await readSettings(tx, organizationId);
    const rows = await tx.select(typeColumns).from(eventTypes).where(eq(eventTypes.organizationId, organizationId));
    return rows
      .sort((a, b) => a.position - b.position || a.label.localeCompare(b.label))
      .map((row) => ({ eventTypeId: row.id, label: row.label, ...typeRule(row, settings.fallback) }));
  });
}

// rule nul : retour à la règle de départ du type.
export async function setEventTypeBusyRule(organizationId: string, eventTypeId: string, input: unknown | null): Promise<void> {
  if (!UUID.test(eventTypeId)) throw new BusyRuleInvalidError("not_found");
  const rule = input === null ? null : normalizedRule(input);
  const updated = await inOrganization(organizationId, (tx) =>
    tx
      .update(eventTypes)
      .set({
        busyStartDayOffset: rule?.startDayOffset ?? null,
        busyStartTime: rule?.startTime ?? null,
        busyEndDayOffset: rule?.endDayOffset ?? null,
        busyEndTime: rule?.endTime ?? null,
        updatedAt: new Date(),
      })
      .where(and(eq(eventTypes.id, eventTypeId), eq(eventTypes.organizationId, organizationId)))
      .returning({ id: eventTypes.id }),
  );
  if (updated.length === 0) throw new BusyRuleInvalidError("not_found");
}

// —— Un évènement (réglage propre) ————————————————————————————————————————————————————————

const eventColumns = {
  id: events.id,
  status: events.status,
  eventDate: events.eventDate,
  timeZone: events.timeZone,
  isDemo: events.isDemo,
  eventTypeId: events.eventTypeId,
  startDay: events.busyStartDayOffset,
  startTime: events.busyStartTime,
  endDay: events.busyEndDayOffset,
  endTime: events.busyEndTime,
};

type EventRow = { id: string; status: EventStatus; eventDate: string | null; timeZone: string; isDemo: boolean; eventTypeId: string | null } & RuleColumns;
type TypeRow = { id: string; label: string; starterKey: string | null } & RuleColumns;

function eventRule(event: EventRow, types: Map<string, TypeRow>, settings: BusySettingsView): { rule: BusyRule; source: BusyRuleSource; typeLabel: string | null } {
  const type = event.eventTypeId ? types.get(event.eventTypeId) : undefined;
  const resolved = resolveBusyRule({ own: ruleOf(event), type: type ? typeRule(type, settings.fallback).rule : null, fallback: settings.fallback });
  return { ...resolved, typeLabel: type?.label ?? null };
}

async function readTypes(tx: Tx, organizationId: string): Promise<Map<string, TypeRow>> {
  const rows = await tx.select(typeColumns).from(eventTypes).where(eq(eventTypes.organizationId, organizationId));
  return new Map(rows.map((row) => [row.id, row]));
}

async function readTeams(tx: Tx, eventIds: string[]): Promise<Map<string, string[]>> {
  const teams = new Map<string, string[]>();
  if (eventIds.length === 0) return teams;
  const rows = await tx.select({ eventId: eventTeamMembers.eventId, userId: eventTeamMembers.userId }).from(eventTeamMembers).where(inArray(eventTeamMembers.eventId, eventIds));
  for (const row of rows) teams.set(row.eventId, [...(teams.get(row.eventId) ?? []), row.userId]);
  return teams;
}

export async function getEventBusy(organizationId: string, eventId: string): Promise<EventBusyView | null> {
  if (!UUID.test(eventId)) return null;
  return inOrganization(organizationId, async (tx) => {
    const [event] = await tx.select(eventColumns).from(events).where(eq(events.id, eventId));
    if (!event) return null;
    const [settings, types, teams] = await Promise.all([readSettings(tx, organizationId), readTypes(tx, organizationId), readTeams(tx, [eventId])]);
    const { rule, source, typeLabel } = eventRule(event, types, settings);
    const dates = event.eventDate ? busyRangeDates(event.eventDate, rule) : null;
    const range = event.eventDate ? busyRange(event.eventDate, rule, event.timeZone) : null;
    return {
      rule,
      source,
      typeLabel,
      startDate: dates?.startDate ?? null,
      endDate: dates?.endDate ?? null,
      startsAt: range?.start.toISOString() ?? null,
      endsAt: range?.end.toISOString() ?? null,
      timeZone: event.timeZone,
      blocking: isBlocking(event, settings.optionsBlock),
      status: event.status,
      teamUserIds: teams.get(eventId) ?? [],
    };
  });
}

// rule nul : retour à la règle du type.
export async function setEventBusyRule(organizationId: string, eventId: string, input: unknown | null): Promise<void> {
  if (!UUID.test(eventId)) throw new BusyRuleInvalidError("not_found");
  const rule = input === null ? null : normalizedRule(input);
  // Lot 58 : un évènement archivé est en lecture seule.
  await assertEventWritable(organizationId, eventId);
  const updated = await inOrganization(organizationId, (tx) =>
    tx
      .update(events)
      .set({
        busyStartDayOffset: rule?.startDayOffset ?? null,
        busyStartTime: rule?.startTime ?? null,
        busyEndDayOffset: rule?.endDayOffset ?? null,
        busyEndTime: rule?.endTime ?? null,
        updatedAt: new Date(),
      })
      .where(eq(events.id, eventId))
      .returning({ id: events.id }),
  );
  if (updated.length === 0) throw new BusyRuleInvalidError("not_found");
}

// —— Plages d'une fenêtre (flux d'agenda, rendez-vous) ———————————————————————————————————————

// Les plages des évènements datés qui touchent la fenêtre. userId (D3) : seulement les évènements
// sans équipe ou dont la personne est de l'équipe. blocking dit si la plage bloque (D2) ; le flux
// montre aussi les autres, en provisoire.
export async function listBusyRanges(organizationId: string, window: { from: Date; to: Date }, options: { userId?: string } = {}): Promise<BusyRangeItem[]> {
  // Une règle va au plus de 7 jours avant à 7 jours après : les dates de la fenêtre élargie suffisent.
  const margin = 8 * 86_400_000;
  const fromDate = new Date(window.from.getTime() - margin).toISOString().slice(0, 10);
  const toDate = new Date(window.to.getTime() + margin).toISOString().slice(0, 10);
  return inOrganization(organizationId, async (tx) => {
    const candidates = await tx
      .select(eventColumns)
      .from(events)
      .where(and(isNotNull(events.eventDate), gte(events.eventDate, fromDate), lte(events.eventDate, toDate), eq(events.isDemo, false), ne(events.status, "cancelled")));
    if (candidates.length === 0) return [];
    const [settings, types, teams] = await Promise.all([readSettings(tx, organizationId), readTypes(tx, organizationId), readTeams(tx, candidates.map((row) => row.id))]);
    const items: BusyRangeItem[] = [];
    for (const event of candidates) {
      const team = teams.get(event.id) ?? [];
      if (options.userId && team.length > 0 && !team.includes(options.userId)) continue;
      const { rule } = eventRule(event, types, settings);
      const range = busyRange(event.eventDate!, rule, event.timeZone);
      if (!overlapsWindow(range, window)) continue;
      items.push({ eventId: event.id, ...range, blocking: isBlocking(event, settings.optionsBlock) });
    }
    return items.sort((a, b) => a.start.getTime() - b.start.getTime());
  });
}

// Les plages de tous les évènements datés d'une organisation, par évènement : pour le flux d'agenda,
// qui montre aussi le passé. userId (D3) comme ci-dessus.
export async function listEventBusyRanges(organizationId: string, options: { userId?: string } = {}): Promise<Map<string, BusyRangeItem>> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select(eventColumns).from(events).where(and(isNotNull(events.eventDate), eq(events.isDemo, false)));
    const [settings, types, teams] = await Promise.all([readSettings(tx, organizationId), readTypes(tx, organizationId), readTeams(tx, rows.map((row) => row.id))]);
    const result = new Map<string, BusyRangeItem>();
    for (const event of rows) {
      const team = teams.get(event.id) ?? [];
      if (options.userId && team.length > 0 && !team.includes(options.userId)) continue;
      const { rule } = eventRule(event, types, settings);
      result.set(event.id, { eventId: event.id, ...busyRange(event.eventDate!, rule, event.timeZone), blocking: isBlocking(event, settings.optionsBlock) });
    }
    return result;
  });
}
