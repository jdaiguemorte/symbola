// Lot 60 — L60-PLA-01 à L60-PLA-05 (prolongement de PRE-06), contre un vrai PostgreSQL (RLS), le
// stockage privé et l'antivirus du socle : configurations d'un lieu du catalogue, fond de plan calibré,
// installations, éditeur enregistré d'un bloc (révision), contrôles, copie vers un évènement sans
// toucher au lieu, versions diffusées et vue des liens (D8), PDF à l'échelle, copie des tables vers le
// plan de table (D7). Tests d'abus : autre organisation, prestataire non retenu, lien d'un autre
// évènement, prestataire désigné sur un lieu, prise d'un autre espace, révision périmée. Données
// fictives générées (aucune donnée réelle).
import { randomUUID } from "node:crypto";
import { deflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import type { FloorplanElement, FloorplanElementInput, FloorplanFixtureInput } from "@symbola/contracts";
import { addEventPlace, addEventVendorSlot, addKeyMoment, addVendorCandidate, createProspect, createProspectSource, selectVendorCandidate, setEventIdentity } from "@/modules/events/service";
import { setModuleEnabled, type ModuleKey } from "@/modules/hub/service";
import { createVendor } from "@/modules/vendors/service";
import { confirmImpactAssessment, getSeatingPlan } from "@/modules/guests/service";
import { appDatabase, type AppDatabase } from "@symbola/db/client";
import {
  calibrateSpace,
  copyLayoutTablesToSeating,
  copyVenueLayoutToEvent,
  createEventSpace,
  createLayout,
  createVenueSpace,
  downloadLayoutPdf,
  downloadSharedFloorplanPdf,
  duplicateLayout,
  FloorplanInvalidError,
  FloorplanNotFoundError,
  FloorplanStaleError,
  floorplansForLink,
  floorplansPrivacy,
  getLayoutEditor,
  getSpace,
  getSpaceBackground,
  listElementTypes,
  listEventFloorplans,
  listVenueSpaces,
  publishEventLayout,
  removeEventFloorplansData,
  saveEventLayoutToVenue,
  saveFixtures,
  saveLayoutElements,
  setShowVendorNames,
  setSpaceBackground,
  sharedFloorplanBackground,
} from "./service";

// La réserve partagée du processus (rendue à la fin de chaque fichier par vitest.integration.setup.ts).
function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  return fn(appDatabase());
}

async function organization(modules: ModuleKey[] = ["floorplans"]) {
  const organizationId = (await withDb((db) => createOrganization(db, `Atelier ${randomUUID().slice(0, 8)}`))).id;
  const owner = await withDb((db) => createUser(db, { organizationId, email: `owner-${randomUUID()}@example.test`, role: "owner" }));
  for (const moduleKey of modules) await withDb((db) => setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey, enabled: true }));
  return { organizationId, ownerId: owner.id };
}

// Un PNG réel d'une couleur (l'antivirus et le contrôle du type le lisent pour de vrai).
function png(width: number, height: number): Uint8Array {
  const crc = (bytes: Buffer) => {
    let c = ~0;
    for (const byte of bytes) {
      c ^= byte;
      for (let k = 0; k < 8; k += 1) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
    return (~c >>> 0) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const head = Buffer.alloc(8);
    head.writeUInt32BE(data.length, 0);
    head.write(type, 4, "ascii");
    const tail = Buffer.alloc(4);
    tail.writeUInt32BE(crc(Buffer.concat([Buffer.from(type, "ascii"), data])), 0);
    return Buffer.concat([head, data, tail]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 2, 0, 0, 0], 8);
  const raw = Buffer.alloc((width * 3 + 1) * height, 0xee);
  for (let row = 0; row < height; row += 1) raw[row * (width * 3 + 1)] = 0;
  return new Uint8Array(Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]));
}

