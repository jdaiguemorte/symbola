"use server";

// Lot 60 (L60-PLA-01 à L60-PLA-05) — actions des plans de salle. Chaque action relit la session,
// l'organisation, le module Plans de salle et celui dont dépend l'objet (carnet pour un lieu,
// évènements pour un plan d'évènement, que la Planner doit pouvoir voir) ; les entrées sont validées
// par Zod ; le service relit l'objet dans l'organisation (RLS). Une erreur revient à la page par
// l'adresse (?erreur=…), sans donnée ; elle ne révèle jamais l'existence d'un objet d'ailleurs.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  addElementType,
  calibrateSpace,
  copyLayoutTablesToSeating,
  copyVenueLayoutToEvent,
  createEventSpace,
  createLayout,
  createVenueSpace,
  duplicateLayout,
  FloorplanInvalidError,
  FloorplanNotFoundError,
  FloorplanStaleError,
  getSpace,
  layoutBelongsTo,
  publishEventLayout,
  removeFloorplanLayout,
  removeFloorplanSpace,
  removeSpaceBackground,
  renameLayout,
  saveEventLayoutToVenue,
  saveFixtures,
  saveLayoutElements,
  setElementTypeHidden,
  setShowVendorNames,
  setSpaceBackground,
  updateElementType,
  updateSpace,
} from "@/modules/floorplans/service";
import { SeatingInvalidError, SeatingNotFoundError, GuestsNotReadyError } from "@/modules/guests/service";
import { isGuestsAvailable } from "@/app/events/[id]/invites/access";
import { canSeeFloorplanEvent, floorplansAccess, layoutAccess, type FloorplansAccess } from "./access";

const id = z.uuid();
const meters = z.coerce.number().min(0.01).max(1000).transform((value) => Math.round(value * 100));
const name = z.string().trim().min(1).max(80);

function errorKey(error: unknown): string {
  if (error instanceof FloorplanStaleError) return "stale";
  if (error instanceof FloorplanInvalidError) return error.problem;
  if (error instanceof SeatingInvalidError) return `seating_${error.problem}`;
  if (error instanceof GuestsNotReadyError) return "guests_not_ready";
  if (error instanceof FloorplanNotFoundError || error instanceof SeatingNotFoundError) return "not_found";
  throw error;
}

function back(path: string, query: Record<string, string>): never {
  redirect(`${path}?${new URLSearchParams(query).toString()}`);
}

// Espace et le module dont il dépend (lieu : carnet ; évènement : évènements et visibilité).
async function spaceAccess(spaceId: string): Promise<{ access: FloorplansAccess; vendorId: string | null; eventId: string | null } | null> {
  if (!id.safeParse(spaceId).success) return null;
  const venue = await floorplansAccess("vendors");
  const event = await floorplansAccess("events");
  const access = venue ?? event;
  if (!access) return null;
  const found = await getSpace(access.organizationId, spaceId);
  if (!found) return null;
  if (found.space.eventId) {
    if (!event || !(await canSeeFloorplanEvent(event, found.space.eventId))) return null;
    return { access: event, vendorId: found.space.vendorId, eventId: found.space.eventId };
  }
  if (!venue) return null;
  return { access: venue, vendorId: found.space.vendorId, eventId: null };
}

function spacePath(target: { vendorId: string | null; eventId: string | null }, spaceId: string): string {
  return target.eventId ? `/events/${target.eventId}/plan-de-salle/espaces/${spaceId}` : `/prestataires/${target.vendorId}/plans/${spaceId}`;
}

// —— Éditeur (appelé par le composant client, avec le contenu en JSON) ———————————————————————————

export type EditorSaveResult = { ok: true; revision: number } | { ok: false; error: string };

