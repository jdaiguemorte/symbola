// Lot 60 (L60-PLA-01, L60-PLA-02, L60-PLA-04 ; parties A, B et D, D7) — configurations nommées d'un
// espace et plans d'un évènement : création, copie, enregistrement de l'éditeur (révision protégée
// contre une écriture concurrente), contrôles signalés, copie d'une configuration du lieu dans un
// évènement sans modifier le lieu (et l'inverse), diffusion d'une version, copie ponctuelle des
// tables vers le plan de table du lot 50.
import { and, desc, eq, inArray, isNotNull, isNull } from "drizzle-orm";
import { layoutElements, layoutVersions, layouts, powerLinks, spaceFixtures, spaces } from "@symbola/db/schema/floorplans";
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { ENGAGED_CANDIDATE_STATUSES, type FloorplanEditorView, type FloorplanElementInput, type FloorplanLayout, type FloorplanLayoutSummary, type FloorplanSeatingTable, type FloorplanSnapshot, type FloorplanSpace, type FloorplanSpaceInput, type FloorplanVersionSummary } from "@symbola/contracts";
import { floorplanEditorRules } from "@symbola/starter-templates";
import { getEvent, listEventPlaces, listVendorCandidates } from "@/modules/events/service";
import { FloorplanInvalidError, FloorplanNotFoundError, FloorplanStaleError } from "./errors";
import { capacityOf, checkLayout, powerTable } from "./geometry";
import { elementInputSchema, layoutNameSchema, spaceInputSchema } from "./inputs";
import { elementsOf, ensureElementTypes, findLayout, fixturesOf, inOrganization, layoutSummaries, toSpace, UUID, type LayoutRow, type SpaceRow, type Tx } from "./repository";
import { spaceOf } from "./spaces";

// Version diffusée telle qu'elle est gardée ; la clé du fond de plan est dans sa colonne
// (layout_versions.background_key), jamais dans le document figé.
export type StoredSnapshot = FloorplanSnapshot;

function parseName(name: string): string {
  const parsed = layoutNameSchema.safeParse(name);
  if (!parsed.success) throw new FloorplanInvalidError("name");
  return parsed.data;
}

async function layoutOf(tx: Tx, layoutId: string): Promise<LayoutRow> {
  const layout = await findLayout(tx, layoutId);
  if (!layout) throw new FloorplanNotFoundError();
  return layout;
}

async function eventExists(organizationId: string, eventId: string): Promise<void> {
  if (!UUID.test(eventId) || !(await getEvent(organizationId, eventId))) throw new FloorplanNotFoundError();
}

// Prestataires retenus de l'évènement (retenu, contrat signé, soldé) : les seuls qu'un élément désigne.
export async function retainedCandidates(organizationId: string, eventId: string): Promise<{ id: string; vendorName: string }[]> {
  return (await listVendorCandidates(organizationId, eventId)).filter((candidate) => ENGAGED_CANDIDATE_STATUSES.includes(candidate.status)).map((candidate) => ({ id: candidate.id, vendorName: candidate.vendorName }));
}

async function loadLayout(tx: Tx, layout: LayoutRow): Promise<FloorplanLayout> {
  const elements = (await elementsOf(tx, [layout.id])).map(({ layoutId: _layoutId, ...element }) => element);
  return {
    id: layout.id,
    spaceId: layout.spaceId,
    eventId: layout.eventId,
    name: layout.name,
    capacity: capacityOf(elements),
    elementCount: elements.length,
    publishedVersion: layout.publishedVersion,
    updatedAt: layout.updatedAt.toISOString(),
    sourceLayoutId: layout.sourceLayoutId,
    revision: layout.revision,
    showVendorNames: layout.showVendorNames,
    elements,
  };
}

// —— Configurations nommées d'un espace (partie A) ————————————————————————————————————————————

export async function createLayout(organizationId: string, spaceId: string, name: string): Promise<string> {
  const value = parseName(name);
  return inOrganization(organizationId, async (tx) => {
    const space = await spaceOf(tx, spaceId);
    const [row] = await tx.insert(layouts).values({ organizationId, spaceId: space.id, eventId: space.eventId, name: value }).returning({ id: layouts.id });
    return row!.id;
  });
}

