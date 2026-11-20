// Lot 60 — accès base du module floorplans (ADR 0011 : jamais importé hors du module). Chaque
// lecture et écriture passe par withOrganization (RLS, SEC-10) ; aucune requête ne lit une autre
// organisation.
import { asc, eq, inArray } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { elementTypes, layoutElements, layouts, powerLinks, spaceFixtures, spaces } from "@symbola/db/schema/floorplans";
import { withOrganization } from "@symbola/db/with-organization";
import type { FloorplanElement, FloorplanFixture, FloorplanLayoutSummary, FloorplanSpace } from "@symbola/contracts";
import { starterFloorplanElements } from "@symbola/starter-templates";
import { capacityOf } from "./geometry";

export type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type SpaceRow = typeof spaces.$inferSelect;
export type FixtureRow = typeof spaceFixtures.$inferSelect;
export type LayoutRow = typeof layouts.$inferSelect;
export type ElementRow = typeof layoutElements.$inferSelect;
export type ElementTypeRow = typeof elementTypes.$inferSelect;

export function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  return withOrganization(appDatabase(), organizationId, fn);
}

export function toSpace(row: SpaceRow): FloorplanSpace {
  return {
    id: row.id,
    vendorId: row.vendorId,
    eventId: row.eventId,
    eventPlaceId: row.eventPlaceId,
    sourceSpaceId: row.sourceSpaceId,
    name: row.name,
    widthCm: row.widthCm,
    depthCm: row.depthCm,
    background:
      row.backgroundKey && row.backgroundMime && row.backgroundWidthPx && row.backgroundHeightPx && row.backgroundSizeBytes
        ? { mime: row.backgroundMime, widthPx: row.backgroundWidthPx, heightPx: row.backgroundHeightPx, sizeBytes: row.backgroundSizeBytes }
        : null,
    calibration:
      row.calibrationDistanceCm !== null && row.calibrationAx !== null && row.calibrationAy !== null && row.calibrationBx !== null && row.calibrationBy !== null
        ? { ax: row.calibrationAx, ay: row.calibrationAy, bx: row.calibrationBx, by: row.calibrationBy, distanceCm: row.calibrationDistanceCm }
        : null,
  };
}

export function toFixture(row: FixtureRow): FloorplanFixture {
  return {
    id: row.id,
    kind: row.kind,
    label: row.label,
    xCm: row.xCm,
    yCm: row.yCm,
    widthCm: row.widthCm,
    depthCm: row.depthCm,
    rotationDeg: row.rotationDeg,
    outletCount: row.outletCount,
    amps: row.amps,
    threePhase: row.threePhase,
    note: row.note,
  };
}

export function toElement(row: ElementRow, fixtureId: string | null): FloorplanElement {
  return {
    id: row.id,
    elementTypeId: row.elementTypeId,
    typeStarterKey: row.typeStarterKey,
    typeLabel: row.typeLabel,
    category: row.category,
    shape: row.shape,
    name: row.name,
    xCm: row.xCm,
    yCm: row.yCm,
    widthCm: row.widthCm,
    depthCm: row.depthCm,
    rotationDeg: row.rotationDeg,
    seats: row.seats,
    color: row.color,
    note: row.note,
    vendorCandidateId: row.vendorCandidateId,
    powerOutlets: row.powerOutlets,
    powerAmps: row.powerAmps,
    needsWater: row.needsWater,
    maxCableM: row.maxCableM,
    fixtureId,
  };
}

export async function findSpace(tx: Tx, spaceId: string): Promise<SpaceRow | null> {
  if (!UUID.test(spaceId)) return null;
  const [row] = await tx.select().from(spaces).where(eq(spaces.id, spaceId));
  return row ?? null;
}

export async function findLayout(tx: Tx, layoutId: string): Promise<LayoutRow | null> {
  if (!UUID.test(layoutId)) return null;
  const [row] = await tx.select().from(layouts).where(eq(layouts.id, layoutId));
  return row ?? null;
}

export async function fixturesOf(tx: Tx, spaceId: string): Promise<FloorplanFixture[]> {
  return (await tx.select().from(spaceFixtures).where(eq(spaceFixtures.spaceId, spaceId)).orderBy(asc(spaceFixtures.position), asc(spaceFixtures.createdAt))).map(toFixture);
}

export async function elementsOf(tx: Tx, layoutIds: string[]): Promise<(FloorplanElement & { layoutId: string })[]> {
  if (layoutIds.length === 0) return [];
  const rows = await tx.select().from(layoutElements).where(inArray(layoutElements.layoutId, layoutIds)).orderBy(asc(layoutElements.position), asc(layoutElements.createdAt));
  const links = rows.length > 0 ? await tx.select().from(powerLinks).where(inArray(powerLinks.elementId, rows.map((row) => row.id))) : [];
  const fixtureOf = new Map(links.map((link) => [link.elementId, link.fixtureId]));
  return rows.map((row) => ({ ...toElement(row, fixtureOf.get(row.id) ?? null), layoutId: row.layoutId }));
}

export async function layoutSummaries(tx: Tx, spaceIds: string[]): Promise<FloorplanLayoutSummary[]> {
  if (spaceIds.length === 0) return [];
  const rows = await tx.select().from(layouts).where(inArray(layouts.spaceId, spaceIds)).orderBy(asc(layouts.createdAt));
  const elements = await elementsOf(tx, rows.map((row) => row.id));
  return rows.map((row) => {
    const own = elements.filter((element) => element.layoutId === row.id);
    return {
      id: row.id,
      spaceId: row.spaceId,
      eventId: row.eventId,
      name: row.name,
      capacity: capacityOf(own),
      elementCount: own.length,
      publishedVersion: row.publishedVersion,
      updatedAt: row.updatedAt.toISOString(),
    };
  });
}

// Bibliothèque de l'organisation : copiée des données de départ à la première lecture (HUB-20).
export async function ensureElementTypes(tx: Tx, organizationId: string): Promise<ElementTypeRow[]> {
  const rows = await tx.select().from(elementTypes).orderBy(asc(elementTypes.position), asc(elementTypes.createdAt));
  const known = new Set(rows.map((row) => row.starterKey).filter((key): key is string => key !== null));
  const missing = starterFloorplanElements("fr").filter((element) => !known.has(element.key));
  if (missing.length === 0) return rows;
  const start = rows.reduce((max, row) => Math.max(max, row.position + 1), 0);
  await tx
    .insert(elementTypes)
    .values(
      missing.map((element, index) => ({
        organizationId,
        starterKey: element.key,
        label: null,
        category: element.category,
        shape: element.shape,
        seatRule: element.seatRule,
        widthCm: element.widthCm,
        depthCm: element.depthCm,
        powerOutlets: element.powerOutlets,
        powerAmps: element.powerAmps,
        needsWater: element.needsWater,
        position: start + index,
      })),
    )
    .onConflictDoNothing();
  return tx.select().from(elementTypes).orderBy(asc(elementTypes.position), asc(elementTypes.createdAt));
}