const outlet = (overrides: Partial<FloorplanFixtureInput> = {}): FloorplanFixtureInput => ({ kind: "outlet", label: "Prise scène", xCm: 100, yCm: 20, widthCm: 40, depthCm: 20, rotationDeg: 0, outletCount: 2, amps: 16, threePhase: false, note: null, ...overrides });

function table(overrides: Partial<FloorplanElementInput> = {}): FloorplanElementInput {
  return {
    id: null,
    elementTypeId: null,
    typeStarterKey: "round_table",
    typeLabel: null,
    category: "table",
    shape: "circle",
    name: null,
    xCm: 400,
    yCm: 400,
    widthCm: 180,
    depthCm: 180,
    rotationDeg: 0,
    seats: 10,
    color: null,
    note: null,
    vendorCandidateId: null,
    powerOutlets: 0,
    powerAmps: null,
    needsWater: false,
    maxCableM: null,
    fixtureId: null,
    ...overrides,
  };
}

const dj = (overrides: Partial<FloorplanElementInput> = {}) => table({ typeStarterKey: "dj", category: "setup", shape: "rect", widthCm: 200, depthCm: 100, seats: 0, xCm: 1500, yCm: 200, powerOutlets: 2, powerAmps: 16, ...overrides });

// Château de référence : une salle de 20 × 12 m, une prise de deux prises 16 A, une configuration
// « Dîner » de deux rondes et un DJ relié à la prise.
async function chateau(organizationId: string) {
  const { vendor } = await createVendor(organizationId, { name: "Château des Essais", typeId: null });
  const spaceId = await createVenueSpace(organizationId, vendor.id, { name: "Salle des fêtes", widthCm: 2000, depthCm: 1200 });
  await saveFixtures(organizationId, spaceId, [outlet(), { ...outlet({ kind: "delivery", label: null, outletCount: null, amps: null, xCm: 1000, yCm: 1190, widthCm: 300, depthCm: 20 }) }]);
  const fixtureId = (await getSpace(organizationId, spaceId))!.fixtures.find((fixture) => fixture.kind === "outlet")!.id;
  const layoutId = await createLayout(organizationId, spaceId, "Dîner 120 en rondes");
  await saveLayoutElements(organizationId, layoutId, 0, [table({ name: "Table 1" }), table({ name: "Table 2", xCm: 800 }), dj({ fixtureId, note: "Brancher après 18 h" })]);
  return { vendorId: vendor.id, spaceId, layoutId, fixtureId };
}

// Mariage au château : le lieu au programme, un traiteur et un DJ retenus, un photographe consulté.
async function wedding(organizationId: string, ownerId: string, vendorId: string) {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: ownerId, prospectSourceId: source.id, clients: [{ firstName: "Camille", lastName: "Essai" }], eventDate: "2027-06-12" });
  await setEventIdentity(organizationId, event.id, { guestsEstimated: 30, guestsConfirmed: null, style: null, notes: null });
  const place = await addEventPlace(organizationId, event.id, { label: "Château des Essais", vendorId });
  const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
  const music = await addEventVendorSlot(organizationId, event.id, "Musique");
  const photo = await addEventVendorSlot(organizationId, event.id, "Photographe");
  const karim = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: "Traiteur Karim" });
  const studio = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: music.id, vendorName: "Studio Lumière" });
  const pending = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: photo.id, vendorName: "Photo en lice" });
  await selectVendorCandidate({ organizationId, candidateId: karim.id, changedByUserId: ownerId });
  await selectVendorCandidate({ organizationId, candidateId: studio.id, changedByUserId: ownerId });
  return { eventId: event.id, placeId: place.id, karimId: karim.id, studioId: studio.id, pendingId: pending.id };
}

const linkOf = (organizationId: string, eventId: string, audience: "vendor" | "client", vendorCandidateId: string | null = null) => ({ organizationId, eventId, linkId: randomUUID(), audience, vendorCandidateId });

