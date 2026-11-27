"use server";

// Lot 11 (L11-PRE-01 à L11-PRE-03, L11-PRE-10) — actions du carnet de prestataires.
// Chaque action vérifie session, organisation et module ; entrées validées.
import { offerUndo } from "@/lib/undo";
import { unexpectedActionError } from "@/lib/action-errors";
import { discardMyFormDraft } from "@/lib/form-drafts";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { VENDOR_SOCIAL_NETWORKS } from "@symbola/contracts";
import { addVendorCandidate, VendorCandidateNotFoundError } from "@/modules/events/service";
import {
  addVendorTypeField,
  arrangeVendorTags,
  seedStarterVendorTags,
  archiveVendor,
  archiveVendors,
  restoreVendorsTags,
  setVendorsPrimaryType,
  tagVendors,
  unarchiveVendors,
  VENDOR_BULK_MAX,
  type VendorTagsSnapshot,
  type VendorTypeAssignment,
  createVendor,
  createVendorTag,
  createVendorTagGroup,
  getVendor,
  InvalidVendorFieldValueError,
  InvalidVendorLinkError,
  InvalidVendorRatingError,
  listVendorTypes,
  parseFieldInput,
  removeVendorFile,
  removeVendorTag,
  removeVendorTagGroup,
  removeVendorTypeField,
  saveVendorSettings,
  setVendorLocation,
  setVendorTypeFieldFilter,
  updateVendor,
  updateVendorTag,
  updateVendorTagGroup,
  VendorNotFoundError,
  VendorTagGroupNotFoundError,
  VendorTagNotFoundError,
  VendorTagTierConflictError,
  VendorTypeNotFoundError,
  type SaveVendorResult,
  type VendorFieldKind,
  type VendorFieldValue,
  type VendorInput,
} from "@/modules/vendors/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { addStarterVendorCatalog } from "@/lib/vendors/catalog";
import { organizationTagCatalog } from "@/lib/vendors/tag-catalog";
import type { VendorTagArrangement, VendorTagSeedResult } from "@symbola/contracts";
import { isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "./module-access";
import { encodeVendorIds } from "./book-row";

// Lot 63e (ADR 0107) : intent dit ce que la fenêtre fait une fois la rubrique enregistrée (passer à la
// suivante, ou se fermer).
export type VendorFormState = { error?: string; success?: boolean; notice?: string; intent?: "next" | "close" };

const FIELD_KINDS: VendorFieldKind[] = ["number", "text", "time", "amount", "choice", "boolean"];

async function authorize() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isVendorsModuleEnabled(auth.user.organizationId))) return null;
  return { userId: auth.user.id, organizationId: auth.user.organizationId };
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

async function starterLocale(): Promise<"fr" | "en"> {
  return (await getLocale()) === "en" ? "en" : "fr";
}