export async function saveElementsAction(layoutId: string, revision: number, json: string): Promise<EditorSaveResult> {
  const t = await getTranslations("Floorplans.errors");
  const access = id.safeParse(layoutId).success ? await layoutAccess(layoutId) : null;
  if (!access) return { ok: false, error: t("not_found") };
  let elements: unknown;
  try {
    elements = JSON.parse(json);
  } catch {
    return { ok: false, error: t("elements") };
  }
  if (!Array.isArray(elements) || !z.number().int().min(0).safeParse(revision).success) return { ok: false, error: t("elements") };
  // Un identifiant créé dans l'éditeur (« new-… ») devient un nouvel élément.
  const input = elements.map((element) => (element && typeof element === "object" && "id" in element && typeof element.id === "string" && !id.safeParse(element.id).success ? { ...element, id: null } : element));
  try {
    const next = await saveLayoutElements(access.organizationId, layoutId, revision, input);
    revalidatePath(`/plans-de-salle/${layoutId}`);
    return { ok: true, revision: next };
  } catch (error) {
    return { ok: false, error: t(errorKey(error)) };
  }
}

export async function saveFixturesAction(spaceId: string, json: string): Promise<EditorSaveResult> {
  const t = await getTranslations("Floorplans.errors");
  const target = await spaceAccess(spaceId);
  if (!target) return { ok: false, error: t("not_found") };
  let fixtures: unknown;
  try {
    fixtures = JSON.parse(json);
  } catch {
    return { ok: false, error: t("fixtures") };
  }
  if (!Array.isArray(fixtures)) return { ok: false, error: t("fixtures") };
  const input = fixtures.map((fixture) => (fixture && typeof fixture === "object" && "id" in fixture && typeof fixture.id === "string" && !id.safeParse(fixture.id).success ? { ...fixture, id: null } : fixture));
  try {
    await saveFixtures(target.access.organizationId, spaceId, input);
    revalidatePath(spacePath(target, spaceId));
    return { ok: true, revision: 0 };
  } catch (error) {
    return { ok: false, error: t(errorKey(error)) };
  }
}

// —— Espaces d'un lieu du catalogue (partie A) ———————————————————————————————————————————————————

const spaceForm = z.object({ name, width: meters, depth: meters });

export async function createVenueSpaceAction(formData: FormData): Promise<void> {
  const vendorId = String(formData.get("vendorId") ?? "");
  const access = await floorplansAccess("vendors");
  if (!access || !id.safeParse(vendorId).success) redirect("/prestataires");
  const path = `/prestataires/${vendorId}/plans`;
  const parsed = spaceForm.safeParse({ name: formData.get("name"), width: formData.get("width"), depth: formData.get("depth") });
  if (!parsed.success) back(path, { erreur: "size" });
  let spaceId: string;
  try {
    spaceId = await createVenueSpace(access.organizationId, vendorId, { name: parsed.data.name, widthCm: parsed.data.width, depthCm: parsed.data.depth });
  } catch (error) {
    back(path, { erreur: errorKey(error) });
  }
  revalidatePath(path);
  redirect(`${path}/${spaceId}`);
}

export async function updateSpaceAction(formData: FormData): Promise<void> {
  const spaceId = String(formData.get("spaceId") ?? "");
  const target = await spaceAccess(spaceId);
  if (!target) redirect("/prestataires");
  const path = spacePath(target, spaceId);
  const parsed = spaceForm.safeParse({ name: formData.get("name"), width: formData.get("width"), depth: formData.get("depth") });
  if (!parsed.success) back(path, { erreur: "size" });
  try {
    await updateSpace(target.access.organizationId, spaceId, { name: parsed.data.name, widthCm: parsed.data.width, depthCm: parsed.data.depth });
  } catch (error) {
    back(path, { erreur: errorKey(error) });
  }
  revalidatePath(path);
  back(path, { ok: "space" });
}

export async function removeSpaceAction(formData: FormData): Promise<void> {
  const spaceId = String(formData.get("spaceId") ?? "");
  const target = await spaceAccess(spaceId);
  if (!target) redirect("/prestataires");
  await removeFloorplanSpace(target.access.organizationId, spaceId).catch((error: unknown) => {
    if (!(error instanceof FloorplanNotFoundError)) throw error;
  });
  const path = target.eventId ? `/events/${target.eventId}/plan-de-salle` : `/prestataires/${target.vendorId}/plans`;
  revalidatePath(path);
  back(path, { ok: "removed" });
}