export async function renameLayout(organizationId: string, layoutId: string, name: string): Promise<void> {
  const value = parseName(name);
  await inOrganization(organizationId, async (tx) => {
    const layout = await layoutOf(tx, layoutId);
    await tx.update(layouts).set({ name: value, updatedAt: new Date() }).where(eq(layouts.id, layout.id));
  });
}

// Copie des éléments (et de leurs liaisons aux prises) d'un plan vers un autre ; fixtureMap traduit
// une prise de l'espace source en prise de l'espace cible (absente : la liaison n'est pas copiée).
async function copyElements(tx: Tx, organizationId: string, fromLayoutId: string, toLayoutId: string, options: { fixtureMap: Map<string, string>; keepVendors: boolean }): Promise<void> {
  const elements = await elementsOf(tx, [fromLayoutId]);
  for (const [position, element] of elements.entries()) {
    const [created] = await tx
      .insert(layoutElements)
      .values({
        organizationId,
        layoutId: toLayoutId,
        elementTypeId: element.elementTypeId,
        typeStarterKey: element.typeStarterKey,
        typeLabel: element.typeLabel,
        category: element.category,
        shape: element.shape,
        name: element.name,
        xCm: element.xCm,
        yCm: element.yCm,
        widthCm: element.widthCm,
        depthCm: element.depthCm,
        rotationDeg: element.rotationDeg,
        seats: element.seats,
        color: element.color,
        note: element.note,
        vendorCandidateId: options.keepVendors ? element.vendorCandidateId : null,
        powerOutlets: element.powerOutlets,
        powerAmps: element.powerAmps,
        needsWater: element.needsWater,
        maxCableM: element.maxCableM,
        position,
      })
      .returning({ id: layoutElements.id });
    const fixtureId = element.fixtureId ? options.fixtureMap.get(element.fixtureId) : undefined;
    if (fixtureId) await tx.insert(powerLinks).values({ organizationId, elementId: created!.id, fixtureId });
  }
}

async function identityFixtures(tx: Tx, spaceId: string): Promise<Map<string, string>> {
  return new Map((await fixturesOf(tx, spaceId)).map((fixture) => [fixture.id, fixture.id]));
}

export async function duplicateLayout(organizationId: string, layoutId: string, name: string): Promise<string> {
  const value = parseName(name);
  return inOrganization(organizationId, async (tx) => {
    const source = await layoutOf(tx, layoutId);
    const [row] = await tx.insert(layouts).values({ organizationId, spaceId: source.spaceId, eventId: source.eventId, sourceLayoutId: source.sourceLayoutId, name: value, showVendorNames: source.showVendorNames }).returning({ id: layouts.id });
    await copyElements(tx, organizationId, source.id, row!.id, { fixtureMap: await identityFixtures(tx, source.spaceId), keepVendors: true });
    return row!.id;
  });
}

// Retrait d'un plan ; l'espace d'un évènement qui n'a plus de plan part avec lui (il était sa copie).
export async function removeLayout(organizationId: string, layoutId: string): Promise<{ emptiedEventSpaceId: string | null }> {
  return inOrganization(organizationId, async (tx) => {
    const layout = await layoutOf(tx, layoutId);
    await tx.delete(layouts).where(eq(layouts.id, layout.id));
    if (!layout.eventId) return { emptiedEventSpaceId: null };
    const [left] = await tx.select({ id: layouts.id }).from(layouts).where(eq(layouts.spaceId, layout.spaceId)).limit(1);
    return { emptiedEventSpaceId: left ? null : layout.spaceId };
  });
}

// —— Éditeur (partie B) ————————————————————————————————————————————————————————————————————————