describe("L60-PLA-01 — Configurations d'un lieu du catalogue", () => {
  it("espaces, dimensions, installations et configurations nommées, avec leur capacité calculée", async () => {
    const { organizationId } = await organization();
    const { vendorId, spaceId, layoutId } = await chateau(organizationId);
    await createLayout(organizationId, spaceId, "Cocktail debout");
    const [entry] = await listVenueSpaces(organizationId, vendorId);
    expect(entry!.space).toMatchObject({ name: "Salle des fêtes", widthCm: 2000, depthCm: 1200, vendorId, eventId: null });
    expect(entry!.fixtures.map((fixture) => fixture.kind).sort()).toEqual(["delivery", "outlet"]);
    expect(entry!.layouts.map((layout) => [layout.name, layout.capacity, layout.elementCount])).toEqual([
      ["Dîner 120 en rondes", 20, 3],
      ["Cocktail debout", 0, 0],
    ]);
    const copy = await duplicateLayout(organizationId, layoutId, "Dîner bis");
    expect((await getLayoutEditor(organizationId, copy)).layout.capacity).toBe(20);
  });

  it("la bibliothèque est copiée des données de départ : tables de toutes formes et installations de soirée", async () => {
    const { organizationId } = await organization();
    const types = await listElementTypes(organizationId, "fr");
    expect(types.filter((type) => type.category === "table").map((type) => type.shape)).toEqual(expect.arrayContaining(["circle", "rect", "ellipse"]));
    expect(types.find((type) => type.starterKey === "dj")).toMatchObject({ label: "DJ", powerOutlets: 2, powerAmps: 16 });
    expect((await listElementTypes(organizationId, "en")).find((type) => type.starterKey === "round_table")!.label).toBe("Round table");
  });

  it("D4 : fond de plan en image seulement, contrôlé à l'envoi ; calibré par deux points, l'espace prend la taille de l'image", async () => {
    const { organizationId } = await organization();
    const { spaceId } = await chateau(organizationId);
    await expect(setSpaceBackground(organizationId, spaceId, new TextEncoder().encode("%PDF-1.7 plan"))).rejects.toMatchObject({ problem: "background_type" });
    await setSpaceBackground(organizationId, spaceId, png(400, 240));
    const space = (await getSpace(organizationId, spaceId))!.space;
    expect(space.background).toMatchObject({ mime: "image/png", widthPx: 400, heightPx: 240 });
    expect(space.calibration).toBeNull();
    // Deux points à 100 px l'un de l'autre, distants de 5 m : 5 cm par pixel, image de 20 × 12 m.
    await calibrateSpace(organizationId, spaceId, { ax: 0, ay: 0, bx: 100, by: 0, distanceCm: 500 }, true);
    expect((await getSpace(organizationId, spaceId))!.space).toMatchObject({ widthCm: 2000, depthCm: 1200, calibration: { distanceCm: 500 } });
    await expect(calibrateSpace(organizationId, spaceId, { ax: 10, ay: 10, bx: 10, by: 10, distanceCm: 500 }, false)).rejects.toBeInstanceOf(FloorplanInvalidError);
    await expect(calibrateSpace(organizationId, spaceId, { ax: 0, ay: 0, bx: 900, by: 0, distanceCm: 500 }, false)).rejects.toBeInstanceOf(FloorplanInvalidError);
    const file = await getSpaceBackground(organizationId, spaceId);
    expect(file.contentType).toBe("image/png");
  });

  it("SEC-10, SEC-13 : une organisation ne lit ni ne modifie les configurations d'une autre, qui répondent comme absentes", async () => {
    const a = await organization();
    const b = await organization();
    const { vendorId, spaceId, layoutId } = await chateau(a.organizationId);
    await expect(listVenueSpaces(b.organizationId, vendorId)).rejects.toBeInstanceOf(FloorplanNotFoundError);
    expect(await getSpace(b.organizationId, spaceId)).toBeNull();
    await expect(getLayoutEditor(b.organizationId, layoutId)).rejects.toBeInstanceOf(FloorplanNotFoundError);
    await expect(saveLayoutElements(b.organizationId, layoutId, 1, [])).rejects.toBeInstanceOf(FloorplanNotFoundError);
    await expect(saveFixtures(b.organizationId, spaceId, [])).rejects.toBeInstanceOf(FloorplanNotFoundError);
    await expect(createLayout(b.organizationId, spaceId, "Vol")).rejects.toBeInstanceOf(FloorplanNotFoundError);
    await expect(createVenueSpace(b.organizationId, vendorId, { name: "Vol", widthCm: 1000, depthCm: 1000 })).rejects.toBeInstanceOf(FloorplanNotFoundError);
    expect((await getLayoutEditor(a.organizationId, layoutId)).layout.elements).toHaveLength(3);
  });
});