export async function uploadBackgroundAction(formData: FormData): Promise<void> {
  const spaceId = String(formData.get("spaceId") ?? "");
  const target = await spaceAccess(spaceId);
  if (!target) redirect("/prestataires");
  const path = spacePath(target, spaceId);
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) back(path, { erreur: "background_type" });
  try {
    await setSpaceBackground(target.access.organizationId, spaceId, new Uint8Array(await file.arrayBuffer()));
  } catch (error) {
    back(path, { erreur: errorKey(error) });
  }
  revalidatePath(path);
  back(path, { ok: "background" });
}

export async function removeBackgroundAction(formData: FormData): Promise<void> {
  const spaceId = String(formData.get("spaceId") ?? "");
  const target = await spaceAccess(spaceId);
  if (!target) redirect("/prestataires");
  const path = spacePath(target, spaceId);
  await removeSpaceBackground(target.access.organizationId, spaceId);
  revalidatePath(path);
  back(path, { ok: "background_removed" });
}

const calibrationForm = z.object({
  ax: z.coerce.number().int().min(0),
  ay: z.coerce.number().int().min(0),
  bx: z.coerce.number().int().min(0),
  by: z.coerce.number().int().min(0),
  distance: meters,
  fit: z.literal("on").optional(),
});

export async function calibrateAction(formData: FormData): Promise<void> {
  const spaceId = String(formData.get("spaceId") ?? "");
  const target = await spaceAccess(spaceId);
  if (!target) redirect("/prestataires");
  const path = spacePath(target, spaceId);
  const parsed = calibrationForm.safeParse({ ax: formData.get("ax"), ay: formData.get("ay"), bx: formData.get("bx"), by: formData.get("by"), distance: formData.get("distance"), fit: formData.get("fit") ?? undefined });
  if (!parsed.success) back(path, { erreur: "calibration" });
  try {
    const { ax, ay, bx, by, distance, fit } = parsed.data;
    await calibrateSpace(target.access.organizationId, spaceId, { ax, ay, bx, by, distanceCm: distance }, fit === "on");
  } catch (error) {
    back(path, { erreur: errorKey(error) });
  }
  revalidatePath(path);
  back(path, { ok: "calibrated" });
}

// —— Configurations et plans (parties A, B, D) ———————————————————————————————————————————————————

export async function createLayoutAction(formData: FormData): Promise<void> {
  const spaceId = String(formData.get("spaceId") ?? "");
  const target = await spaceAccess(spaceId);
  if (!target) redirect("/prestataires");
  const parsed = name.safeParse(formData.get("name"));
  const listPath = target.eventId ? `/events/${target.eventId}/plan-de-salle` : `/prestataires/${target.vendorId}/plans`;
  if (!parsed.success) back(listPath, { erreur: "name" });
  const layoutId = await createLayout(target.access.organizationId, spaceId, parsed.data);
  revalidatePath(listPath);
  redirect(`/plans-de-salle/${layoutId}`);
}

async function layoutTarget(formData: FormData) {
  const layoutId = String(formData.get("layoutId") ?? "");
  const access = id.safeParse(layoutId).success ? await layoutAccess(layoutId) : null;
  if (!access) redirect("/prestataires");
  return { layoutId, access, path: `/plans-de-salle/${layoutId}` };
}

export async function renameLayoutAction(formData: FormData): Promise<void> {
  const { layoutId, access, path } = await layoutTarget(formData);
  const parsed = name.safeParse(formData.get("name"));
  if (!parsed.success) back(path, { erreur: "name" });
  await renameLayout(access.organizationId, layoutId, parsed.data);
  revalidatePath(path);
  back(path, { ok: "renamed" });
}

export async function duplicateLayoutAction(formData: FormData): Promise<void> {
  const { layoutId, access, path } = await layoutTarget(formData);
  const parsed = name.safeParse(formData.get("name"));
  if (!parsed.success) back(path, { erreur: "name" });
  const copy = await duplicateLayout(access.organizationId, layoutId, parsed.data);
  redirect(`/plans-de-salle/${copy}`);
}