async function readVendorInput(organizationId: string, formData: FormData): Promise<VendorInput> {
  // Lot 63e (PRE-01 ; ADR 0105) : les métiers cochés et le principal ; les champs de chacun.
  const typeIds = [...new Set(formData.getAll("typeIds").map(String).filter(isValidId))];
  const primaryTypeId = isValidId(text(formData, "primaryTypeId")) && typeIds.includes(text(formData, "primaryTypeId")) ? text(formData, "primaryTypeId") : (typeIds[0] ?? null);
  const types = typeIds.length > 0 ? (await listVendorTypes(organizationId)).filter((candidate) => typeIds.includes(candidate.id)) : [];
  const fieldValues: Record<string, VendorFieldValue> = {};
  for (const field of types.flatMap((type) => type.fields)) {
    const raw = field.kind === "boolean" ? (formData.get(`field_${field.id}`) === "on" ? "true" : "") : text(formData, `field_${field.id}`);
    const value = parseFieldInput(field.kind, raw);
    if (value !== null) fieldValues[field.id] = value;
  }
  return {
    name: text(formData, "name"),
    typeIds,
    primaryTypeId,
    contactName: text(formData, "contactName"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    addressLine: text(formData, "addressLine"),
    postalCode: text(formData, "postalCode"),
    city: text(formData, "city"),
    country: text(formData, "country") || "FR",
    internalNote: text(formData, "internalNote"),
    // Lot 28c (PRE-01) : évaluation de 1 à 5 ; vide = aucune.
    rating: /^[1-5]$/.test(text(formData, "rating")) ? Number(text(formData, "rating")) : null,
    indicativePrices: text(formData, "indicativePrices"),
    website: text(formData, "website"),
    socialLinks: VENDOR_SOCIAL_NETWORKS.map((network) => ({ network, url: text(formData, `social_${network}`) })).filter((link) => link.url !== ""),
    siret: text(formData, "siret"),
    fieldValues,
    // Lot 20 (décision 5) : pastilles cochées, plus le palier choisi de chaque groupe « palier ».
    tagIds: [
      ...formData.getAll("tagIds").map(String),
      ...[...formData.entries()].filter(([key]) => key.startsWith("tagTier-")).map(([, value]) => String(value)),
    ].filter(isValidId),
  };
}

function geocodingNotice(t: Awaited<ReturnType<typeof getTranslations>>, result: SaveVendorResult): string | undefined {
  if (result.geocoding === "placed") return t("geocodingPlaced");
  if (result.geocoding === "not_found") return t("geocodingNotFound");
  return undefined;
}

export async function saveVendorAction(_prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const t = await getTranslations("VendorBook");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  const vendorId = text(formData, "vendorId");
  const input = await readVendorInput(access.organizationId, formData);
  if (!input.name.trim()) return { error: t("nameRequired") };
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email.trim())) return { error: t("invalidEmail") };
  let result: SaveVendorResult;
  try {
    result = isValidId(vendorId) ? await updateVendor(access.organizationId, vendorId, input) : await createVendor(access.organizationId, input);
  } catch (error) {
    if (error instanceof InvalidVendorFieldValueError) return { error: t("invalidFieldValue") };
    if (error instanceof VendorTagTierConflictError) return { error: t("tagTierConflict") };
    if (error instanceof InvalidVendorLinkError) return { error: t(error.field === "siret" ? "invalidSiret" : "invalidWebsite") };
    if (error instanceof InvalidVendorRatingError) return { error: t("invalidRating") };
    if (error instanceof VendorNotFoundError || error instanceof VendorTypeNotFoundError) return { error: t("notFound") };
    return { error: await unexpectedActionError(error) };
  }
  revalidatePath("/prestataires");
  // Lot 39b (UX-09) : la fiche est enregistrée, le brouillon de la saisie n'a plus lieu d'être.
  await discardMyFormDraft(isValidId(vendorId) ? `vendor:${vendorId}` : "vendor-new");
  const notice = geocodingNotice(t, result);
  const intent = text(formData, "intent") === "close" ? "close" : "next";
  if (!isValidId(vendorId)) {
    // Créée depuis un poste : on y revient pour l'ajouter.
    const back = text(formData, "back");
    if (back.startsWith("/prestataires?")) redirect(back);
    // Lot 63e (ADR 0107) : créée à la première rubrique, la fiche s'ouvre dans sa fenêtre, à la
    // rubrique suivante ; « Créer » à la dernière mène à la fiche.
    const next = text(formData, "nextRubric");
    const params = new URLSearchParams();
    if (notice) params.set("placement", result.geocoding);
    if (intent === "next" && /^[a-z]{1,20}$/.test(next)) {
      params.set("modifier", "1");
      params.set("rubrique", next);
    }
    const query = params.toString();
    redirect(`/prestataires/${result.vendor.id}${query ? `?${query}` : ""}`);
  }
  revalidatePath(`/prestataires/${vendorId}`);
  return { success: true, intent, ...(notice ? { notice } : {}) };
}