describe("L60-PLA-02 — Éditeur enregistré d'un bloc, contrôles signalés", () => {
  it("un enregistrement porte la révision lue : une écriture périmée est refusée, rien n'est écrasé", async () => {
    const { organizationId } = await organization();
    const { layoutId } = await chateau(organizationId);
    const view = await getLayoutEditor(organizationId, layoutId);
    const moved = view.layout.elements.map((element) => (element.name === "Table 1" ? { ...element, xCm: 450, rotationDeg: 15 } : element));
    const next = await saveLayoutElements(organizationId, layoutId, view.layout.revision, moved);
    expect(next).toBe(view.layout.revision + 1);
    await expect(saveLayoutElements(organizationId, layoutId, view.layout.revision, [])).rejects.toBeInstanceOf(FloorplanStaleError);
    const after = await getLayoutEditor(organizationId, layoutId);
    expect(after.layout.elements.find((element) => element.name === "Table 1")).toMatchObject({ xCm: 450, rotationDeg: 15 });
    expect(after.layout.elements.map((element) => element.id).sort()).toEqual(view.layout.elements.map((element) => element.id).sort());
  });

  it("contrôles signalés, jamais bloquants : chevauchement, hors de l'espace, places, prise surchargée", async () => {
    const { organizationId } = await organization();
    const { layoutId, fixtureId } = await chateau(organizationId);
    const view = await getLayoutEditor(organizationId, layoutId);
    await saveLayoutElements(organizationId, layoutId, view.layout.revision, [
      ...view.layout.elements,
      table({ name: "Table 3", xCm: 450 }),
      table({ name: "Table 4", xCm: 1990 }),
      dj({ typeStarterKey: "bar", fixtureId, xCm: 1500, yCm: 900, powerOutlets: 1 }),
    ]);
    const { findings, power } = await getLayoutEditor(organizationId, layoutId);
    const named = (await getLayoutEditor(organizationId, layoutId)).layout.elements;
    const idOf = (name: string) => named.find((element) => element.name === name)!.id;
    expect(findings).toContainEqual({ kind: "overlap", elementIds: [idOf("Table 1"), idOf("Table 3")] });
    expect(findings).toContainEqual({ kind: "outside", elementId: idOf("Table 4") });
    expect(findings).toContainEqual({ kind: "outlet_overloaded", fixtureId, used: 3, available: 2 });
    expect(power).toEqual([expect.objectContaining({ fixtureId, used: 3, overloaded: true })]);
  });

  it("abus : un prestataire n'est jamais désigné sur la configuration d'un lieu ; une prise d'un autre espace est refusée", async () => {
    const { organizationId } = await organization();
    const first = await chateau(organizationId);
    const second = await chateau(organizationId);
    await expect(saveLayoutElements(organizationId, first.layoutId, 1, [table({ vendorCandidateId: randomUUID() })])).rejects.toMatchObject({ problem: "vendor" });
    await expect(saveLayoutElements(organizationId, first.layoutId, 1, [dj({ fixtureId: second.fixtureId })])).rejects.toMatchObject({ problem: "fixture_link" });
    await expect(saveLayoutElements(organizationId, first.layoutId, 1, [table({ typeStarterKey: null, typeLabel: null })])).rejects.toMatchObject({ problem: "elements" });
    await expect(saveLayoutElements(organizationId, first.layoutId, 1, [table({ elementTypeId: randomUUID() })])).rejects.toMatchObject({ problem: "element_type" });
  });

  it("une installation retirée emporte la liaison de l'élément qui s'y branchait (signalé, sans erreur)", async () => {
    const { organizationId } = await organization();
    const { spaceId, layoutId } = await chateau(organizationId);
    const kept = (await getSpace(organizationId, spaceId))!.fixtures.filter((fixture) => fixture.kind !== "outlet");
    await saveFixtures(organizationId, spaceId, kept);
    const view = await getLayoutEditor(organizationId, layoutId);
    const djId = view.layout.elements.find((element) => element.typeStarterKey === "dj")!.id;
    expect(view.layout.elements.find((element) => element.id === djId)!.fixtureId).toBeNull();
    expect(view.findings).toContainEqual({ kind: "power_unlinked", elementId: djId });
    await expect(saveFixtures(organizationId, spaceId, [outlet({ outletCount: null })])).rejects.toMatchObject({ problem: "fixtures" });
  });
});

