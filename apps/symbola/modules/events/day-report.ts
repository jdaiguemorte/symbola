// Lot 51 (PAR-08, étape 7 ; ADR 0091) — le bilan du lendemain : séquences prévues et réelles
// (écarts), décalages validés et prestataires prévenus, incidents avec leurs photos, cases non
// cochées, remises faites et non faites. Prêt le lendemain du dernier jour de l'évènement, à minuit
// dans son fuseau ; interne à l'organisation (jamais montré au client ni aux prestataires). La
// dernière synthèse préparée se garde (day_reports) ; elle se refait tant que des actions arrivent.
import { eq } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { dayReports } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { DayReport, DayReportHandover, DayReportSequence, ProgramItem } from "@symbola/contracts";
import { eventDays, isReportReady, itemActuals, originalTimes, reportReadyOn } from "@/lib/day-of/rules";
import type { DayRecords } from "./day-of";

export function buildDayReport(input: {
  eventId: string;
  eventDate: string | null;
  timeZone: string;
  moments: { id: string; date: string }[];
  items: ProgramItem[];
  records: DayRecords;
  handovers: DayReportHandover[];
  now: Date;
}): DayReport {
  const days = eventDays(input.moments, input.eventDate);
  const lastDay = days[days.length - 1] ?? input.eventDate ?? "";
  const ready = lastDay !== "" && isReportReady(lastDay, input.timeZone, input.now);
  const actuals = new Map(itemActuals(input.records.checkpoints).map((actual) => [actual.itemId, actual]));
  const momentDate = new Map(input.moments.map((moment) => [moment.id, moment.date]));
  const toMinutes = (time: string) => Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
  const sequences: DayReportSequence[] = input.items.map((item) => {
    const planned = originalTimes(item, input.records.shifts);
    const actual = actuals.get(item.id);
    const date = (item.keyMomentId ? momentDate.get(item.keyMomentId) : null) ?? input.eventDate;
    let startGap: number | null = null;
    if (actual?.startedAt && date) {
      const local = new Intl.DateTimeFormat("en-CA", { timeZone: input.timeZone, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(actual.startedAt));
      const part = (type: string) => local.find((entry) => entry.type === type)?.value ?? "0";
      const dayOffset = Math.round((Date.parse(`${part("year")}-${part("month")}-${part("day")}T00:00:00Z`) - Date.parse(`${date}T00:00:00Z`)) / 86_400_000);
      startGap = dayOffset * 1440 + Number(part("hour")) * 60 + Number(part("minute")) - toMinutes(planned.startTime);
    }
    return {
      itemId: item.id,
      keyMomentId: item.keyMomentId,
      label: item.label,
      plannedStart: planned.startTime,
      plannedEnd: planned.endTime,
      actualStart: actual?.startedAt ?? null,
      actualEnd: actual?.finishedAt ?? null,
      startGap,
    };
  });
  return {
    eventId: input.eventId,
    ready,
    readyOn: lastDay ? reportReadyOn(lastDay) : "",
    preparedAt: null,
    sequences,
    shifts: input.records.shifts,
    incidents: input.records.incidents,
    uncheckedItems: input.records.checklists.flatMap((list) => list.items.filter((item) => item.checkedAt === null).map((item) => ({ checklistName: list.name, label: item.label }))),
    checklistCount: input.records.checklists.length,
    handovers: input.handovers,
  };
}

// Garde la synthèse préparée (un bilan par évènement) ; renvoie l'heure de la préparation.
export async function saveDayReport(organizationId: string, eventId: string, report: DayReport, now: Date): Promise<string> {
  const summary = { ...report, preparedAt: now.toISOString() } as unknown as Record<string, unknown>;
  await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .insert(dayReports)
      .values({ organizationId, eventId, preparedAt: now, summary })
      .onConflictDoUpdate({ target: dayReports.eventId, set: { preparedAt: now, summary, updatedAt: now } }),
  );
  return now.toISOString();
}

export async function findDayReportPreparedAt(organizationId: string, eventId: string): Promise<string | null> {
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ preparedAt: dayReports.preparedAt }).from(dayReports).where(eq(dayReports.eventId, eventId)));
  return row?.preparedAt.toISOString() ?? null;
}