export async function removeLayoutAction(formData: FormData): Promise<void> {
  const { layoutId, access } = await layoutTarget(formData);
  const returnTo = String(formData.get("returnTo") ?? "");
  await removeFloorplanLayout(access.organizationId, layoutId);
  const safe = /^\/(prestataires|events)\/[0-9a-f-]{36}\/(plans|plan-de-salle)$/.test(returnTo) ? returnTo : "/prestataires";
  revalidatePath(safe);
  back(safe, { ok: "removed" });
}

export async function publishLayoutAction(formData: FormData): Promise<void> {
  const { layoutId, access, path } = await layoutTarget(formData);
  try {
    await publishEventLayout(access.organizationId, layoutId, access.userId);
  } catch (error) {
    back(path, { erreur: errorKey(error) });
  }
  revalidatePath(path);
  if (access.eventId) revalidatePath(`/events/${access.eventId}/plan-de-salle`);
  back(path, { ok: "published" });
}

export async function showVendorNamesAction(formData: FormData): Promise<void> {
  const { layoutId, access, path } = await layoutTarget(formData);
  try {
    await setShowVendorNames(access.organizationId, layoutId, formData.get("show") === "on");
  } catch (error) {
    back(path, { erreur: errorKey(error) });
  }
  revalidatePath(path);
  back(path, { ok: "names" });
}

export async function saveToVenueAction(formData: FormData): Promise<void> {
  const { layoutId, access, path } = await layoutTarget(formData);
  const parsed = name.safeParse(formData.get("name"));
  if (!parsed.success) back(path, { erreur: "name" });
  let copy: string;
  try {
    copy = await saveEventLayoutToVenue(access.organizationId, layoutId, parsed.data);
  } catch (error) {
    back(path, { erreur: errorKey(error) });
  }
  redirect(`/plans-de-salle/${copy}?ok=saved_to_venue`);
}

// —— Plan de l'évènement (partie D) ——————————————————————————————————————————————————————————————

async function eventTarget(formData: FormData) {
  const eventId = String(formData.get("eventId") ?? "");
  const access = await floorplansAccess("events");
  if (!access || !id.safeParse(eventId).success || !(await canSeeFloorplanEvent(access, eventId))) redirect("/events");
  return { eventId, access, path: `/events/${eventId}/plan-de-salle` };
}

export async function copyVenueLayoutAction(formData: FormData): Promise<void> {
  const { eventId, access, path } = await eventTarget(formData);
  const layoutId = String(formData.get("layoutId") ?? "");
  const placeId = String(formData.get("placeId") ?? "");
  if (!id.safeParse(layoutId).success) back(path, { erreur: "no_source" });
  let copy: string;
  try {
    copy = await copyVenueLayoutToEvent(access.organizationId, eventId, layoutId, id.safeParse(placeId).success ? placeId : null);
  } catch (error) {
    back(path, { erreur: errorKey(error) });
  }
  revalidatePath(path);
  redirect(`/plans-de-salle/${copy}`);
}

export async function createEventSpaceAction(formData: FormData): Promise<void> {
  const { eventId, access, path } = await eventTarget(formData);
  const parsed = spaceForm.safeParse({ name: formData.get("name"), width: formData.get("width"), depth: formData.get("depth") });
  if (!parsed.success) back(path, { erreur: "size" });
  const placeId = String(formData.get("placeId") ?? "");
  let layoutId: string;
  try {
    layoutId = await createEventSpace(access.organizationId, eventId, { name: parsed.data.name, widthCm: parsed.data.width, depthCm: parsed.data.depth }, id.safeParse(placeId).success ? placeId : null);
  } catch (error) {
    back(path, { erreur: errorKey(error) });
  }
  revalidatePath(path);
  redirect(`/plans-de-salle/${layoutId}`);
}

