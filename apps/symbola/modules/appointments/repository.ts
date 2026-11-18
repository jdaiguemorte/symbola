// Accès aux données du module appointments (lot 46, ADR 0082) — jamais importé hors de
// modules/appointments/ (ADR 0011). Chaque requête passe par withOrganization (RLS, CLAUDE.md § 5),
// sauf la recherche publique d'une adresse de page de réservation (lisible sans organisation).
import { and, asc, desc, eq, gt, gte, inArray, isNotNull, isNull, lt, lte, ne, or, sql } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import {
  appointmentReportActions,
  appointmentReports,
  appointments,
  appointmentTypes,
  availabilityClosures,
  availabilityRules,
  bookingPages,
  busyIntervals,
  calendarSources,
} from "@symbola/db/schema/appointments";
import { emitDomainEvent } from "@symbola/db/events/emit";
import { inTrash, markDeleted, UNMARKED } from "@symbola/db/soft-delete";
import { withOrganization } from "@symbola/db/with-organization";
import type { Range } from "./slots";

export type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
export type BookingPageRow = typeof bookingPages.$inferSelect;
export type AppointmentTypeRow = typeof appointmentTypes.$inferSelect;
export type AppointmentRow = typeof appointments.$inferSelect;
export type CalendarSourceRow = typeof calendarSources.$inferSelect;
export type ReportRow = typeof appointmentReports.$inferSelect;
export type ReportActionRow = typeof appointmentReportActions.$inferSelect;
export type AppointmentTypeWrite = Omit<typeof appointmentTypes.$inferInsert, "id" | "organizationId" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy" | "deletedAt" | "deletedBy">;
export type AppointmentWrite = Omit<typeof appointments.$inferInsert, "organizationId" | "createdAt" | "createdBy" | "updatedAt" | "updatedBy" | "deletedAt" | "deletedBy">;

export function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

// —— Page de réservation (D11) ————————————————————————————————————————————————

export function findBookingPage(organizationId: string): Promise<BookingPageRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.select().from(bookingPages).where(eq(bookingPages.organizationId, organizationId)))[0] ?? null);
}

// Lecture publique : l'organisation d'une adresse (politique public_lookup).
export async function findBookingPageBySlug(slug: string): Promise<BookingPageRow | null> {
  const [row] = await appDatabase().select().from(bookingPages).where(eq(bookingPages.slug, slug)).limit(1);
  return row ?? null;
}

export function upsertBookingPage(organizationId: string, values: { slug: string; active: boolean; privacyNotice: string | null }): Promise<BookingPageRow> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .insert(bookingPages)
      .values({ organizationId, ...values })
      .onConflictDoUpdate({ target: bookingPages.organizationId, set: { ...values, updatedAt: new Date() } })
      .returning();
    if (!row) throw new Error("enregistrement de la page échoué");
    return row;
  });
}

// —— Types (RDV-01) ——————————————————————————————————————————————————————————

export function findAppointmentTypes(organizationId: string): Promise<AppointmentTypeRow[]> {
  return inOrganization(organizationId, (tx) => tx.select().from(appointmentTypes).orderBy(asc(appointmentTypes.position), asc(appointmentTypes.createdAt)));
}

export function findAppointmentType(organizationId: string, id: string): Promise<AppointmentTypeRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.select().from(appointmentTypes).where(eq(appointmentTypes.id, id)))[0] ?? null);
}

export function insertAppointmentType(organizationId: string, values: AppointmentTypeWrite): Promise<AppointmentTypeRow> {
  return inOrganization(organizationId, async (tx) => {
    const [{ next } = { next: 0 }] = await tx.select({ next: sql<number>`coalesce(max(${appointmentTypes.position}) + 1, 0)::int` }).from(appointmentTypes);
    const [row] = await tx.insert(appointmentTypes).values({ ...values, organizationId, position: next }).returning();
    if (!row) throw new Error("création du type échouée");
    return row;
  });
}

export function updateAppointmentTypeRow(organizationId: string, id: string, values: Partial<AppointmentTypeWrite>): Promise<AppointmentTypeRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.update(appointmentTypes).set({ ...values, updatedAt: new Date() }).where(eq(appointmentTypes.id, id)).returning())[0] ?? null);
}

