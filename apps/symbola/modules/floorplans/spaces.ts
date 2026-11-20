// Lot 60 (L60-PLA-01, L60-PLA-03 ; partie A, D4) — espaces d'un lieu du catalogue et d'un évènement :
// nom, dimensions, fond de plan (image PNG, JPEG ou WebP déposée par le contrôle commun : type par le
// contenu, taille, antivirus, stockage privé, ADR 0027), calibration par deux points, installations
// fixes. Les configurations appartiennent à l'organisation (RLS) : jamais partagées avec une autre
// organisation, ni avec le lieu.
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { layoutVersions, layouts, spaceFixtures, spaces } from "@symbola/db/schema/floorplans";
import type { FileDownload, FloorplanCalibration, FloorplanFixtureInput, FloorplanSpaceInput, FloorplanVenueSpaces } from "@symbola/contracts";
import { createStorageClient, deletePrivateObject, PrivateObjectNotFoundError, readPrivateObject, uploadFile } from "@symbola/files";
import { getVendor } from "@/modules/vendors/service";
import { FloorplanInvalidError, FloorplanNotFoundError } from "./errors";
import { readImageSize } from "./image-size";
import { calibrationSchema, fixtureInputSchema, spaceInputSchema } from "./inputs";
import { findSpace, fixturesOf, inOrganization, layoutSummaries, toSpace, UUID, type SpaceRow, type Tx } from "./repository";

// Taille maximale d'un fond de plan (une capture du plan du lieu), contrôlée avant l'antivirus.
export const FLOORPLAN_BACKGROUND_MAX_BYTES = 15 * 1024 * 1024;

function parseSpace(input: FloorplanSpaceInput) {
  const parsed = spaceInputSchema.safeParse(input);
  if (!parsed.success) throw new FloorplanInvalidError(parsed.error.issues.some((issue) => issue.path[0] === "name") ? "name" : "size");
  return parsed.data;
}

export async function assertVenue(organizationId: string, vendorId: string): Promise<void> {
  if (!UUID.test(vendorId) || !(await getVendor(organizationId, vendorId))) throw new FloorplanNotFoundError();
}

export async function spaceOf(tx: Tx, spaceId: string): Promise<SpaceRow> {
  const space = await findSpace(tx, spaceId);
  if (!space) throw new FloorplanNotFoundError();
  return space;
}

// Espaces d'un lieu du catalogue, avec leurs installations et leurs configurations.
export async function listVenueSpaces(organizationId: string, vendorId: string): Promise<FloorplanVenueSpaces> {
  await assertVenue(organizationId, vendorId);
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(spaces).where(and(eq(spaces.vendorId, vendorId), isNull(spaces.eventId))).orderBy(spaces.createdAt);
    const summaries = await layoutSummaries(tx, rows.map((row) => row.id));
    return Promise.all(rows.map(async (row) => ({ space: toSpace(row), fixtures: await fixturesOf(tx, row.id), layouts: summaries.filter((layout) => layout.spaceId === row.id) })));
  });
}

// Lieux du catalogue qui ont au moins une configuration (pour la copie vers un évènement).
export async function venuesWithLayouts(organizationId: string, vendorIds: string[]): Promise<FloorplanVenueSpaces> {
  const ids = vendorIds.filter((id) => UUID.test(id));
  if (ids.length === 0) return [];
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(spaces).where(and(inArray(spaces.vendorId, ids), isNull(spaces.eventId))).orderBy(spaces.createdAt);
    const summaries = await layoutSummaries(tx, rows.map((row) => row.id));
    return rows.map((row) => ({ space: toSpace(row), fixtures: [], layouts: summaries.filter((layout) => layout.spaceId === row.id) })).filter((entry) => entry.layouts.length > 0);
  });
}

export async function createVenueSpace(organizationId: string, vendorId: string, input: FloorplanSpaceInput): Promise<string> {
  const value = parseSpace(input);
  await assertVenue(organizationId, vendorId);
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.insert(spaces).values({ organizationId, vendorId, ...value }).returning({ id: spaces.id });
    return row!.id;
  });
}

export async function updateSpace(organizationId: string, spaceId: string, input: FloorplanSpaceInput): Promise<void> {
  const value = parseSpace(input);
  await inOrganization(organizationId, async (tx) => {
    await spaceOf(tx, spaceId);
    await tx.update(spaces).set({ ...value, updatedAt: new Date() }).where(eq(spaces.id, spaceId));
  });
}

