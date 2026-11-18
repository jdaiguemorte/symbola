// Lot 51 (CHR-08 ; ADR 0091) — import d'un chrono depuis un tableur (CSV, XLSX). Le fichier est
// contrôlé comme tout envoi (taille, antivirus, SEC-21), lu en mémoire par le moteur d'import
// (cellules commençant par =, +, -, @ neutralisées) et jamais gardé : l'aperçu (écran de contrôle,
// écarts expliqués) se recalcule du même fichier au moment de l'écrire, si bien que rien n'est écrit
// avant. L'import crée les temps forts manquants, puis ajoute les séquences à la suite du programme.
import { and, eq, isNull } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { events, keyMoments, programItems } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { parseEnv } from "@symbola/env";
import { scanBuffer } from "@symbola/files";
import { readImportFile } from "@symbola/import-engine";
import { starterProgramImportColumns } from "@symbola/starter-templates";
import type { ProgramImportResult } from "@symbola/contracts";
import { getImportLimits } from "@/modules/hub/service";
import { DAY_UUID } from "./day-of";
import { ensureMainKeyMoment } from "./main-moment";
import { foldText, mapProgramColumns, readProgramRows } from "./program-import-rules";

export async function importProgram(input: {
  organizationId: string;
  eventId: string;
  bytes: Uint8Array;
  // null : l'aperçu seulement ; sinon les lignes écartées par la planner.
  apply: { skipLines: number[] } | null;
  mainMomentName: string;
}): Promise<ProgramImportResult | null> {
  if (!DAY_UUID.test(input.eventId)) return null;
  const db = appDatabase();
  const context = await withOrganization(db, input.organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id, eventDate: events.eventDate }).from(events).where(eq(events.id, input.eventId));
    if (!event) return null;
    const moments = await tx.select({ id: keyMoments.id, name: keyMoments.name, date: keyMoments.date }).from(keyMoments).where(and(eq(keyMoments.eventId, input.eventId), isNull(keyMoments.deletedAt)));
    return { eventDate: event.eventDate, moments };
  });
  if (!context) return null;
  const limits = await getImportLimits(db);
  if (input.bytes.length === 0) return { status: "rejected", reason: "empty" };
  if (input.bytes.length > limits.maxBytes) return { status: "rejected", reason: "too_large" };
  const env = parseEnv(process.env);
  const scan = await scanBuffer(Buffer.from(input.bytes), { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
  if (scan.infected) return { status: "rejected", reason: "infected" };
  const read = readImportFile(input.bytes, { maxBytes: limits.maxBytes, maxRows: limits.maxRows });
  if (!read.ok) return { status: "rejected", reason: read.reason };
  const mapped = mapProgramColumns(read.table.headers, starterProgramImportColumns());
  if (mapped.mapping.start === undefined) return { status: "rejected", reason: "no_start_column" };
  if (mapped.mapping.label === undefined) return { status: "rejected", reason: "no_label_column" };
  const { rows, problems, newMoments } = readProgramRows(read.table.rows, read.table.sourceLineNumbers, mapped.mapping, { eventDate: context.eventDate, moments: context.moments });
  const preview = {
    rows,
    problems,
    newMoments,
    unknownColumns: mapped.unknown.map((index) => read.table.headers[index] ?? ""),
    neutralizedCells: read.table.neutralizedCells,
  };
  if (!input.apply) return { status: "preview", preview };

  const skip = new Set(input.apply.skipLines);
  const kept = rows.filter((row) => !skip.has(row.line));
  const result = await withOrganization(db, input.organizationId, async (tx) => {
    const momentIds = new Map<string, string>();
    for (const moment of context.moments) momentIds.set(`${moment.date}|${foldText(moment.name)}`, moment.id);
    let createdMoments = 0;
    let count = 0;
    for (const row of kept) {
      let keyMomentId: string | null = null;
      if (row.moment && row.momentDate) {
        const key = `${row.momentDate}|${foldText(row.moment)}`;
        keyMomentId = momentIds.get(key) ?? null;
        if (!keyMomentId) {
          const [created] = await tx
            .insert(keyMoments)
            .values({ organizationId: input.organizationId, eventId: input.eventId, name: row.moment, date: row.momentDate, position: momentIds.size })
            .returning({ id: keyMoments.id });
          keyMomentId = created!.id;
          momentIds.set(key, keyMomentId);
          createdMoments += 1;
        }
      } else if (row.momentDate) {
        // Une date seule : le premier temps fort de ce jour (créé de lui-même s'il manque, au jour de
        // l'évènement ; sinon un temps fort nommé comme celui-ci).
        const sameDay = context.moments.find((moment) => moment.date === row.momentDate);
        if (sameDay) keyMomentId = sameDay.id;
        else if (row.momentDate === context.eventDate) keyMomentId = await ensureMainKeyMoment(tx, input.organizationId, input.eventId, input.mainMomentName);
        else {
          const key = `${row.momentDate}|${foldText(input.mainMomentName)}`;
          keyMomentId = momentIds.get(key) ?? null;
          if (!keyMomentId) {
            const [created] = await tx
              .insert(keyMoments)
              .values({ organizationId: input.organizationId, eventId: input.eventId, name: input.mainMomentName, date: row.momentDate, position: momentIds.size })
              .returning({ id: keyMoments.id });
            keyMomentId = created!.id;
            momentIds.set(key, keyMomentId);
            createdMoments += 1;
          }
        }
      }
      await tx.insert(programItems).values({
        organizationId: input.organizationId,
        eventId: input.eventId,
        keyMomentId,
        startTime: row.startTime,
        endTime: row.endTime,
        label: row.label,
        location: row.location,
        responsible: row.responsible?.slice(0, 120) ?? null,
        internalNote: row.note,
      });
      count += 1;
    }
    if (count > 0) await tx.update(events).set({ programUpdatedAt: new Date() }).where(eq(events.id, input.eventId));
    return { items: count, moments: createdMoments, skipped: rows.length - kept.length };
  });
  await recordAudit(db, { organizationId: input.organizationId, action: "events.program.imported", objectId: input.eventId, details: { items: result.items, moments: result.moments } });
  return { status: "applied", ...result };
}