export function trashAppointmentTypeRow(organizationId: string, id: string): Promise<boolean> {
  return inTrash(organizationId, async (tx) => (await tx.update(appointmentTypes).set(markDeleted()).where(and(eq(appointmentTypes.id, id), isNull(appointmentTypes.deletedAt))).returning({ id: appointmentTypes.id })).length > 0);
}

export function restoreAppointmentTypeRow(organizationId: string, id: string): Promise<boolean> {
  return inTrash(organizationId, async (tx) => (await tx.update(appointmentTypes).set(UNMARKED).where(and(eq(appointmentTypes.id, id), isNotNull(appointmentTypes.deletedAt))).returning({ id: appointmentTypes.id })).length > 0);
}

// —— Disponibilités ———————————————————————————————————————————————————————————

export function findAvailability(organizationId: string, userId: string) {
  return inOrganization(organizationId, async (tx) => ({
    rules: await tx.select().from(availabilityRules).where(eq(availabilityRules.userId, userId)).orderBy(asc(availabilityRules.weekday), asc(availabilityRules.startTime)),
    closures: await tx.select().from(availabilityClosures).where(eq(availabilityClosures.userId, userId)).orderBy(asc(availabilityClosures.startsOn)),
  }));
}

export function replaceAvailabilityRules(organizationId: string, userId: string, rules: { weekday: number; startTime: string; endTime: string }[]): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    await tx.delete(availabilityRules).where(eq(availabilityRules.userId, userId));
    if (rules.length > 0) await tx.insert(availabilityRules).values(rules.map((rule) => ({ organizationId, userId, ...rule })));
  });
}

export function insertClosure(organizationId: string, userId: string, values: { startsOn: string; endsOn: string; reason: string | null }) {
  return inOrganization(organizationId, async (tx) => (await tx.insert(availabilityClosures).values({ organizationId, userId, ...values }).returning())[0]!);
}

export function deleteClosure(organizationId: string, userId: string, id: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => (await tx.delete(availabilityClosures).where(and(eq(availabilityClosures.id, id), eq(availabilityClosures.userId, userId))).returning({ id: availabilityClosures.id })).length > 0);
}

// —— Agendas extérieurs (D2, D4) ——————————————————————————————————————————————

export function findCalendarSources(organizationId: string, filter: { userId?: string } = {}): Promise<CalendarSourceRow[]> {
  return inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(calendarSources)
      .where(filter.userId ? eq(calendarSources.userId, filter.userId) : undefined)
      .orderBy(asc(calendarSources.createdAt)),
  );
}

export function findCalendarSource(organizationId: string, id: string): Promise<CalendarSourceRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.select().from(calendarSources).where(eq(calendarSources.id, id)))[0] ?? null);
}

// Le chiffré dépend de l'identifiant de la ligne (données associées) : la ligne est créée avec son
// identifiant choisi d'avance.
export function insertCalendarSource(organizationId: string, values: { id: string; userId: string; label: string; urlSealed: string; urlHint: string }): Promise<CalendarSourceRow> {
  return inOrganization(organizationId, async (tx) => (await tx.insert(calendarSources).values({ organizationId, ...values }).returning())[0]!);
}

export function deleteCalendarSource(organizationId: string, userId: string, id: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => (await tx.delete(calendarSources).where(and(eq(calendarSources.id, id), eq(calendarSources.userId, userId))).returning({ id: calendarSources.id })).length > 0);
}

// D4 : les plages occupées sont remplacées d'un bloc, dans la même transaction que l'état.
export function storeCalendarRead(organizationId: string, sourceId: string, ranges: Range[], now: Date): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    await tx.delete(busyIntervals).where(eq(busyIntervals.sourceId, sourceId));
    for (let index = 0; index < ranges.length; index += 500) {
      const batch = ranges.slice(index, index + 500);
      await tx.insert(busyIntervals).values(batch.map((range) => ({ organizationId, sourceId, startsAt: range.start, endsAt: range.end })));
    }
    await tx.update(calendarSources).set({ state: "ok", failures: 0, lastErrorKind: null, lastReadAt: now, lastSuccessAt: now, updatedAt: now }).where(eq(calendarSources.id, sourceId));
  });
}