describe("L60-PLA-04 — Plan de l'évènement : copie d'une configuration, sans modifier le lieu", () => {
  it("la copie emporte espace, installations, éléments et liaisons ; l'ajuster ne touche pas au lieu", async () => {
    const { organizationId, ownerId } = await organization();
    const venue = await chateau(organizationId);
    const event = await wedding(organizationId, ownerId, venue.vendorId);
    const layoutId = await copyVenueLayoutToEvent(organizationId, event.eventId, venue.layoutId, event.placeId);
    const view = await getLayoutEditor(organizationId, layoutId);
    expect(view.space).toMatchObject({ eventId: event.eventId, eventPlaceId: event.placeId, sourceSpaceId: venue.spaceId, vendorId: venue.vendorId });
    expect(view.layout.elements).toHaveLength(3);
    const copiedDj = view.layout.elements.find((element) => element.typeStarterKey === "dj")!;
    expect(view.fixtures.map((fixture) => fixture.id)).toContain(copiedDj.fixtureId);
    expect(copiedDj.fixtureId).not.toBe(venue.fixtureId);
    expect(view.expectedGuests).toBe(30);
    expect(view.findings).toContainEqual({ kind: "seats_short", seats: 20, expected: 30 });
    // Ajustement : le DJ devient Studio Lumière, une table part. Le lieu ne bouge pas.
    await saveLayoutElements(organizationId, layoutId, view.layout.revision, view.layout.elements.filter((element) => element.name !== "Table 2").map((element) => (element.id === copiedDj.id ? { ...element, vendorCandidateId: event.studioId } : element)));
    await saveFixtures(organizationId, view.space.id, []);
    const venueAfter = await getLayoutEditor(organizationId, venue.layoutId);
    expect(venueAfter.layout.elements).toHaveLength(3);
    expect(venueAfter.layout.elements.every((element) => element.vendorCandidateId === null)).toBe(true);
    expect(venueAfter.fixtures).toHaveLength(2);
    // Une seconde configuration du même espace rejoint la copie déjà faite.
    const second = await copyVenueLayoutToEvent(organizationId, event.eventId, venue.layoutId);
    expect((await getLayoutEditor(organizationId, second)).space.id).toBe(view.space.id);
    const plans = await listEventFloorplans(organizationId, event.eventId);
    expect(plans).toHaveLength(1);
    expect(plans[0]!.layouts).toHaveLength(2);
  });

  it("seul un prestataire retenu de l'évènement se place ; un lieu hors catalogue part d'un espace vide", async () => {
    const { organizationId, ownerId } = await organization();
    const venue = await chateau(organizationId);
    const event = await wedding(organizationId, ownerId, venue.vendorId);
    const layoutId = await createEventSpace(organizationId, event.eventId, { name: "Chapiteau", widthCm: 1500, depthCm: 1000 });
    expect((await getLayoutEditor(organizationId, layoutId)).space).toMatchObject({ vendorId: null, sourceSpaceId: null, name: "Chapiteau" });
    await expect(saveLayoutElements(organizationId, layoutId, 0, [dj({ vendorCandidateId: event.pendingId })])).rejects.toMatchObject({ problem: "vendor" });
    await saveLayoutElements(organizationId, layoutId, 0, [dj({ vendorCandidateId: event.karimId, xCm: 700, yCm: 500 })]);
    await expect(saveEventLayoutToVenue(organizationId, layoutId, "Chapiteau")).rejects.toMatchObject({ problem: "no_source" });
  });

  it("« Enregistrer comme configuration du lieu » : une nouvelle configuration, sans les prestataires", async () => {
    const { organizationId, ownerId } = await organization();
    const venue = await chateau(organizationId);
    const event = await wedding(organizationId, ownerId, venue.vendorId);
    const layoutId = await copyVenueLayoutToEvent(organizationId, event.eventId, venue.layoutId);
    const view = await getLayoutEditor(organizationId, layoutId);
    await saveLayoutElements(organizationId, layoutId, view.layout.revision, view.layout.elements.map((element) => ({ ...element, vendorCandidateId: element.typeStarterKey === "dj" ? event.studioId : null })));
    const saved = await saveEventLayoutToVenue(organizationId, layoutId, "Dîner ajusté");
    const back = await getLayoutEditor(organizationId, saved);
    expect(back.space.id).toBe(venue.spaceId);
    expect(back.layout.eventId).toBeNull();
    expect(back.layout.elements.every((element) => element.vendorCandidateId === null)).toBe(true);
    expect(back.layout.elements.find((element) => element.typeStarterKey === "dj")!.fixtureId).toBe(venue.fixtureId);
  });

  it("abus : une configuration d'une autre organisation ne se copie pas ; l'évènement d'une autre non plus", async () => {
    const a = await organization();
    const b = await organization();
    const venueA = await chateau(a.organizationId);
    const venueB = await chateau(b.organizationId);
    const eventB = await wedding(b.organizationId, b.ownerId, venueB.vendorId);
    await expect(copyVenueLayoutToEvent(b.organizationId, eventB.eventId, venueA.layoutId)).rejects.toBeInstanceOf(FloorplanNotFoundError);
    await expect(copyVenueLayoutToEvent(a.organizationId, eventB.eventId, venueA.layoutId)).rejects.toBeInstanceOf(FloorplanNotFoundError);
    await expect(listEventFloorplans(a.organizationId, eventB.eventId)).rejects.toBeInstanceOf(FloorplanNotFoundError);
  });
});

