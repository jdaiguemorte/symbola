// Lot 49 (INV-02 ; D5, D12) — import d'une liste d'invités depuis un tableur (CSV, XLSX), par la
// planner ou par le client à son portail. Le fichier est contrôlé comme tout envoi (taille, type par
// le contenu, antivirus, SEC-21), lu en mémoire par le moteur d'import (formules neutralisées) et
// jamais gardé : l'aperçu se recalcule du même fichier au moment du choix, si bien que rien n'est
// écrit avant (doublons signalés d'abord). Une colonne de régime est ignorée et signalée. Annulable.
import { and, eq, isNull } from "drizzle-orm";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { guestImports, households } from "@symbola/db/schema/guests";
import { parseEnv } from "@symbola/env";
import { scanBuffer } from "@symbola/files";
import { readImportFile } from "@symbola/import-engine";
import { starterGuestImportColumns } from "@symbola/starter-templates";
import type { GuestEventContext, GuestImportPreview, GuestImportResult, GuestImportRow, GuestSide, HouseholdInput } from "@symbola/contracts";
import { getImportLimits } from "@/modules/hub/service";
import { assertGuestsReady, eventContext, HouseholdInvalidError, listEventPeople, saveHousehold } from "./households";
import { findDuplicates, foldHeader, mapGuestColumns, readGuestRows } from "./import-rules";
import { inOrganization, UUID } from "./repository";

export class GuestImportNotFoundError extends Error {
  constructor() {
    super("import introuvable");
    this.name = "GuestImportNotFoundError";
  }
}

type Grouped = { key: string; rows: GuestImportRow[] };

function groupRows(rows: GuestImportRow[]): Grouped[] {
  const groups = new Map<string, GuestImportRow[]>();
  for (const row of rows) {
    const key = foldHeader(row.household) || `ligne-${row.line}`;
    groups.set(key, [...(groups.get(key) ?? []), row]);
  }
  return [...groups.entries()].map(([key, grouped]) => ({ key, rows: grouped }));
}

function sideFor(value: string | null, context: GuestEventContext, both: Set<string>): GuestSide | undefined {
  if (!value) return undefined;
  const folded = foldHeader(value);
  if (both.has(folded)) return { kind: "both" };
  const client = context.clients.find((candidate) => foldHeader(candidate.firstName) === folded || foldHeader(`${candidate.firstName} ${candidate.lastName ?? ""}`) === folded);
  return client ? { kind: "client", clientId: client.id } : undefined;
}