// Un échec : compté ; au troisième de suite, la source passe « en erreur ».
export function recordCalendarFailure(organizationId: string, sourceId: string, kind: string, now: Date, errorAfter: number): Promise<CalendarSourceRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .update(calendarSources)
      .set({
        failures: sql`${calendarSources.failures} + 1`,
        state: sql`case when ${calendarSources.failures} + 1 >= ${errorAfter} then 'error' else ${calendarSources.state} end`,
        lastErrorKind: kind,
        lastReadAt: now,
        updatedAt: now,
      })
      .where(eq(calendarSources.id, sourceId))
      .returning();
    return row ?? null;
  });
}

// —— Rendez-vous ————————————————————————————————————————————————————————————————

// Verrou par personne qui reçoit : deux réservations du même créneau passent l'une après l'autre.
export async function lockHost(tx: Tx, organizationId: string, hostUserId: string): Promise<void> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtextextended(${`appointments:${organizationId}:${hostUserId}`}, 0))`);
}

// Ce qui occupe la personne qui reçoit entre deux instants : ses rendez-vous pris (marges
// comprises) et les plages de ses agendas extérieurs ; et l'état de ses agendas.
export async function readHostBusy(tx: Tx, hostUserId: string, window: Range, excludeAppointmentId: string | null) {
  const booked = await tx
    .select({ startsAt: appointments.startsAt, endsAt: appointments.endsAt, before: appointments.bufferBeforeMinutes, after: appointments.bufferAfterMinutes })
    .from(appointments)
    .where(
      and(
        eq(appointments.hostUserId, hostUserId),
        eq(appointments.status, "booked"),
        lt(appointments.startsAt, new Date(window.end.getTime() + 24 * 3_600_000)),
        gt(appointments.endsAt, new Date(window.start.getTime() - 24 * 3_600_000)),
        excludeAppointmentId ? ne(appointments.id, excludeAppointmentId) : undefined,
      ),
    );
  const sources = await tx.select().from(calendarSources).where(eq(calendarSources.userId, hostUserId));
  const external =
    sources.length === 0
      ? []
      : await tx
          .select({ startsAt: busyIntervals.startsAt, endsAt: busyIntervals.endsAt })
          .from(busyIntervals)
          .where(and(inArray(busyIntervals.sourceId, sources.map((source) => source.id)), lt(busyIntervals.startsAt, window.end), gt(busyIntervals.endsAt, window.start)));
  const busy: Range[] = [
    ...booked.map((row) => ({ start: new Date(row.startsAt.getTime() - row.before * 60_000), end: new Date(row.endsAt.getTime() + row.after * 60_000) })),
    ...external.map((row) => ({ start: row.startsAt, end: row.endsAt })),
  ];
  const rules = await tx.select().from(availabilityRules).where(eq(availabilityRules.userId, hostUserId));
  const closures = await tx.select().from(availabilityClosures).where(eq(availabilityClosures.userId, hostUserId));
  return { busy, sources, rules, closures };
}

export async function countUpcomingByEmail(tx: Tx, email: string, now: Date, excludeAppointmentId: string | null = null): Promise<number> {
  const [row] = await tx
    .select({ count: sql<number>`count(*)::int` })
    .from(appointments)
    .where(and(eq(appointments.personEmail, email), eq(appointments.status, "booked"), gt(appointments.endsAt, now), excludeAppointmentId ? ne(appointments.id, excludeAppointmentId) : undefined));
  return row?.count ?? 0;
}

export async function insertAppointmentRow(tx: Tx, organizationId: string, values: AppointmentWrite): Promise<AppointmentRow> {
  const [row] = await tx.insert(appointments).values({ ...values, organizationId }).returning();
  if (!row) throw new Error("création du rendez-vous échouée");
  return row;
}

export function updateAppointmentRow(organizationId: string, id: string, values: Partial<AppointmentWrite>, tx?: Tx): Promise<AppointmentRow | null> {
  const run = async (handle: Tx) => (await handle.update(appointments).set({ ...values, updatedAt: new Date() }).where(eq(appointments.id, id)).returning())[0] ?? null;
  return tx ? run(tx) : inOrganization(organizationId, run);
}

export function findAppointment(organizationId: string, id: string): Promise<AppointmentRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.select().from(appointments).where(eq(appointments.id, id)))[0] ?? null);
}

export function findAppointmentByTokenHash(organizationId: string, tokenHash: string): Promise<AppointmentRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.select().from(appointments).where(eq(appointments.manageTokenHash, tokenHash)))[0] ?? null);
}

export function findAppointments(
  organizationId: string,
  filter: { from?: Date; to?: Date; hostUserId?: string; eventId?: string; contactId?: string; email?: string; status?: "booked" | "cancelled"; order?: "asc" | "desc"; limit?: number },
): Promise<AppointmentRow[]> {
  return inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(appointments)
      .where(
        and(
          filter.from ? gte(appointments.endsAt, filter.from) : undefined,
          filter.to ? lt(appointments.startsAt, filter.to) : undefined,
          filter.hostUserId ? eq(appointments.hostUserId, filter.hostUserId) : undefined,
          filter.eventId ? eq(appointments.eventId, filter.eventId) : undefined,
          filter.contactId ? eq(appointments.contactId, filter.contactId) : undefined,
          filter.email ? eq(appointments.personEmail, filter.email) : undefined,
          filter.status ? eq(appointments.status, filter.status) : undefined,
        ),
      )
      .orderBy(filter.order === "desc" ? desc(appointments.startsAt) : asc(appointments.startsAt))
      .limit(filter.limit ?? 500),
  );
}

// HUB-08 : changements depuis un instant (pris, reportés, annulés).
export function findAppointmentsChangedSince(organizationId: string, since: Date): Promise<AppointmentRow[]> {
  return inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(appointments)
      .where(and(eq(appointments.isDemo, false), or(gte(appointments.createdAt, since), gte(appointments.rescheduledAt, since), gte(appointments.cancelledAt, since))))
      .orderBy(asc(appointments.startsAt)),
  );
}

// D10 : rendez-vous pris dont un rappel peut tomber dans la fenêtre.
export function findReminderCandidates(organizationId: string, now: Date, horizonHours: number): Promise<AppointmentRow[]> {
  return inOrganization(organizationId, (tx) =>
    tx
      .select()
      .from(appointments)
      .where(
        and(
          eq(appointments.status, "booked"),
          ne(appointments.reminders, "none"),
          isNotNull(appointments.personEmail),
          gt(appointments.startsAt, now),
          lte(appointments.startsAt, new Date(now.getTime() + horizonHours * 3_600_000)),
        ),
      ),
  );
}

export function emitInTransaction(tx: Tx, event: { organizationId: string; name: string; version: number; payload: unknown }): Promise<string> {
  return emitDomainEvent(tx as never, event);
}

export function trashAppointmentRow(organizationId: string, id: string): Promise<boolean> {
  return inTrash(organizationId, async (tx) => (await tx.update(appointments).set(markDeleted()).where(and(eq(appointments.id, id), isNull(appointments.deletedAt))).returning({ id: appointments.id })).length > 0);
}

export function restoreAppointmentRow(organizationId: string, id: string): Promise<boolean> {
  return inTrash(organizationId, async (tx) => (await tx.update(appointments).set(UNMARKED).where(and(eq(appointments.id, id), isNotNull(appointments.deletedAt))).returning({ id: appointments.id })).length > 0);
}

// Corbeille : types et rendez-vous marqués avant `before` (purge après 30 jours), ou tous.
export function findTrashedRows(organizationId: string, before?: Date) {
  return inTrash(organizationId, async (tx) => ({
    types: await tx
      .select({ id: appointmentTypes.id, label: appointmentTypes.name, deletedAt: appointmentTypes.deletedAt })
      .from(appointmentTypes)
      .where(and(isNotNull(appointmentTypes.deletedAt), before ? lt(appointmentTypes.deletedAt, before) : undefined)),
    appointments: await tx
      .select({ id: appointments.id, label: appointments.personName, typeName: appointments.typeName, startsAt: appointments.startsAt, deletedAt: appointments.deletedAt })
      .from(appointments)
      .where(and(isNotNull(appointments.deletedAt), before ? lt(appointments.deletedAt, before) : undefined)),
  }));
}

export function purgeTrashedRows(organizationId: string, ids: { types: string[]; appointments: string[] }): Promise<void> {
  return inTrash(organizationId, async (tx) => {
    if (ids.appointments.length > 0) await tx.delete(appointments).where(and(inArray(appointments.id, ids.appointments), isNotNull(appointments.deletedAt)));
    if (ids.types.length > 0) await tx.delete(appointmentTypes).where(and(inArray(appointmentTypes.id, ids.types), isNotNull(appointmentTypes.deletedAt)));
  });
}

// —— Comptes rendus (EVT-10) ————————————————————————————————————————————————————

export function findReports(organizationId: string, appointmentIds: string[]): Promise<{ report: ReportRow; actions: ReportActionRow[] }[]> {
  if (appointmentIds.length === 0) return Promise.resolve([]);
  return inOrganization(organizationId, async (tx) => {
    const reports = await tx.select().from(appointmentReports).where(inArray(appointmentReports.appointmentId, appointmentIds));
    const actions =
      reports.length === 0
        ? []
        : await tx
            .select()
            .from(appointmentReportActions)
            .where(inArray(appointmentReportActions.reportId, reports.map((report) => report.id)))
            .orderBy(asc(appointmentReportActions.position), asc(appointmentReportActions.createdAt));
    return reports.map((report) => ({ report, actions: actions.filter((action) => action.reportId === report.id) }));
  });
}

export function upsertReport(organizationId: string, appointmentId: string, notes: string | null): Promise<ReportRow> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .insert(appointmentReports)
      .values({ organizationId, appointmentId, notes })
      .onConflictDoUpdate({ target: appointmentReports.appointmentId, set: { notes, updatedAt: new Date() } })
      .returning();
    if (!row) throw new Error("enregistrement du compte rendu échoué");
    return row;
  });
}

export function insertReportAction(organizationId: string, reportId: string, values: { label: string; dueOn: string | null; responsible: "planner" | "clients" }): Promise<ReportActionRow> {
  return inOrganization(organizationId, async (tx) => {
    const [{ next } = { next: 0 }] = await tx
      .select({ next: sql<number>`coalesce(max(${appointmentReportActions.position}) + 1, 0)::int` })
      .from(appointmentReportActions)
      .where(eq(appointmentReportActions.reportId, reportId));
    return (await tx.insert(appointmentReportActions).values({ organizationId, reportId, ...values, position: next }).returning())[0]!;
  });
}

export function findReportAction(organizationId: string, actionId: string) {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .select({ action: appointmentReportActions, appointmentId: appointmentReports.appointmentId })
      .from(appointmentReportActions)
      .innerJoin(appointmentReports, eq(appointmentReports.id, appointmentReportActions.reportId))
      .where(eq(appointmentReportActions.id, actionId));
    return row ?? null;
  });
}

export function setReportActionTask(organizationId: string, actionId: string, task: { taskId: string; taskEventId: string }): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => (await tx.update(appointmentReportActions).set({ ...task, updatedAt: new Date() }).where(and(eq(appointmentReportActions.id, actionId), isNull(appointmentReportActions.taskId))).returning({ id: appointmentReportActions.id })).length > 0);
}

export function deleteReportAction(organizationId: string, actionId: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => (await tx.delete(appointmentReportActions).where(eq(appointmentReportActions.id, actionId)).returning({ id: appointmentReportActions.id })).length > 0);
}

// —— Essais et RGPD ——————————————————————————————————————————————————————————————

export function deleteDemoAppointments(organizationId: string): Promise<number> {
  return inTrash(organizationId, async (tx) => (await tx.delete(appointments).where(eq(appointments.isDemo, true)).returning({ id: appointments.id })).length);
}