describe("L60-PLA-05 — Partage : versions, prestataires par leur lien, client en lecture, PDF à l'échelle", () => {
  async function shared() {
    const { organizationId, ownerId } = await organization();
    const venue = await chateau(organizationId);
    const event = await wedding(organizationId, ownerId, venue.vendorId);
    const layoutId = await copyVenueLayoutToEvent(organizationId, event.eventId, venue.layoutId);
    const view = await getLayoutEditor(organizationId, layoutId);
    await saveLayoutElements(
      organizationId,
      layoutId,
      view.layout.revision,
      view.layout.elements.map((element) => (element.typeStarterKey === "dj" ? { ...element, vendorCandidateId: event.studioId } : element.name === "Table 1" ? { ...element, vendorCandidateId: event.karimId, note: "Note interne de la planner" } : element)),
    );
    return { organizationId, ownerId, venue, event, layoutId };
  }

  it("rien n'est visible avant la diffusion ; chaque diffusion a son numéro, signalé nouveau puis vu", async () => {
    const { organizationId, ownerId, event, layoutId } = await shared();
    const studioLink = linkOf(organizationId, event.eventId, "vendor", event.studioId);
    expect(await floorplansForLink(studioLink)).toEqual([]);
    expect(await publishEventLayout(organizationId, layoutId, ownerId)).toBe(1);
    const [first] = await floorplansForLink(studioLink);
    expect(first).toMatchObject({ layoutId, version: 1, isNew: true });
    expect((await floorplansForLink(studioLink))[0]!.isNew).toBe(false);
    expect(await publishEventLayout(organizationId, layoutId, ownerId)).toBe(2);
    expect((await floorplansForLink(studioLink, { markSeen: false }))[0]).toMatchObject({ version: 2, isNew: true });
  });

  it("D8 : le prestataire voit son emplacement en évidence ; les autres par leur type, leur nom seulement si la planner le coche", async () => {
    const { organizationId, ownerId, event, layoutId } = await shared();
    await publishEventLayout(organizationId, layoutId, ownerId);
    const [plan] = await floorplansForLink(linkOf(organizationId, event.eventId, "vendor", event.studioId));
    const mine = plan!.elements.filter((element) => element.mine);
    expect(mine).toEqual([expect.objectContaining({ typeStarterKey: "dj", vendorName: "Studio Lumière" })]);
    expect(plan!.elements.find((element) => element.name === "Table 1")!.vendorName).toBeNull();
    expect(JSON.stringify(plan)).not.toContain("Note interne");
    expect(JSON.stringify(plan)).not.toContain("vendorCandidateId");
    expect(plan!.fixtures.some((fixture) => fixture.kind === "delivery")).toBe(true);
    await setShowVendorNames(organizationId, layoutId, true);
    await publishEventLayout(organizationId, layoutId, ownerId);
    const [named] = await floorplansForLink(linkOf(organizationId, event.eventId, "vendor", event.studioId));
    expect(named!.elements.find((element) => element.name === "Table 1")!.vendorName).toBe("Traiteur Karim");
  });

  it("abus : un prestataire non retenu, un lien d'un autre évènement, un lien d'une autre organisation ne voient rien", async () => {
    const { organizationId, ownerId, venue, event, layoutId } = await shared();
    await publishEventLayout(organizationId, layoutId, ownerId);
    expect(await floorplansForLink(linkOf(organizationId, event.eventId, "vendor", event.pendingId))).toEqual([]);
    expect(await floorplansForLink(linkOf(organizationId, event.eventId, "vendor", null))).toEqual([]);
    const other = await wedding(organizationId, ownerId, venue.vendorId);
    expect(await floorplansForLink(linkOf(organizationId, other.eventId, "client"))).toEqual([]);
    await expect(sharedFloorplanBackground(linkOf(organizationId, other.eventId, "client"), layoutId)).rejects.toBeInstanceOf(FloorplanNotFoundError);
    const stranger = await organization();
    expect(await floorplansForLink(linkOf(stranger.organizationId, event.eventId, "client"))).toEqual([]);
    await expect(downloadSharedFloorplanPdf(linkOf(organizationId, other.eventId, "vendor", event.studioId), layoutId, "fr")).rejects.toBeInstanceOf(FloorplanNotFoundError);
  });

  it("le client lit la version diffusée, sans note interne ni emplacement « à lui »", async () => {
    const { organizationId, ownerId, event, layoutId } = await shared();
    await publishEventLayout(organizationId, layoutId, ownerId);
    const [plan] = await floorplansForLink(linkOf(organizationId, event.eventId, "client"));
    expect(plan!.elements.some((element) => element.mine)).toBe(false);
    expect(JSON.stringify(plan)).not.toContain("Note interne");
  });

  it("PDF à l'échelle : un vrai PDF, pour la planner et pour le lien du prestataire", async () => {
    const { organizationId, ownerId, event, layoutId } = await shared();
    const planner = await downloadLayoutPdf(organizationId, layoutId, "fr");
    expect(planner.contentType).toBe("application/pdf");
    expect(new TextDecoder().decode(planner.body.slice(0, 5))).toBe("%PDF-");
    expect(planner.filename).toMatch(/^plan-de-salle-salle-des-fetes-diner-120-en-rondes\.pdf$/);
    await publishEventLayout(organizationId, layoutId, ownerId);
    const vendor = await downloadSharedFloorplanPdf(linkOf(organizationId, event.eventId, "vendor", event.studioId), layoutId, "en");
    expect(new TextDecoder().decode(vendor.body.slice(0, 5))).toBe("%PDF-");
  });

  it("RGPD : les plans d'un évènement sont une fiche rattachée à l'évènement, effacée avec lui", async () => {
    const { organizationId, ownerId, event, layoutId } = await shared();
    await publishEventLayout(organizationId, layoutId, ownerId);
    const related = await floorplansPrivacy.related({ organizationId, eventIds: [event.eventId] });
    expect(related).toEqual([expect.objectContaining({ kind: "event_floorplans", recordId: event.eventId })]);
    expect(await floorplansPrivacy.find({ organizationId, terms: { name: "Studio Lumière" } })).toEqual([]);
    await floorplansPrivacy.erase({ organizationId, records: [{ kind: "event_floorplans", recordId: event.eventId }], rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 }, today: "2027-07-01" });
    expect(await listEventFloorplans(organizationId, event.eventId)).toEqual([]);
    await removeEventFloorplansData(organizationId, [event.eventId]);
  });
});