export async function getLayoutEditor(organizationId: string, layoutId: string): Promise<FloorplanEditorView> {
  const data = await inOrganization(organizationId, async (tx) => {
    const layout = await layoutOf(tx, layoutId);
    const space = await spaceOf(tx, layout.spaceId);
    return { space, fixtures: await fixturesOf(tx, space.id), layout: await loadLayout(tx, layout) };
  });
  const event = data.layout.eventId ? await getEvent(organizationId, data.layout.eventId) : null;
  if (data.layout.eventId && !event) throw new FloorplanNotFoundError();
  const expectedGuests = event?.guestsEstimated ?? null;
  return {
    space: toSpace(data.space),
    fixtures: data.fixtures,
    layout: data.layout,
    findings: checkLayout({ space: data.space, fixtures: data.fixtures, elements: data.layout.elements, expectedGuests }),
    power: powerTable(data.fixtures, data.layout.elements),
    expectedGuests,
  };
}

// Enregistrement de l'éditeur, d'un bloc. revision est celle lue à l'ouverture : si le plan a changé
// depuis, rien n'est écrit (FloorplanStaleError). Un élément absent de la liste est retiré ; un
// identifiant inconnu est un nouvel élément. Un prestataire n'est désigné que sur le plan d'un
// évènement, parmi ses prestataires retenus ; une prise, parmi les prises de l'espace.
export async function saveLayoutElements(organizationId: string, layoutId: string, revision: number, input: FloorplanElementInput[]): Promise<number> {
  const parsed = elementInputSchema.array().safeParse(input);
  if (!parsed.success) throw new FloorplanInvalidError("elements");
  const elements = parsed.data;
  if (elements.length > floorplanEditorRules().maxElements) throw new FloorplanInvalidError("too_many_elements");
  const head = await inOrganization(organizationId, (tx) => layoutOf(tx, layoutId));
  const allowedVendors = new Set(head.eventId ? (await retainedCandidates(organizationId, head.eventId)).map((candidate) => candidate.id) : []);
  for (const element of elements) {
    if (element.vendorCandidateId && !allowedVendors.has(element.vendorCandidateId)) throw new FloorplanInvalidError("vendor");
    if ((element.typeStarterKey === null) === (element.typeLabel === null)) throw new FloorplanInvalidError("elements");
  }
  return inOrganization(organizationId, async (tx) => {
    const [layout] = await tx.select().from(layouts).where(eq(layouts.id, head.id)).for("update");
    if (!layout) throw new FloorplanNotFoundError();
    if (layout.revision !== revision) throw new FloorplanStaleError();
    const outlets = new Set((await tx.select({ id: spaceFixtures.id }).from(spaceFixtures).where(and(eq(spaceFixtures.spaceId, layout.spaceId), eq(spaceFixtures.kind, "outlet")))).map((row) => row.id));
    const types = new Set((await ensureElementTypes(tx, organizationId)).map((row) => row.id));
    for (const element of elements) {
      if (element.fixtureId && !outlets.has(element.fixtureId)) throw new FloorplanInvalidError("fixture_link");
      if (element.elementTypeId && !types.has(element.elementTypeId)) throw new FloorplanInvalidError("element_type");
    }
    const existing = new Set((await tx.select({ id: layoutElements.id }).from(layoutElements).where(eq(layoutElements.layoutId, layout.id))).map((row) => row.id));
    const kept = new Set(elements.map((element) => element.id).filter((id): id is string => typeof id === "string" && existing.has(id)));
    const removed = [...existing].filter((id) => !kept.has(id));
    if (removed.length > 0) await tx.delete(layoutElements).where(inArray(layoutElements.id, removed));
    if (kept.size > 0) await tx.delete(powerLinks).where(inArray(powerLinks.elementId, [...kept]));
    for (const [position, element] of elements.entries()) {
      const values = {
        elementTypeId: element.elementTypeId,
        typeStarterKey: element.typeStarterKey,
        typeLabel: element.typeLabel,
        category: element.category,
        shape: element.shape,
        name: element.name,
        xCm: element.xCm,
        yCm: element.yCm,
        widthCm: element.widthCm,
        depthCm: element.depthCm,
        rotationDeg: element.rotationDeg,
        seats: element.seats,
        color: element.color,
        note: element.note,
        vendorCandidateId: layout.eventId ? element.vendorCandidateId : null,
        powerOutlets: element.powerOutlets,
        powerAmps: element.powerOutlets > 0 ? element.powerAmps : null,
        needsWater: element.needsWater,
        maxCableM: element.powerOutlets > 0 ? element.maxCableM : null,
        position,
      };
      let elementId: string;
      if (element.id && kept.has(element.id)) {
        await tx.update(layoutElements).set({ ...values, updatedAt: new Date() }).where(eq(layoutElements.id, element.id));
        elementId = element.id;
      } else {
        const [created] = await tx.insert(layoutElements).values({ organizationId, layoutId: layout.id, ...values }).returning({ id: layoutElements.id });
        elementId = created!.id;
      }
      if (element.fixtureId && element.powerOutlets > 0) await tx.insert(powerLinks).values({ organizationId, elementId, fixtureId: element.fixtureId });
    }
    const next = layout.revision + 1;
    await tx.update(layouts).set({ revision: next, updatedAt: new Date() }).where(eq(layouts.id, layout.id));
    return next;
  });
}