// D7 : les tables du plan de salle copiées une fois dans le plan de table d'un temps fort.
export async function copyTablesToSeatingAction(formData: FormData): Promise<void> {
  const { layoutId, access, path } = await layoutTarget(formData);
  const keyMomentId = String(formData.get("keyMomentId") ?? "");
  if (!access.eventId || !id.safeParse(keyMomentId).success || !(await isGuestsAvailable(access.organizationId))) back(path, { erreur: "not_found" });
  if (!(await layoutBelongsTo(access.organizationId, layoutId, access.eventId))) back(path, { erreur: "not_found" });
  const t = await getTranslations("Floorplans.editor");
  let result: { added: number; skipped: number };
  try {
    result = await copyLayoutTablesToSeating(access.organizationId, access.eventId, layoutId, keyMomentId, (index) => t("defaultTableName", { index }));
  } catch (error) {
    back(path, { erreur: errorKey(error) });
  }
  revalidatePath(`/events/${access.eventId}/invites/plan`);
  back(path, { ok: "tables", ajoutees: String(result.added), ignorees: String(result.skipped) });
}

// —— Bibliothèque d'éléments (partie B) ——————————————————————————————————————————————————————————

const typeForm = z.object({
  label: z.string().trim().min(1).max(60),
  category: z.enum(["table", "setup"]),
  shape: z.enum(["circle", "rect", "ellipse"]),
  seatRule: z.enum(["round", "two_sides", "one_side", "four_sides", "oval", "none"]),
  width: meters,
  depth: meters,
  powerOutlets: z.coerce.number().int().min(0).max(20),
  powerAmps: z.union([z.literal(""), z.coerce.number().int().min(1).max(125)]),
  needsWater: z.literal("on").optional(),
});

async function libraryAccess(): Promise<FloorplansAccess> {
  const access = (await floorplansAccess("vendors")) ?? (await floorplansAccess("events"));
  if (!access) redirect("/");
  return access;
}

function parseType(formData: FormData) {
  return typeForm.safeParse({
    label: formData.get("label"),
    category: formData.get("category"),
    shape: formData.get("shape"),
    seatRule: formData.get("seatRule"),
    width: formData.get("width"),
    depth: formData.get("depth"),
    powerOutlets: formData.get("powerOutlets") ?? 0,
    powerAmps: formData.get("powerAmps") ?? "",
    needsWater: formData.get("needsWater") ?? undefined,
  });
}

const LIBRARY = "/plans-de-salle/bibliotheque";

export async function addElementTypeAction(formData: FormData): Promise<void> {
  const access = await libraryAccess();
  const parsed = parseType(formData);
  if (!parsed.success) back(LIBRARY, { erreur: "element_type" });
  const value = parsed.data;
  await addElementType(access.organizationId, { label: value.label, category: value.category, shape: value.shape, seatRule: value.seatRule, widthCm: value.width, depthCm: value.depth, powerOutlets: value.powerOutlets, powerAmps: value.powerAmps === "" ? null : value.powerAmps, needsWater: value.needsWater === "on" });
  revalidatePath(LIBRARY);
  back(LIBRARY, { ok: "type_added" });
}

export async function updateElementTypeAction(formData: FormData): Promise<void> {
  const access = await libraryAccess();
  const typeId = String(formData.get("typeId") ?? "");
  const parsed = parseType(formData);
  if (!parsed.success || !id.safeParse(typeId).success) back(LIBRARY, { erreur: "element_type" });
  const value = parsed.data;
  try {
    await updateElementType(access.organizationId, typeId, { label: value.label, category: value.category, shape: value.shape, seatRule: value.seatRule, widthCm: value.width, depthCm: value.depth, powerOutlets: value.powerOutlets, powerAmps: value.powerAmps === "" ? null : value.powerAmps, needsWater: value.needsWater === "on" });
  } catch (error) {
    back(LIBRARY, { erreur: errorKey(error) });
  }
  revalidatePath(LIBRARY);
  back(LIBRARY, { ok: "type_saved" });
}

export async function hideElementTypeAction(formData: FormData): Promise<void> {
  const access = await libraryAccess();
  const typeId = String(formData.get("typeId") ?? "");
  if (!id.safeParse(typeId).success) back(LIBRARY, { erreur: "not_found" });
  try {
    await setElementTypeHidden(access.organizationId, typeId, formData.get("hidden") === "true");
  } catch (error) {
    back(LIBRARY, { erreur: errorKey(error) });
  }
  revalidatePath(LIBRARY);
  back(LIBRARY, { ok: "type_saved" });
}