export async function setVendorLocationAction(_prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const t = await getTranslations("VendorBook");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  const vendorId = text(formData, "vendorId");
  const latitude = Number(text(formData, "latitude").replace(",", "."));
  const longitude = Number(text(formData, "longitude").replace(",", "."));
  if (!isValidId(vendorId)) return { error: t("notFound") };
  try {
    await setVendorLocation(access.organizationId, vendorId, latitude, longitude);
  } catch (error) {
    if (error instanceof RangeError) return { error: t("invalidPoint") };
    if (error instanceof VendorNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(`/prestataires/${vendorId}`);
  return { success: true };
}

export async function archiveVendorAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const vendorId = text(formData, "vendorId");
  if (!access || !isValidId(vendorId)) return;
  await archiveVendor(access.organizationId, vendorId);
  await offerUndo({ kind: "vendor", id: vendorId });
  revalidatePath("/prestataires");
  // Lot 20 (L20-PRE-17) : depuis le carnet, on y revient avec ses filtres ; seule
  // une adresse du carnet est acceptée (jamais une autre origine).
  const back = text(formData, "back");
  redirect(/^\/prestataires(\?[^\s]*)?$/.test(back) ? back : "/prestataires");
}

export async function removeVendorFileAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const vendorId = text(formData, "vendorId");
  const fileId = text(formData, "fileId");
  if (!access || !isValidId(vendorId) || !isValidId(fileId)) return;
  await removeVendorFile(access.organizationId, fileId);
  revalidatePath(`/prestataires/${vendorId}`);
}

// L11-PRE-10 — du carnet vers le poste d'un événement.
export async function addVendorToSlotAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const vendorId = text(formData, "vendorId");
  const eventId = text(formData, "eventId");
  const slotId = text(formData, "slotId");
  if (!access || ![vendorId, eventId, slotId].every(isValidId)) return;
  const vendor = await getVendor(access.organizationId, vendorId);
  if (!vendor) return;
  try {
    await addVendorCandidate({ organizationId: access.organizationId, eventId, vendorSlotId: slotId, vendorName: vendor.name, vendorId: vendor.id });
  } catch (error) {
    if (!(error instanceof VendorCandidateNotFoundError)) throw error;
    return;
  }
  revalidatePath(`/events/${eventId}`);
  redirect(`/events/${eventId}?onglet=budget&poste=${slotId}`);
}

// L11-PRE-02 — types, champs, étiquettes, trajet.

export async function addStarterVendorTypesAction(): Promise<void> {
  const access = await authorize();
  if (!access) return;
  await addStarterVendorCatalog(access.organizationId, (await getLocale()) === "en" ? "en" : "fr");
  revalidatePath("/prestataires/parametres");
}

export async function addVendorFieldAction(_prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const t = await getTranslations("VendorBook");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  const typeId = text(formData, "typeId");
  const kind = text(formData, "kind") as VendorFieldKind;
  if (!isValidId(typeId) || !FIELD_KINDS.includes(kind)) return { error: t("fieldInvalid") };
  try {
    await addVendorTypeField(access.organizationId, typeId, {
      label: text(formData, "label"),
      kind,
      choices: text(formData, "choices").split(/[\n;]/),
      isFilter: formData.get("isFilter") === "on",
    });
  } catch (error) {
    if (error instanceof RangeError) return { error: kind === "choice" ? t("choicesRequired") : t("fieldInvalid") };
    if (error instanceof VendorTypeNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath("/prestataires/parametres");
  return { success: true };
}

export async function toggleVendorFieldFilterAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const fieldId = text(formData, "fieldId");
  if (!access || !isValidId(fieldId)) return;
  await setVendorTypeFieldFilter(access.organizationId, fieldId, text(formData, "isFilter") === "true");
  revalidatePath("/prestataires/parametres");
}

export async function removeVendorFieldAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const fieldId = text(formData, "fieldId");
  if (!access || !isValidId(fieldId)) return;
  await removeVendorTypeField(access.organizationId, fieldId);
  revalidatePath("/prestataires/parametres");
}

// Lot 20 (décision 5, ADR 0049) — groupe (vide = « Autres ») et familles
// cochées (aucune = toutes) d'une étiquette.
function tagPlacement(formData: FormData): { groupId: string | null; familyIds: string[] } {
  const groupId = text(formData, "groupId");
  return { groupId: isValidId(groupId) ? groupId : null, familyIds: formData.getAll("familyIds").map(String).filter(isValidId) };
}

const TAGS_PATH = "/prestataires/parametres/etiquettes";

