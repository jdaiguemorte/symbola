// Lot 51 (CHR-08 ; ADR 0091) — import d'un chrono depuis un tableur (CSV, XLSX). Le fichier est
// contrôlé comme tout envoi (taille, antivirus, SEC-21), lu en mémoire par le moteur d'import
// (cellules commençant par =, +, -, @ neutralisées) et jamais gardé : l'aperçu (écran de contrôle,
// écarts expliqués) se recalcule du même fichier au moment de l'écrire, si bien que rien n'est écrit
// avant. L'import crée les temps forts manquants, puis ajoute les séquences à la suite du programme.
import { and, eq, inArray, isNull, ne } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { events, eventVendorCandidates, eventVendorSlots, keyMoments, programItemParticipants, programItems } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { parseEnv } from "@symbola/env";
import { scanBuffer } from "@symbola/files";
import { looksLikePdf, readImportFile } from "@symbola/import-engine";
import { starterProgramImportColumns } from "@symbola/starter-templates";
import type { ProgramImportPreview, ProgramImportResult, ProgramImportRow } from "@symbola/contracts";
import { getImportLimits } from "@/modules/hub/service";
import { DAY_UUID } from "./day-of";
import { ensureMainKeyMoment } from "./main-moment";
import { dayMomentName, foldText, mapProgramColumns, readProgramRows, type ProgramSlotOption } from "./program-import-rules";

export async function importProgram(input: {
  organizationId: string;
  eventId: string;
  bytes: Uint8Array;
  // null : l'aperçu seulement ; sinon les lignes écartées par la planner.
  apply: { skipLines: number[] } | null;
  mainMomentName: string;
  // Lot 67d (EVT-04) : noms de la veille et du lendemain ; absents, le nom du jour J (comme avant).
  eveMomentName?: string;
  nextDayMomentName?: string;
}): Promise<ProgramImportResult | null> {
  if (!DAY_UUID.test(input.eventId)) return null;
  const db = appDatabase();
  const context = await withOrganization(db, input.organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id, eventDate: events.eventDate }).from(events).where(eq(events.id, input.eventId));
    if (!event) return null;
    const moments = await tx.select({ id: keyMoments.id, name: keyMoments.name, date: keyMoments.date }).from(keyMoments).where(and(eq(keyMoments.eventId, input.eventId), isNull(keyMoments.deletedAt)));
    const slotRows = await tx.select({ id: eventVendorSlots.id, label: eventVendorSlots.label }).from(eventVendorSlots).where(eq(eventVendorSlots.eventId, input.eventId)).orderBy(eventVendorSlots.position);
    const vendorRows =
      slotRows.length > 0
        ? await tx
            .select({ slotId: eventVendorCandidates.vendorSlotId, name: eventVendorCandidates.vendorName })
            .from(eventVendorCandidates)
            .where(and(inArray(eventVendorCandidates.vendorSlotId, slotRows.map((slot) => slot.id)), ne(eventVendorCandidates.status, "dismissed")))
        : [];
    const slots: ProgramSlotOption[] = slotRows.map((slot) => ({ ...slot, vendorNames: vendorRows.filter((vendor) => vendor.slotId === slot.id).map((vendor) => vendor.name) }));
    return { eventDate: event.eventDate, moments, slots };
  });
  if (!context) return null;
  const dayNames = { main: input.mainMomentName, eve: input.eveMomentName ?? input.mainMomentName, nextDay: input.nextDayMomentName ?? input.mainMomentName };
  const limits = await getImportLimits(db);
  if (input.bytes.length === 0) return { status: "rejected", reason: "empty" };
  if (input.bytes.length > limits.maxBytes) return { status: "rejected", reason: "too_large" };
  const env = parseEnv(process.env);
  const scan = await scanBuffer(Buffer.from(input.bytes), { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
  if (scan.infected) return { status: "rejected", reason: "infected" };
  let preview: ProgramImportPreview;
  // Lot 71e (HUB-14) : un PDF de programme passe par l'assistant commun des imports (journal, bilan,
  // retrait) ; ici, seuls les tableurs.
  if (looksLikePdf(input.bytes)) return { status: "rejected", reason: "pdf_wizard" };
  {
    const read = readImportFile(input.bytes, { maxBytes: limits.maxBytes, maxRows: limits.maxRows });
    if (!read.ok) return { status: "rejected", reason: read.reason };
    const mapped = mapProgramColumns(read.table.headers, starterProgramImportColumns());
    if (mapped.mapping.start === undefined) return { status: "rejected", reason: "no_start_column" };
    if (mapped.mapping.label === undefined) return { status: "rejected", reason: "no_label_column" };
    const { rows, problems, newMoments } = readProgramRows(read.table.rows, read.table.sourceLineNumbers, mapped.mapping, { eventDate: context.eventDate, moments: context.moments });
    preview = {
      rows,
      problems,
      newMoments,
      unknownColumns: mapped.unknown.map((index) => read.table.headers[index] ?? ""),
      neutralizedCells: read.table.neutralizedCells,
      source: "spreadsheet",
    };
  }
  if (!input.apply) return { status: "preview", preview };
  const rows: ProgramImportRow[] = preview.rows;

  const skip = new Set(input.apply.skipLines);
  const kept = rows.filter((row) => !skip.has(row.line));
  const validSlots = new Set(context.slots.map((slot) => slot.id));
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
          const dayName = dayMomentName(row.momentDate, context.eventDate, dayNames);
          const key = `${row.momentDate}|${foldText(dayName)}`;
          keyMomentId = momentIds.get(key) ?? null;
          if (!keyMomentId) {
            const [created] = await tx
              .insert(keyMoments)
              .values({ organizationId: input.organizationId, eventId: input.eventId, name: dayName, date: row.momentDate, position: momentIds.size })
              .returning({ id: keyMoments.id });
            keyMomentId = created!.id;
            momentIds.set(key, keyMomentId);
            createdMoments += 1;
          }
        }
      }
      const [item] = await tx
        .insert(programItems)
        .values({
          organizationId: input.organizationId,
          eventId: input.eventId,
          keyMomentId,
          startTime: row.startTime,
          endTime: row.endTime,
          label: row.label,
          location: row.location,
          responsible: row.responsible?.slice(0, 120) ?? null,
          internalNote: row.note,
          // Lot 63b (Q44) : « Caché des mariés » dans le PDF, cachée d'eux ici.
          hiddenFromClients: row.hiddenFromClients === true,
        })
        .returning({ id: programItems.id });
      // Lot 63b : interlocuteurs du PDF, sur un poste de l'évènement (vérifié) ou en texte.
      const participants = (row.participants ?? []).filter((participant) => participant.vendorSlotId === null || validSlots.has(participant.vendorSlotId));
      if (participants.length > 0) {
        await tx.insert(programItemParticipants).values(
          participants.map((participant, position) => ({
            organizationId: input.organizationId,
            programItemId: item!.id,
            vendorSlotId: participant.vendorSlotId,
            freeLabel: participant.vendorSlotId ? null : participant.label,
            position,
          })),
        );
      }
      count += 1;
    }
    if (count > 0) await tx.update(events).set({ programUpdatedAt: new Date() }).where(eq(events.id, input.eventId));
    return { items: count, moments: createdMoments, skipped: rows.length - kept.length };
  });
  await recordAudit(db, { organizationId: input.organizationId, action: "events.program.imported", objectId: input.eventId, details: { items: result.items, moments: result.moments } });
  return { status: "applied", ...result };
}