// Un fond de plan stocké n'est supprimé que si plus aucun espace ni aucune version diffusée ne le
// désigne (la copie d'un espace dans un évènement le partage).
export async function releaseBackground(organizationId: string, key: string | null): Promise<void> {
  if (!key) return;
  const used = await inOrganization(organizationId, async (tx) => {
    const [space] = await tx.select({ id: spaces.id }).from(spaces).where(eq(spaces.backgroundKey, key)).limit(1);
    if (space) return true;
    const [version] = await tx.select({ id: layoutVersions.id }).from(layoutVersions).where(eq(layoutVersions.backgroundKey, key)).limit(1);
    return Boolean(version);
  });
  if (!used) await deletePrivateObject(createStorageClient(), key).catch(() => undefined);
}

export async function removeSpace(organizationId: string, spaceId: string): Promise<void> {
  const key = await inOrganization(organizationId, async (tx) => {
    const space = await spaceOf(tx, spaceId);
    await tx.delete(spaces).where(eq(spaces.id, space.id));
    return space.backgroundKey;
  });
  await releaseBackground(organizationId, key);
}

// D4 : fond de plan en image seulement. Type reconnu par le contenu, taille, antivirus, stockage privé
// (contrôle commun de @symbola/files) ; la calibration précédente ne vaut plus.
export async function setSpaceBackground(organizationId: string, spaceId: string, content: Uint8Array): Promise<void> {
  const size = readImageSize(content);
  if (!size) throw new FloorplanInvalidError("background_type");
  if (content.byteLength > FLOORPLAN_BACKGROUND_MAX_BYTES) throw new FloorplanInvalidError("background_size");
  await inOrganization(organizationId, (tx) => spaceOf(tx, spaceId));
  const upload = await uploadFile({ organizationId, buffer: Buffer.from(content), maxSizeBytes: FLOORPLAN_BACKGROUND_MAX_BYTES });
  if (upload.status === "rejected") throw new FloorplanInvalidError(upload.reason === "too_large" ? "background_size" : upload.reason === "infected" ? "background_infected" : upload.reason === "storage_full" ? "background_storage_full" : "background_type");
  if (upload.mime !== size.mime) {
    await deletePrivateObject(createStorageClient(), upload.key).catch(() => undefined);
    throw new FloorplanInvalidError("background_type");
  }
  const previous = await inOrganization(organizationId, async (tx) => {
    const space = await spaceOf(tx, spaceId);
    await tx
      .update(spaces)
      .set({
        backgroundKey: upload.key,
        backgroundMime: size.mime,
        backgroundSizeBytes: upload.size,
        backgroundWidthPx: size.widthPx,
        backgroundHeightPx: size.heightPx,
        calibrationAx: null,
        calibrationAy: null,
        calibrationBx: null,
        calibrationBy: null,
        calibrationDistanceCm: null,
        updatedAt: new Date(),
      })
      .where(eq(spaces.id, space.id));
    return space.backgroundKey;
  });
  await releaseBackground(organizationId, previous);
}

export async function removeSpaceBackground(organizationId: string, spaceId: string): Promise<void> {
  const previous = await inOrganization(organizationId, async (tx) => {
    const space = await spaceOf(tx, spaceId);
    await tx
      .update(spaces)
      .set({ backgroundKey: null, backgroundMime: null, backgroundSizeBytes: null, backgroundWidthPx: null, backgroundHeightPx: null, calibrationAx: null, calibrationAy: null, calibrationBx: null, calibrationBy: null, calibrationDistanceCm: null, updatedAt: new Date() })
      .where(eq(spaces.id, space.id));
    return space.backgroundKey;
  });
  await releaseBackground(organizationId, previous);
}

// Calibration : deux points de l'image (en pixels) et la distance réelle qui les sépare. Avec
// fitSpace, les dimensions de l'espace deviennent celles de l'image à l'échelle.
export async function calibrateSpace(organizationId: string, spaceId: string, calibration: FloorplanCalibration, fitSpace: boolean): Promise<void> {
  const parsed = calibrationSchema.safeParse(calibration);
  if (!parsed.success) throw new FloorplanInvalidError("calibration");
  const value = parsed.data;
  await inOrganization(organizationId, async (tx) => {
    const space = await spaceOf(tx, spaceId);
    if (!space.backgroundWidthPx || !space.backgroundHeightPx) throw new FloorplanInvalidError("calibration");
    if (Math.max(value.ax, value.bx) > space.backgroundWidthPx || Math.max(value.ay, value.by) > space.backgroundHeightPx) throw new FloorplanInvalidError("calibration");
    const cmPerPx = value.distanceCm / Math.hypot(value.bx - value.ax, value.by - value.ay);
    const fitted = { widthCm: Math.round(space.backgroundWidthPx * cmPerPx), depthCm: Math.round(space.backgroundHeightPx * cmPerPx) };
    const fits = fitted.widthCm >= 100 && fitted.widthCm <= 100000 && fitted.depthCm >= 100 && fitted.depthCm <= 100000;
    if (fitSpace && !fits) throw new FloorplanInvalidError("calibration");
    await tx
      .update(spaces)
      .set({ calibrationAx: value.ax, calibrationAy: value.ay, calibrationBx: value.bx, calibrationBy: value.by, calibrationDistanceCm: value.distanceCm, ...(fitSpace ? fitted : {}), updatedAt: new Date() })
      .where(eq(spaces.id, space.id));
  });
}

