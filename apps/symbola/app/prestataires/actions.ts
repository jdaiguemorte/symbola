"use server";

// Lot 11 (PRE-01 à PRE-03, PRE-10) — actions du carnet de prestataires.
// Chaque action vérifie session, organisation et module ; entrées validées.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { VENDOR_SOCIAL_NETWORKS } from "@symbola/contracts";
import { addVendorCandidate, VendorCandidateNotFoundError } from "@/modules/events/service";
import {
  addVendorTypeField,
  applyVendorTagTierProposal,
  archiveVendor,
  createVendor,
  createVendorTag,
  createVendorTagGroup,
  getVendor,
  InvalidVendorFieldValueError,
  InvalidVendorLinkError,
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
import { isValidId } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "./module-access";

export type VendorFormState = { error?: string; success?: boolean; notice?: string };

const FIELD_KINDS: VendorFieldKind[] = ["number", "text", "time", "amount", "choice", "boolean"];

async function authorize() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isVendorsModuleEnabled(auth.user.organizationId))) return null;
  return { userId: auth.user.id, organizationId: auth.user.organizationId };
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

async function readVendorInput(organizationId: string, formData: FormData): Promise<VendorInput> {
  const typeId = isValidId(text(formData, "typeId")) ? text(formData, "typeId") : null;
  const type = typeId ? (await listVendorTypes(organizationId)).find((candidate) => candidate.id === typeId) : null;
  const fieldValues: Record<string, VendorFieldValue> = {};
  for (const field of type?.fields ?? []) {
    const raw = field.kind === "boolean" ? (formData.get(`field_${field.id}`) === "on" ? "true" : "") : text(formData, `field_${field.id}`);
    const value = parseFieldInput(field.kind, raw);
    if (value !== null) fieldValues[field.id] = value;
  }
  return {
    name: text(formData, "name"),
    typeId,
    contactName: text(formData, "contactName"),
    email: text(formData, "email"),
    phone: text(formData, "phone"),
    addressLine: text(formData, "addressLine"),
    postalCode: text(formData, "postalCode"),
    city: text(formData, "city"),
    country: text(formData, "country") || "FR",
    internalNote: text(formData, "internalNote"),
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
    if (error instanceof VendorNotFoundError || error instanceof VendorTypeNotFoundError) return { error: t("notFound") };
    throw error;
  }
  revalidatePath("/prestataires");
  const notice = geocodingNotice(t, result);
  if (!isValidId(vendorId)) {
    // Créée depuis un poste : on y revient pour l'ajouter.
    const back = text(formData, "back");
    redirect(back.startsWith("/prestataires?") ? back : `/prestataires/${result.vendor.id}${notice ? `?placement=${result.geocoding}` : ""}`);
  }
  revalidatePath(`/prestataires/${vendorId}`);
  return { success: true, ...(notice ? { notice } : {}) };
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
  revalidatePath("/prestataires");
  // Lot 20 (PRE-17) : depuis le carnet, on y revient avec ses filtres ; seule
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

// PRE-10 — du carnet vers le poste d'un événement.
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

// PRE-02 — types, champs, étiquettes, trajet.

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

// Paliers repérés : rangés dans un groupe « palier » une fois validés.
export async function applyVendorTagTiersAction(formData: FormData): Promise<void> {
  const access = await authorize();
  const unit = text(formData, "unit");
  const label = text(formData, "label").trim() || unit;
  if (!access || !unit) return;
  await applyVendorTagTierProposal(access.organizationId, unit, label);
  revalidatePath(TAGS_PATH);
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
