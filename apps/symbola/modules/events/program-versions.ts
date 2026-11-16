// Lot 37b (CHR-07, DAT-14 ; D8, D9, D10, D11 ; ADR 0071) — versions diffusées du programme du jour J.
// « Diffuser » fige une copie numérotée des séquences, sans note interne ; clients et prestataires
// lisent la dernière version diffusée. Une version ne se modifie pas. Accès aux données du module
// events ; exposé seulement par service.ts (ADR 0011).
import { and, desc, eq, isNull, lt, or } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { eventLinks, events, programVersions, type ProgramVersionItemRow } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import type { ProgramVersion, ProgramVersionSummary, PublishedProgramItem } from "@symbola/contracts";
import { hasProgramChanges, programChanges, sortProgramItems } from "./program";

type VersionRow = typeof programVersions.$inferSelect;

// « empty » : rien à diffuser ; « unchanged » : la dernière version diffusée est déjà celle-ci.
export class ProgramPublishError extends Error {
  constructor(readonly reason: "empty" | "unchanged") {
    super(`diffusion du programme refusée : ${reason}`);
    this.name = "ProgramPublishError";
  }
}

function toSummary(row: VersionRow): ProgramVersionSummary {
  return { number: row.number, publishedAt: row.publishedAt.toISOString(), publishedByUserId: row.publishedByUserId };
}

function itemsOf(row: VersionRow): PublishedProgramItem[] {
  return sortProgramItems(
    (row.items as ProgramVersionItemRow[]).map((item) => ({
      id: item.id,
      startTime: item.startTime,
      endTime: item.endTime ?? null,
      label: item.label,
      location: item.location ?? null,
      responsible: item.responsible ?? null,
      participants: (item.participants ?? []).map((participant) => ({ vendorSlotId: participant.vendorSlotId ?? null, label: participant.label })),
    })),
  );
}

function toVersion(row: VersionRow): ProgramVersion {
  return { ...toSummary(row), items: itemsOf(row) };
}

export type ProgramVersionInsertResult = { status: "published"; version: ProgramVersionSummary } | { status: "event_not_found" | "unchanged" };

// Verrou sur l'évènement : deux diffusions simultanées reçoivent deux numéros, et un double clic ne
// diffuse pas deux fois la même version.
export async function insertProgramVersion(input: { organizationId: string; eventId: string; userId: string; items: PublishedProgramItem[]; now: Date }): Promise<ProgramVersionInsertResult> {
  return withOrganization(appDatabase(), input.organizationId, async (tx) => {
    const [event] = await tx.select({ id: events.id }).from(events).where(eq(events.id, input.eventId)).for("update");
    if (!event) return { status: "event_not_found" as const };
    const [latest] = await tx.select().from(programVersions).where(eq(programVersions.eventId, input.eventId)).orderBy(desc(programVersions.number)).limit(1);
    if (latest && !hasProgramChanges(programChanges(itemsOf(latest), input.items))) return { status: "unchanged" as const };
    const items: ProgramVersionItemRow[] = input.items.map((item) => ({ ...item, participants: item.participants.map((participant) => ({ ...participant })) }));
    const [row] = await tx
      .insert(programVersions)
      .values({ organizationId: input.organizationId, eventId: input.eventId, number: (latest?.number ?? 0) + 1, publishedAt: input.now, publishedByUserId: input.userId, items })
      .returning();
    return { status: "published" as const, version: toSummary(row!) };
  });
}

// La plus récente d'abord.
export async function findProgramVersions(organizationId: string, eventId: string): Promise<ProgramVersionSummary[]> {
  const rows = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(programVersions).where(eq(programVersions.eventId, eventId)).orderBy(desc(programVersions.number)));
  return rows.map(toSummary);
}

export async function findProgramVersion(organizationId: string, eventId: string, number: number): Promise<ProgramVersion | null> {
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(programVersions).where(and(eq(programVersions.eventId, eventId), eq(programVersions.number, number))));
  return row ? toVersion(row) : null;
}

export async function findLatestProgramVersion(organizationId: string, eventId: string): Promise<ProgramVersion | null> {
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(programVersions).where(eq(programVersions.eventId, eventId)).orderBy(desc(programVersions.number)).limit(1));
  return row ? toVersion(row) : null;
}

// D11 : la dernière version que la personne du lien a vue (null : aucune encore).
export async function findLinkProgramSeen(organizationId: string, linkId: string): Promise<number | null> {
  const [row] = await withOrganization(appDatabase(), organizationId, (tx) => tx.select({ seen: eventLinks.programVersionSeen }).from(eventLinks).where(eq(eventLinks.id, linkId)));
  return row?.seen ?? null;
}

// Ne recule jamais : une page ouverte en retard ne fait pas « revoir » une version déjà vue.
export async function markProgramSeen(organizationId: string, linkId: string, number: number): Promise<void> {
  await withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .update(eventLinks)
      .set({ programVersionSeen: number })
      .where(and(eq(eventLinks.id, linkId), or(isNull(eventLinks.programVersionSeen), lt(eventLinks.programVersionSeen, number)))),
  );
}