// Fond de plan d'un espace, pour l'équipe (l'appelant a vérifié session, organisation et module).
export async function getSpaceBackground(organizationId: string, spaceId: string): Promise<FileDownload> {
  const space = await inOrganization(organizationId, (tx) => findSpace(tx, spaceId));
  if (!space?.backgroundKey || !space.backgroundMime) throw new FloorplanNotFoundError();
  return readBackground(space.backgroundKey, space.backgroundMime);
}

export async function readBackground(key: string, mime: string): Promise<FileDownload> {
  try {
    const { data } = await readPrivateObject(createStorageClient(), key);
    return { data, contentType: mime, fileName: `plan.${mime.split("/")[1] ?? "img"}` };
  } catch (error) {
    if (error instanceof PrivateObjectNotFoundError) throw new FloorplanNotFoundError();
    throw error;
  }
}

// Installations fixes d'un espace, enregistrées d'un bloc : une installation absente de la liste est
// retirée (ses liaisons aux éléments avec elle) ; une nouvelle reçoit un identifiant.
export async function saveFixtures(organizationId: string, spaceId: string, input: FloorplanFixtureInput[]): Promise<void> {
  const parsed = fixtureInputSchema.array().max(500).safeParse(input);
  if (!parsed.success) throw new FloorplanInvalidError("fixtures");
  const fixtures = parsed.data;
  for (const fixture of fixtures) {
    const outlet = fixture.kind === "outlet";
    if (outlet !== (fixture.outletCount !== null && fixture.amps !== null) || (!outlet && fixture.threePhase)) throw new FloorplanInvalidError("fixtures");
  }
  await inOrganization(organizationId, async (tx) => {
    const space = await spaceOf(tx, spaceId);
    const existing = await tx.select({ id: spaceFixtures.id }).from(spaceFixtures).where(eq(spaceFixtures.spaceId, space.id));
    const known = new Set(existing.map((row) => row.id));
    const kept = new Set(fixtures.map((fixture) => fixture.id).filter((id): id is string => typeof id === "string" && known.has(id)));
    const removed = [...known].filter((id) => !kept.has(id));
    if (removed.length > 0) await tx.delete(spaceFixtures).where(inArray(spaceFixtures.id, removed));
    for (const [position, fixture] of fixtures.entries()) {
      const values = {
        kind: fixture.kind,
        label: fixture.label,
        xCm: fixture.xCm,
        yCm: fixture.yCm,
        widthCm: fixture.widthCm,
        depthCm: fixture.depthCm,
        rotationDeg: fixture.rotationDeg,
        outletCount: fixture.kind === "outlet" ? fixture.outletCount : null,
        amps: fixture.kind === "outlet" ? fixture.amps : null,
        threePhase: fixture.kind === "outlet" ? fixture.threePhase : false,
        note: fixture.note,
        position,
      };
      if (fixture.id && kept.has(fixture.id)) await tx.update(spaceFixtures).set({ ...values, updatedAt: new Date() }).where(eq(spaceFixtures.id, fixture.id));
      else await tx.insert(spaceFixtures).values({ organizationId, spaceId: space.id, ...values });
    }
    // Les plans de l'espace changent avec ses installations : leur révision avance.
    await tx.update(layouts).set({ revision: sql`${layouts.revision} + 1`, updatedAt: new Date() }).where(eq(layouts.spaceId, space.id));
  });
}

// Un espace, ses installations et ses plans (null : absent pour cette organisation).
export async function getSpace(organizationId: string, spaceId: string): Promise<FloorplanVenueSpaces[number] | null> {
  return inOrganization(organizationId, async (tx) => {
    const row = await findSpace(tx, spaceId);
    if (!row) return null;
    return { space: toSpace(row), fixtures: await fixturesOf(tx, row.id), layouts: await layoutSummaries(tx, [row.id]) };
  });
}