export async function createVendorTagAction(_prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const t = await getTranslations("VendorBook");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  if (!text(formData, "label").trim()) return { error: t("tagRequired") };
  try {
    await createVendorTag(access.organizationId, text(formData, "label"), tagPlacement(formData));
  } catch (error) {
    if (error instanceof VendorTagGroupNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(TAGS_PATH);
  return { success: true };
}

export async function updateVendorTagAction(_prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const t = await getTranslations("VendorBook");
  const access = await authorize();
  const tagId = text(formData, "tagId");
  if (!access || !isValidId(tagId)) return { error: t("unauthorized") };
  if (!text(formData, "label").trim()) return { error: t("tagRequired") };
  try {
    await updateVendorTag(access.organizationId, tagId, { label: text(formData, "label"), ...tagPlacement(formData) });
  } catch (error) {
    if (error instanceof VendorTagNotFoundError || error instanceof VendorTagGroupNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(TAGS_PATH);
  redirect(TAGS_PATH);
}

export async function createVendorTagGroupAction(_prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const t = await getTranslations("VendorBook");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  if (!text(formData, "label").trim()) return { error: t("tagGroupRequired") };
  await createVendorTagGroup(access.organizationId, { label: text(formData, "label"), exclusive: formData.get("exclusive") === "on" });
  revalidatePath(TAGS_PATH);
  return { success: true };
}

export async function updateVendorTagGroupAction(_prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const t = await getTranslations("VendorBook");
  const access = await authorize();
  const groupId = text(formData, "groupId");
  if (!access || !isValidId(groupId)) return { error: t("unauthorized") };
  if (!text(formData, "label").trim()) return { error: t("tagGroupRequired") };
  try {
    await updateVendorTagGroup(access.organizationId, groupId, { label: text(formData, "label"), exclusive: formData.get("exclusive") === "on" });
  } catch (error) {
    if (error instanceof VendorTagGroupNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath(TAGS_PATH);
  return { success: true };
}

export async function removeVendorTagGroupAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const groupId = text(formData, "groupId");
  if (!access || !isValidId(groupId)) return;
  await removeVendorTagGroup(access.organizationId, groupId);
  revalidatePath(TAGS_PATH);
}

// Lot 21 (L21-PRE-19, ADR 0050) : « Ranger mes étiquettes importées », puis le
// récapitulatif de ce qui a été rangé.
export type TagSetupState = { error?: string; arrangement?: VendorTagArrangement; added?: VendorTagSeedResult };

export async function arrangeVendorTagsAction(_prevState: TagSetupState, _formData: FormData): Promise<TagSetupState> {
  const t = await getTranslations("VendorBook");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  const arrangement = await arrangeVendorTags(access.organizationId, await organizationTagCatalog(access.organizationId, await starterLocale()));
  revalidatePath(TAGS_PATH);
  return { arrangement };
}

// Lot 21 (L21-PRE-18) : « Ajouter les étiquettes proposées », sans doublon.
export async function addStarterVendorTagsAction(_prevState: TagSetupState, _formData: FormData): Promise<TagSetupState> {
  const t = await getTranslations("VendorBook");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  const added = await seedStarterVendorTags(access.organizationId, await organizationTagCatalog(access.organizationId, await starterLocale()));
  revalidatePath(TAGS_PATH);
  return { added };
}

export async function removeVendorTagAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const tagId = text(formData, "tagId");
  if (!access || !isValidId(tagId)) return;
  await removeVendorTag(access.organizationId, tagId);
  revalidatePath(TAGS_PATH);
}

export async function saveTravelSettingsAction(_prev: VendorFormState, formData: FormData): Promise<VendorFormState> {
  const t = await getTranslations("VendorBook");
  const access = await authorize();
  if (!access) return { error: t("unauthorized") };
  const detour = Number(text(formData, "detour").replace(",", "."));
  const speed = Number(text(formData, "speed"));
  try {
    await saveVendorSettings(access.organizationId, { detourFactorPermille: Math.round(detour * 1000), averageSpeedKmh: Math.round(speed) });
  } catch (error) {
    if (error instanceof RangeError) return { error: t("travelInvalid") };
    throw error;
  }
  revalidatePath("/prestataires/parametres/trajet");
  return { success: true };
}

// Lot 73b (PRE-01, UX-07, UX-15 ; spécification du lot 73, § 4.5 et § 5.2, critères 7 et 9) — les actions
// en lot du carnet : « Ajouter une étiquette… », « Archiver… », et l'enregistrement de l'écran « Classer ».
// Session, organisation, module à chaque appel ; identifiants validés, puis revérifiés par le service dans
// l'organisation : un seul identifiant d'ailleurs fait tout refuser, par le message « inexistant ».
// Chacune dit combien de fiches elle a touchées ; l'étiquette et l'archivage s'annulent (dix secondes) par
// les valeurs d'avant, rendues au navigateur (des identifiants, aucun nom) et revérifiées ici.
export type VendorBulkResult = { ok: boolean; count?: number; message?: string; error?: string; previous?: VendorTagsSnapshot; archivedIds?: string[]; classifiedIds?: string[]; reviewCode?: string };

const bulkIdsSchema = z.array(z.uuid()).min(1).max(VENDOR_BULK_MAX);
const snapshotSchema = z.array(z.object({ id: z.uuid(), tagIds: z.array(z.uuid()).max(200) })).min(1).max(VENDOR_BULK_MAX);
const assignmentsSchema = z.array(z.object({ vendorId: z.uuid(), typeId: z.uuid(), replaces: z.uuid().nullable().optional() })).min(1).max(VENDOR_BULK_MAX);

async function bulk<T>(run: (organizationId: string, t: Awaited<ReturnType<typeof getTranslations<"VendorBook">>>) => Promise<VendorBulkResult>, parsed: { success: boolean; data?: T }): Promise<VendorBulkResult> {
  const t = await getTranslations("VendorBook");
  const access = await authorize();
  if (!access) return { ok: false, error: t("unauthorized") };
  if (!parsed.success) return { ok: false, error: t("bulk.notFound") };
  try {
    const result = await run(access.organizationId, t);
    revalidatePath("/prestataires");
    return result;
  } catch (error) {
    if (error instanceof VendorNotFoundError || error instanceof VendorTagNotFoundError || error instanceof VendorTypeNotFoundError) return { ok: false, error: t("bulk.notFound") };
    throw error;
  }
}

export async function tagVendorsAction(vendorIds: string[], tagId: string): Promise<VendorBulkResult> {
  const parsed = z.object({ ids: bulkIdsSchema, tagId: z.uuid() }).safeParse({ ids: vendorIds, tagId });
  return bulk(async (organizationId, t) => {
    const { changed, previous } = await tagVendors(organizationId, parsed.data!.ids, parsed.data!.tagId);
    return { ok: true, count: changed, previous, message: t("bulk.tagged", { count: changed }) };
  }, parsed);
}

export async function restoreVendorsTagsAction(previous: VendorTagsSnapshot): Promise<VendorBulkResult> {
  const parsed = snapshotSchema.safeParse(previous);
  return bulk(async (organizationId, t) => {
    const count = await restoreVendorsTags(organizationId, parsed.data!);
    return { ok: true, count, message: t("bulk.undone", { count }) };
  }, parsed);
}

export async function archiveVendorsAction(vendorIds: string[]): Promise<VendorBulkResult> {
  const parsed = bulkIdsSchema.safeParse(vendorIds);
  return bulk(async (organizationId, t) => {
    const archivedIds = await archiveVendors(organizationId, parsed.data!);
    return { ok: true, count: archivedIds.length, archivedIds, message: t("bulk.archived", { count: archivedIds.length }) };
  }, parsed);
}

export async function unarchiveVendorsAction(vendorIds: string[]): Promise<VendorBulkResult> {
  const parsed = bulkIdsSchema.safeParse(vendorIds);
  return bulk(async (organizationId, t) => {
    const count = await unarchiveVendors(organizationId, parsed.data!);
    return { ok: true, count, message: t("bulk.undone", { count }) };
  }, parsed);
}

// L'écran « Classer » : rien n'est enregistré avant ce geste ; il rend les fiches classées, que « Revoir »
// rouvre (P13).
export async function classifyVendorsAction(assignments: VendorTypeAssignment[]): Promise<VendorBulkResult> {
  const parsed = assignmentsSchema.safeParse(assignments);
  return bulk(async (organizationId, t) => {
    const changed = await setVendorsPrimaryType(organizationId, parsed.data!);
    const classifiedIds = parsed.data!.map((assignment) => assignment.vendorId);
    return { ok: true, count: classifiedIds.length, classifiedIds, reviewCode: encodeVendorIds(classifiedIds), message: t("classify.done", { count: changed.length }) };
  }, parsed);
}
