"use server";

// Lot 16 (PRE-15, ADR 0040) — actions des réglages des types : familles
// (créer, renommer, couleur, pictogramme, ordre, supprimer une famille vide),
// types (renommer, changer de famille, fusionner, supprimer en déplaçant les
// fiches). Session, organisation et module vérifiés côté serveur à chaque
// action ; les entrées sont validées par le service (CLAUDE.md § 5).
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { getPlannerAuthContext } from "@/lib/auth-context";
import {
  createVendorFamily,
  createVendorType,
  listVendorTypes,
  mergeVendorTypes,
  moveVendorFamily,
  removeVendorFamily,
  removeVendorType,
  renameVendorType,
  setVendorTypeFamily,
  updateVendorFamily,
  VendorFamilyNotEmptyError,
  VendorFamilyNotFoundError,
  VendorTypeInUseError,
  VendorTypeNotFoundError,
} from "@/modules/vendors/service";
import { isVendorsModuleEnabled } from "../module-access";

export type TypeSettingsState = { error?: string; success?: boolean };

const SETTINGS = "/prestataires/parametres";
// « aucun » : les fiches du type supprimé passent « à classer » (sans type).
const NO_TYPE = "aucun";

const id = z.string().uuid();
const familyInput = z.object({ label: z.string().max(80), color: z.string(), icon: z.string() });

async function authorize(): Promise<string | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  if (!(await isVendorsModuleEnabled(auth.user.organizationId))) return null;
  return auth.user.organizationId;
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

function refresh() {
  revalidatePath(SETTINGS);
  revalidatePath("/prestataires");
}

export async function saveVendorFamilyAction(_prev: TypeSettingsState, formData: FormData): Promise<TypeSettingsState> {
  const t = await getTranslations("VendorBook");
  const organizationId = await authorize();
  if (!organizationId) return { error: t("unauthorized") };
  const input = familyInput.safeParse({ label: text(formData, "label"), color: text(formData, "color"), icon: text(formData, "icon") });
  if (!input.success) return { error: t("familyInvalid") };
  const familyId = text(formData, "familyId");
  let createdId: string | null = null;
  try {
    if (familyId) {
      if (!id.safeParse(familyId).success) return { error: t("notFound") };
      await updateVendorFamily(organizationId, familyId, input.data);
    } else {
      createdId = (await createVendorFamily(organizationId, input.data)).id;
    }
  } catch (error) {
    if (error instanceof RangeError) return { error: t("familyInvalid") };
    if (error instanceof VendorFamilyNotFoundError) return { error: t("notFound") };
    throw error;
  }
  refresh();
  if (createdId) redirect(`${SETTINGS}?famille=${createdId}`);
  return { success: true };
}

export async function moveVendorFamilyAction(formData: FormData): Promise<void> {
  const organizationId = await authorize();
  const familyId = text(formData, "familyId");
  const direction = text(formData, "direction");
  if (!organizationId || !id.safeParse(familyId).success || (direction !== "up" && direction !== "down")) return;
  try {
    await moveVendorFamily(organizationId, familyId, direction);
  } catch (error) {
    if (!(error instanceof VendorFamilyNotFoundError)) throw error;
  }
  refresh();
}

export async function removeVendorFamilyAction(formData: FormData): Promise<void> {
  const organizationId = await authorize();
  const familyId = text(formData, "familyId");
  if (!organizationId || !id.safeParse(familyId).success) return;
  try {
    await removeVendorFamily(organizationId, familyId);
  } catch (error) {
    if (error instanceof VendorFamilyNotEmptyError) redirect(`${SETTINGS}?famille=${familyId}&erreur=famille-non-vide`);
    if (!(error instanceof VendorFamilyNotFoundError)) throw error;
  }
  refresh();
  redirect(`${SETTINGS}?fait=famille-supprimee`);
}

export async function createVendorTypeInFamilyAction(_prev: TypeSettingsState, formData: FormData): Promise<TypeSettingsState> {
  const t = await getTranslations("VendorBook");
  const organizationId = await authorize();
  if (!organizationId) return { error: t("unauthorized") };
  const familyId = text(formData, "familyId");
  let createdId: string;
  try {
    createdId = (await createVendorType(organizationId, text(formData, "label"), "#78716c", { familyId: id.safeParse(familyId).success ? familyId : null })).id;
  } catch (error) {
    if (error instanceof RangeError) return { error: t("typeInvalid") };
    if (error instanceof VendorFamilyNotFoundError) return { error: t("notFound") };
    throw error;
  }
  refresh();
  redirect(`${SETTINGS}?type=${createdId}`);
}

// Renommer et changer de famille : les fiches gardent leur type et suivent.
export async function saveVendorTypeAction(_prev: TypeSettingsState, formData: FormData): Promise<TypeSettingsState> {
  const t = await getTranslations("VendorBook");
  const organizationId = await authorize();
  if (!organizationId) return { error: t("unauthorized") };
  const typeId = text(formData, "typeId");
  const familyId = text(formData, "familyId");
  if (!id.safeParse(typeId).success || (familyId && !id.safeParse(familyId).success)) return { error: t("notFound") };
  const type = (await listVendorTypes(organizationId)).find((candidate) => candidate.id === typeId);
  if (!type) return { error: t("notFound") };
  try {
    await renameVendorType(organizationId, typeId, text(formData, "label"), type.color);
    await setVendorTypeFamily(organizationId, typeId, familyId || null);
  } catch (error) {
    if (error instanceof RangeError) return { error: t("typeInvalid") };
    if (error instanceof VendorTypeNotFoundError || error instanceof VendorFamilyNotFoundError) return { error: t("notFound") };
    throw error;
  }
  refresh();
  return { success: true };
}

export async function mergeVendorTypesAction(formData: FormData): Promise<void> {
  const organizationId = await authorize();
  const sourceTypeId = text(formData, "typeId");
  const targetTypeId = text(formData, "targetId");
  if (!organizationId || !id.safeParse(sourceTypeId).success || !id.safeParse(targetTypeId).success) return;
  try {
    await mergeVendorTypes(organizationId, { sourceTypeId, targetTypeId });
  } catch (error) {
    if (error instanceof VendorTypeNotFoundError || error instanceof RangeError) redirect(`${SETTINGS}?erreur=type-introuvable`);
    throw error;
  }
  refresh();
  redirect(`${SETTINGS}?type=${targetTypeId}&fait=fusion`);
}

// Un type qui a des fiches n'est supprimé qu'en disant où elles vont.
export async function removeVendorTypeMovingAction(formData: FormData): Promise<void> {
  const organizationId = await authorize();
  const typeId = text(formData, "typeId");
  const moveTo = text(formData, "moveTo");
  if (!organizationId || !id.safeParse(typeId).success) return;
  const moveVendorsTo = moveTo === NO_TYPE ? null : id.safeParse(moveTo).success ? moveTo : undefined;
  try {
    await removeVendorType(organizationId, typeId, moveVendorsTo === undefined ? {} : { moveVendorsTo });
  } catch (error) {
    if (error instanceof VendorTypeInUseError) redirect(`${SETTINGS}?type=${typeId}&erreur=type-utilise`);
    if (error instanceof VendorTypeNotFoundError) redirect(`${SETTINGS}?erreur=type-introuvable`);
    throw error;
  }
  refresh();
  redirect(`${SETTINGS}?fait=type-supprime`);
}