describe("L60-PLA-04, D7 — Tables copiées une fois vers le plan de table du lot 50", () => {
  it("nom ou numéro, forme et places ; une seconde copie ne recrée pas les tables du même nom", async () => {
    const { organizationId, ownerId } = await organization(["floorplans", "guests"]);
    await confirmImpactAssessment(organizationId, ownerId);
    const venue = await chateau(organizationId);
    const event = await wedding(organizationId, ownerId, venue.vendorId);
    const dinner = await addKeyMoment(organizationId, event.eventId, { name: "Dîner", date: "2027-06-12", startTime: "20:00" });
    const layoutId = await copyVenueLayoutToEvent(organizationId, event.eventId, venue.layoutId);
    const view = await getLayoutEditor(organizationId, layoutId);
    await saveLayoutElements(organizationId, layoutId, view.layout.revision, [...view.layout.elements, table({ typeStarterKey: "head_table", shape: "rect", widthCm: 400, depthCm: 80, seats: 6, xCm: 1000, yCm: 900 }) as FloorplanElement]);
    expect(await copyLayoutTablesToSeating(organizationId, event.eventId, layoutId, dinner.id, (index) => `Table ${index}`)).toEqual({ added: 3, skipped: 0 });
    expect(await copyLayoutTablesToSeating(organizationId, event.eventId, layoutId, dinner.id, (index) => `Table ${index}`)).toEqual({ added: 0, skipped: 3 });
    const plan = await getSeatingPlan(organizationId, event.eventId, dinner.id, { kind: "owner" });
    expect(plan.tables.map((seating) => [seating.name, seating.shape, seating.capacity])).toEqual([
      ["Table 1", "round", 10],
      ["Table 2", "round", 10],
      ["Table 3", "head", 6],
    ]);
    // Abus : le plan d'un autre évènement ne se copie pas dans celui-ci.
    const other = await wedding(organizationId, ownerId, venue.vendorId);
    await expect(copyLayoutTablesToSeating(organizationId, other.eventId, layoutId, dinner.id, (index) => `Table ${index}`)).rejects.toBeInstanceOf(FloorplanNotFoundError);
  });
});