// D8 : nommer les prestataires aux autres prestataires et au client, au choix de la planner.
export async function setShowVendorNames(organizationId: string, layoutId: string, show: boolean): Promise<void> {
  await inOrganization(organizationId, async (tx) => {
    const layout = await layoutOf(tx, layoutId);
    if (!layout.eventId) throw new FloorplanInvalidError("vendor");
    await tx.update(layouts).set({ showVendorNames: show, updatedAt: new Date() }).where(eq(layouts.id, layout.id));
  });
}

// —— Plan de l'évènement (partie D) ————————————————————————————————————————————————————————————

export type EventFloorplans = { space: FloorplanSpace; layouts: FloorplanLayoutSummary[] }[];

export async function listEventFloorplans(organizationId: string, eventId: string): Promise<EventFloorplans> {
  await eventExists(organizationId, eventId);
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select().from(spaces).where(eq(spaces.eventId, eventId)).orderBy(spaces.createdAt);
    const summaries = await layoutSummaries(tx, rows.map((row) => row.id));
    return rows.map((row) => ({ space: toSpace(row), layouts: summaries.filter((layout) => layout.spaceId === row.id) }));
  });
}

async function eventPlaceIdOf(organizationId: string, eventId: string, eventPlaceId: string | null): Promise<string | null> {
  if (!eventPlaceId) return null;
  return (await listEventPlaces(organizationId, eventId)).some((place) => place.id === eventPlaceId) ? eventPlaceId : null;
}

// Lieu hors catalogue : un espace vide aux dimensions saisies, et son plan.
export async function createEventSpace(organizationId: string, eventId: string, input: FloorplanSpaceInput, eventPlaceId: string | null = null): Promise<string> {
  const parsed = spaceInputSchema.safeParse(input);
  if (!parsed.success) throw new FloorplanInvalidError(parsed.error.issues.some((issue) => issue.path[0] === "name") ? "name" : "size");
  await eventExists(organizationId, eventId);
  const placeId = await eventPlaceIdOf(organizationId, eventId, eventPlaceId);
  return inOrganization(organizationId, async (tx) => {
    const [space] = await tx.insert(spaces).values({ organizationId, eventId, eventPlaceId: placeId, ...parsed.data }).returning({ id: spaces.id });
    const [layout] = await tx.insert(layouts).values({ organizationId, spaceId: space!.id, eventId, name: parsed.data.name }).returning({ id: layouts.id });
    return layout!.id;
  });
}