// Aperçu, puis application des seules lignes gardées (skipLines : doublons écartés).
export async function importGuests(input: {
  organizationId: string;
  eventId: string;
  bytes: Uint8Array;
  channel: "planner" | "client";
  apply?: { skipLines: number[] } | null;
}): Promise<GuestImportResult> {
  await assertGuestsReady(input.organizationId);
  const context = await eventContext(input.organizationId, input.eventId);
  const limits = await getImportLimits(appDatabase());
  if (input.bytes.length === 0) return { status: "rejected", reason: "empty" };
  if (input.bytes.length > limits.maxBytes) return { status: "rejected", reason: "too_large" };
  const env = parseEnv(process.env);
  const scan = await scanBuffer(Buffer.from(input.bytes), { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
  if (scan.infected) return { status: "rejected", reason: "infected" };
  const read = readImportFile(input.bytes, { maxBytes: limits.maxBytes, maxRows: limits.maxRows });
  if (!read.ok) return { status: "rejected", reason: read.reason };
  const columns = starterGuestImportColumns();
  const mapped = mapGuestColumns(read.table.headers, columns);
  if (mapped.mapping.firstName === undefined) return { status: "rejected", reason: "no_name_column" };
  const { rows, problems } = readGuestRows(read.table.rows, read.table.sourceLineNumbers, mapped.mapping, columns);
  const existing = await inOrganization(input.organizationId, (tx) => listEventPeople(tx, input.eventId));
  const groups = groupRows(rows);
  for (const group of groups) {
    if (!group.rows.some((row) => row.kind === "adult" && (row.email || row.phone))) for (const row of group.rows) problems.push({ line: row.line, problem: "household_without_contact" });
  }
  const preview: GuestImportPreview = {
    rows,
    households: groups.length,
    duplicates: findDuplicates(rows, existing),
    problems: problems.sort((a, b) => a.line - b.line),
    ignoredDietColumns: mapped.ignoredDiet.map((index) => read.table.headers[index] ?? ""),
    neutralizedCells: read.table.neutralizedCells,
    unknownColumns: mapped.unknown.map((index) => read.table.headers[index] ?? ""),
  };
  if (!input.apply) return { status: "preview", preview };

  const skip = new Set(input.apply.skipLines);
  const both = new Set(columns.values.both.map(foldHeader));
  const result = await inOrganization(input.organizationId, async (tx) => {
    const [created] = await tx.insert(guestImports).values({ organizationId: input.organizationId, eventId: input.eventId, channel: input.channel, householdCount: 0, guestCount: 0 }).returning({ id: guestImports.id });
    const importId = created!.id;
    let householdCount = 0;
    let guestCount = 0;
    let skipped = 0;
    for (const group of groups) {
      const kept = group.rows.filter((row) => !skip.has(row.line));
      skipped += group.rows.length - kept.length;
      if (kept.length === 0) continue;
      const first = kept[0]!;
      const household: HouseholdInput = {
        displayName: first.household,
        side: sideFor(first.side, context, both),
        groupLabel: first.group,
        language: first.language,
        people: kept.map((row) => ({ kind: row.kind, firstName: row.firstName, lastName: row.lastName, email: row.email, phone: row.phone, ageRange: row.ageRange })),
      };
      try {
        await tx.transaction(async (savepoint) => {
          await saveHousehold(input.organizationId, input.eventId, null, household, { importId, tx: savepoint, context });
        });
        householdCount += 1;
        guestCount += kept.length;
      } catch (error) {
        if (!(error instanceof HouseholdInvalidError)) throw error;
        skipped += kept.length;
      }
    }
    await tx.update(guestImports).set({ householdCount, guestCount }).where(eq(guestImports.id, importId));
    return { importId, households: householdCount, people: guestCount, skipped };
  });
  await recordAudit(appDatabase(), { organizationId: input.organizationId, action: "guests.import.applied", objectId: input.eventId, details: { households: result.households, people: result.people } });
  return { status: "applied", ...result };
}

// Annulation : les foyers créés par l'import (et leurs personnes, réponses, liens) disparaissent.
export async function undoGuestImport(organizationId: string, eventId: string, importId: string, now: Date = new Date()): Promise<number> {
  if (!UUID.test(importId) || !UUID.test(eventId)) throw new GuestImportNotFoundError();
  const removed = await inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(guestImports).where(and(eq(guestImports.id, importId), eq(guestImports.eventId, eventId), isNull(guestImports.undoneAt)));
    if (!row) throw new GuestImportNotFoundError();
    const deleted = await tx.delete(households).where(eq(households.importId, importId)).returning({ id: households.id });
    await tx.update(guestImports).set({ undoneAt: now, updatedAt: now }).where(eq(guestImports.id, importId));
    return deleted.length;
  });
  await recordAudit(appDatabase(), { organizationId, action: "guests.import.undone", objectId: eventId, details: { households: removed } });
  return removed;
}

export async function listGuestImports(organizationId: string, eventId: string): Promise<{ id: string; channel: string; households: number; people: number; createdAt: string; undoneAt: string | null }[]> {
  if (!UUID.test(eventId)) return [];
  const rows = await inOrganization(organizationId, (tx) => tx.select().from(guestImports).where(eq(guestImports.eventId, eventId)));
  return rows
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .map((row) => ({ id: row.id, channel: row.channel, households: row.householdCount, people: row.guestCount, createdAt: row.createdAt.toISOString(), undoneAt: row.undoneAt?.toISOString() ?? null }));
}