// L60-PLA-04 : une configuration du lieu est copiée dans l'évènement (espace, installations, éléments),
// puis ajustée sans modifier le lieu. Une seconde configuration du même espace rejoint la copie déjà
// faite de cet espace dans l'évènement.
export async function copyVenueLayoutToEvent(organizationId: string, eventId: string, layoutId: string, eventPlaceId: string | null = null): Promise<string> {
  await eventExists(organizationId, eventId);
  const placeId = await eventPlaceIdOf(organizationId, eventId, eventPlaceId);
  return inOrganization(organizationId, async (tx) => {
    const source = await layoutOf(tx, layoutId);
    if (source.eventId) throw new FloorplanInvalidError("no_source");
    const sourceSpace = await spaceOf(tx, source.spaceId);
    const [already] = await tx.select().from(spaces).where(and(eq(spaces.eventId, eventId), eq(spaces.sourceSpaceId, sourceSpace.id))).limit(1);
    let target: SpaceRow;
    const fixtureMap = new Map<string, string>();
    if (already) {
      target = already;
      const copies = await tx.select({ id: spaceFixtures.id, sourceFixtureId: spaceFixtures.sourceFixtureId }).from(spaceFixtures).where(and(eq(spaceFixtures.spaceId, already.id), isNotNull(spaceFixtures.sourceFixtureId)));
      for (const copy of copies) fixtureMap.set(copy.sourceFixtureId!, copy.id);
    } else {
      const [created] = await tx
        .insert(spaces)
        .values({
          organizationId,
          vendorId: sourceSpace.vendorId,
          eventId,
          eventPlaceId: placeId,
          sourceSpaceId: sourceSpace.id,
          name: sourceSpace.name,
          widthCm: sourceSpace.widthCm,
          depthCm: sourceSpace.depthCm,
          backgroundKey: sourceSpace.backgroundKey,
          backgroundMime: sourceSpace.backgroundMime,
          backgroundSizeBytes: sourceSpace.backgroundSizeBytes,
          backgroundWidthPx: sourceSpace.backgroundWidthPx,
          backgroundHeightPx: sourceSpace.backgroundHeightPx,
          calibrationAx: sourceSpace.calibrationAx,
          calibrationAy: sourceSpace.calibrationAy,
          calibrationBx: sourceSpace.calibrationBx,
          calibrationBy: sourceSpace.calibrationBy,
          calibrationDistanceCm: sourceSpace.calibrationDistanceCm,
        })
        .returning();
      target = created!;
      for (const fixture of await fixturesOf(tx, sourceSpace.id)) {
        const { id, ...values } = fixture;
        const [copy] = await tx.insert(spaceFixtures).values({ ...values, organizationId, spaceId: target.id, sourceFixtureId: id }).returning({ id: spaceFixtures.id });
        fixtureMap.set(id, copy!.id);
      }
    }
    const [layout] = await tx.insert(layouts).values({ organizationId, spaceId: target.id, eventId, sourceLayoutId: source.id, name: source.name }).returning({ id: layouts.id });
    await copyElements(tx, organizationId, source.id, layout!.id, { fixtureMap, keepVendors: false });
    return layout!.id;
  });
}

// « Enregistrer comme configuration du lieu » : l'inverse de la copie, sans prestataire nommé.
export async function saveEventLayoutToVenue(organizationId: string, layoutId: string, name: string): Promise<string> {
  const value = parseName(name);
  return inOrganization(organizationId, async (tx) => {
    const layout = await layoutOf(tx, layoutId);
    const space = await spaceOf(tx, layout.spaceId);
    const venueSpace = space.sourceSpaceId ? await tx.select().from(spaces).where(and(eq(spaces.id, space.sourceSpaceId), isNull(spaces.eventId))).then((rows) => rows[0]) : undefined;
    if (!layout.eventId || !venueSpace) throw new FloorplanInvalidError("no_source");
    const copies = await tx.select({ id: spaceFixtures.id, sourceFixtureId: spaceFixtures.sourceFixtureId }).from(spaceFixtures).where(eq(spaceFixtures.spaceId, space.id));
    const venueFixtures = new Set((await fixturesOf(tx, venueSpace.id)).map((fixture) => fixture.id));
    const fixtureMap = new Map(copies.filter((copy) => copy.sourceFixtureId && venueFixtures.has(copy.sourceFixtureId)).map((copy) => [copy.id, copy.sourceFixtureId!]));
    const [created] = await tx.insert(layouts).values({ organizationId, spaceId: venueSpace.id, name: value }).returning({ id: layouts.id });
    await copyElements(tx, organizationId, layout.id, created!.id, { fixtureMap, keepVendors: false });
    return created!.id;
  });
}

// L60-PLA-05 : diffusion d'une version du plan d'un évènement, figée sans note interne. Le numéro
// avance à chaque diffusion ; les prestataires et le client voient la dernière, signalée nouvelle.
export async function publishEventLayout(organizationId: string, layoutId: string, userId: string | null): Promise<number> {
  const version = await inOrganization(organizationId, async (tx) => {
    const [layout] = await tx.select().from(layouts).where(eq(layouts.id, UUID.test(layoutId) ? layoutId : "00000000-0000-0000-0000-000000000000")).for("update");
    if (!layout) throw new FloorplanNotFoundError();
    if (!layout.eventId) throw new FloorplanInvalidError("no_source");
    const space = await spaceOf(tx, layout.spaceId);
    const view = await loadLayout(tx, layout);
    const fixtures = await fixturesOf(tx, space.id);
    const spaceView = toSpace(space);
    const snapshot: StoredSnapshot = {
      layoutName: layout.name,
      space: { name: space.name, widthCm: space.widthCm, depthCm: space.depthCm, background: spaceView.background, calibration: spaceView.calibration },
      fixtures: fixtures.map(({ note: _note, ...fixture }) => fixture),
      elements: view.elements.map(({ note: _note, elementTypeId: _type, ...element }) => element),
      showVendorNames: layout.showVendorNames,
    };
    const next = layout.publishedVersion + 1;
    await tx.insert(layoutVersions).values({ organizationId, layoutId: layout.id, version: next, snapshot, backgroundKey: space.backgroundKey, publishedBy: userId });
    await tx.update(layouts).set({ publishedVersion: next, updatedAt: new Date() }).where(eq(layouts.id, layout.id));
    return { next, eventId: layout.eventId };
  });
  await recordAudit(appDatabase(), { organizationId, action: "floorplans.plan.published", objectId: version.eventId, details: { version: version.next } });
  return version.next;
}

export async function listLayoutVersions(organizationId: string, layoutId: string): Promise<FloorplanVersionSummary[]> {
  return inOrganization(organizationId, async (tx) => {
    const layout = await layoutOf(tx, layoutId);
    const rows = await tx.select({ version: layoutVersions.version, publishedAt: layoutVersions.publishedAt }).from(layoutVersions).where(eq(layoutVersions.layoutId, layout.id)).orderBy(desc(layoutVersions.version));
    return rows.map((row) => ({ version: row.version, publishedAt: row.publishedAt.toISOString() }));
  });
}

// D7 : les tables du plan de salle (nom ou numéro, forme, places) pour le plan de table du lot 50,
// copiées une fois, sans synchronisation. defaultName nomme une table sans nom (« Table 3 »).
export async function seatingTablesOf(organizationId: string, layoutId: string, eventId: string, defaultName: (index: number) => string): Promise<FloorplanSeatingTable[]> {
  const layout = await inOrganization(organizationId, async (tx) => {
    const row = await layoutOf(tx, layoutId);
    if (row.eventId !== eventId) throw new FloorplanNotFoundError();
    return loadLayout(tx, row);
  });
  const tables = layout.elements.filter((element) => element.category === "table" && element.seats > 0);
  if (tables.length === 0) throw new FloorplanInvalidError("no_tables");
  return tables.map((element, index) => ({
    name: element.name ?? defaultName(index + 1),
    shape: element.typeStarterKey === "head_table" ? "head" : element.shape === "rect" ? "rectangular" : "round",
    capacity: element.seats,
  }));
}

// Évènement retiré pour de bon (corbeille, effacement) : ses plans partent avec lui.
export async function removeEventFloorplanRows(organizationId: string, eventIds: string[]): Promise<string[]> {
  const ids = eventIds.filter((id) => UUID.test(id));
  if (ids.length === 0) return [];
  return inOrganization(organizationId, async (tx) => {
    const removed = await tx.delete(spaces).where(inArray(spaces.eventId, ids)).returning({ key: spaces.backgroundKey });
    return removed.map((row) => row.key).filter((key): key is string => key !== null);
  });
}

