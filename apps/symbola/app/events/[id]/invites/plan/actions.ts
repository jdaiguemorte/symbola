"use server";

// Lot 50 (INV-05, INV-06 ; D1 à D5, D9) — actions du plan de table : créer le plan d'un temps fort,
// tables (en série, modifier, supprimer, copier un plan), placer un invité ou un foyer, désistements,
// contraintes, type de repas d'un invité, repas des prestataires. Chaque action relit la session,
// l'organisation et les modules (guestsAccess : la titulaire et les membres, jamais le client) ;
// les entrées sont validées par Zod ; le service relit l'évènement dans l'organisation (RLS).
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { SEATING_CONSTRAINT_KINDS, SEATING_SHAPES } from "@symbola/contracts";
import {
  addSeatingConstraint,
  addSeatingTables,
  copySeatingPlan,
  createSeatingPlan,
  dismissSeatRelease,
  removeSeatingConstraint,
  removeSeatingTable,
  seatGuest,
  seatHousehold,
  SeatingInvalidError,
  setGuestMealType,
  setVendorMealCount,
  updateSeatingTable,
} from "@/modules/guests/service";
import { guestsAccess } from "../access";
import { guestErrorKey } from "../form-schemas";

export type PlanFormState = { error?: string; success?: string };

const id = z.uuid();
const optionalId = z.union([z.uuid(), z.literal("")]);

function refresh(eventId: string) {
  revalidatePath(`/events/${eventId}/invites/plan`);
}

async function failure(error: unknown): Promise<PlanFormState> {
  const key = guestErrorKey(error);
  if (!key) throw error;
  const t = await getTranslations("Guests.errors");
  return { error: t.has(key) ? t(key) : t("generic") };
}

async function denied(): Promise<PlanFormState> {
  const t = await getTranslations("Guests.errors");
  return { error: t("denied") };
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "");
}

// —— Placement (appelé par le composant « Déplacer » : true si enregistré) ——————————————————

export async function seatGuestAction(eventId: string, planId: string, guestId: string, tableId: string | null): Promise<boolean> {
  const access = await guestsAccess();
  const parsed = z.object({ eventId: id, planId: id, guestId: id, tableId: id.nullable() }).safeParse({ eventId, planId, guestId, tableId });
  if (!access || !parsed.success) return false;
  try {
    await seatGuest(access.organizationId, eventId, planId, guestId, tableId);
  } catch (error) {
    if (!guestErrorKey(error)) throw error;
    return false;
  }
  refresh(eventId);
  return true;
}

// Tout un foyer d'un geste ; null si refusé, sinon le nombre placé.
export async function seatHouseholdAction(eventId: string, planId: string, householdId: string, tableId: string | null): Promise<number | null> {
  const access = await guestsAccess();
  const parsed = z.object({ eventId: id, planId: id, householdId: id, tableId: id.nullable() }).safeParse({ eventId, planId, householdId, tableId });
  if (!access || !parsed.success) return null;
  try {
    const count = await seatHousehold(access.organizationId, eventId, planId, householdId, tableId);
    refresh(eventId);
    return count;
  } catch (error) {
    if (!guestErrorKey(error)) throw error;
    return null;
  }
}

// —— Plan et tables ———————————————————————————————————————————————————————————————————

export async function createPlanAction(formData: FormData): Promise<void> {
  const access = await guestsAccess();
  const parsed = z.object({ eventId: id, keyMomentId: id }).safeParse({ eventId: field(formData, "eventId"), keyMomentId: field(formData, "keyMomentId") });
  if (!access || !parsed.success) return;
  try {
    await createSeatingPlan(access.organizationId, parsed.data.eventId, parsed.data.keyMomentId);
  } catch (error) {
    if (!guestErrorKey(error)) throw error;
  }
  refresh(parsed.data.eventId);
}

const tablesSchema = z.object({
  eventId: id,
  planId: id,
  count: z.coerce.number().int(),
  shape: z.enum(SEATING_SHAPES),
  capacity: z.coerce.number().int(),
});

export async function addTablesAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const access = await guestsAccess();
  if (!access) return denied();
  const parsed = tablesSchema.safeParse(Object.fromEntries(["eventId", "planId", "count", "shape", "capacity"].map((name) => [name, field(formData, name)])));
  if (!parsed.success) return failure(new SeatingInvalidError("count"));
  const t = await getTranslations("Guests.plan");
  try {
    await addSeatingTables(access.organizationId, parsed.data.eventId, parsed.data.planId, { count: parsed.data.count, shape: parsed.data.shape, capacity: parsed.data.capacity, namePrefix: t("namePrefix") });
  } catch (error) {
    return failure(error);
  }
  refresh(parsed.data.eventId);
  return { success: t("tablesAdded") };
}

const tableSchema = z.object({ eventId: id, tableId: id, name: z.string().max(200), shape: z.enum(SEATING_SHAPES), capacity: z.coerce.number().int() });

export async function updateTableAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const access = await guestsAccess();
  if (!access) return denied();
  const parsed = tableSchema.safeParse(Object.fromEntries(["eventId", "tableId", "name", "shape", "capacity"].map((name) => [name, field(formData, name)])));
  if (!parsed.success) return failure(new SeatingInvalidError("capacity"));
  try {
    await updateSeatingTable(access.organizationId, parsed.data.eventId, parsed.data.tableId, { name: parsed.data.name, shape: parsed.data.shape, capacity: parsed.data.capacity });
  } catch (error) {
    return failure(error);
  }
  refresh(parsed.data.eventId);
  return { success: (await getTranslations("Guests.plan"))("tableSaved") };
}

export async function removeTableAction(formData: FormData): Promise<void> {
  const access = await guestsAccess();
  const parsed = z.object({ eventId: id, tableId: id }).safeParse({ eventId: field(formData, "eventId"), tableId: field(formData, "tableId") });
  if (!access || !parsed.success) return;
  await removeSeatingTable(access.organizationId, parsed.data.eventId, parsed.data.tableId).catch((error: unknown) => {
    if (!guestErrorKey(error)) throw error;
  });
  refresh(parsed.data.eventId);
}

export async function copyPlanAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const access = await guestsAccess();
  if (!access) return denied();
  const parsed = z.object({ eventId: id, fromKeyMomentId: id, toKeyMomentId: id }).safeParse({ eventId: field(formData, "eventId"), fromKeyMomentId: field(formData, "fromKeyMomentId"), toKeyMomentId: field(formData, "toKeyMomentId") });
  if (!parsed.success) return denied();
  try {
    const copied = await copySeatingPlan(access.organizationId, parsed.data.eventId, parsed.data.fromKeyMomentId, parsed.data.toKeyMomentId);
    refresh(parsed.data.eventId);
    return { success: (await getTranslations("Guests.plan"))("copied", copied) };
  } catch (error) {
    return failure(error);
  }
}

// —— Désistements, contraintes, repas ———————————————————————————————————————————————————

export async function dismissReleaseAction(formData: FormData): Promise<void> {
  const access = await guestsAccess();
  const parsed = z.object({ eventId: id, planId: id, guestId: id }).safeParse({ eventId: field(formData, "eventId"), planId: field(formData, "planId"), guestId: field(formData, "guestId") });
  if (!access || !parsed.success) return;
  await dismissSeatRelease(access.organizationId, parsed.data.eventId, parsed.data.planId, parsed.data.guestId).catch((error: unknown) => {
    if (!guestErrorKey(error)) throw error;
  });
  refresh(parsed.data.eventId);
}

export async function unseatAction(formData: FormData): Promise<void> {
  const access = await guestsAccess();
  const parsed = z.object({ eventId: id, planId: id, guestId: id }).safeParse({ eventId: field(formData, "eventId"), planId: field(formData, "planId"), guestId: field(formData, "guestId") });
  if (!access || !parsed.success) return;
  await seatGuest(access.organizationId, parsed.data.eventId, parsed.data.planId, parsed.data.guestId, null).catch((error: unknown) => {
    if (!guestErrorKey(error)) throw error;
  });
  refresh(parsed.data.eventId);
}

export async function addConstraintAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const access = await guestsAccess();
  if (!access) return denied();
  const parsed = z
    .object({ eventId: id, planId: id, kind: z.enum(SEATING_CONSTRAINT_KINDS), guestIds: z.array(id).max(20) })
    .safeParse({ eventId: field(formData, "eventId"), planId: field(formData, "planId"), kind: field(formData, "kind"), guestIds: formData.getAll("guestIds").map(String) });
  if (!parsed.success) return failure(new SeatingInvalidError("constraint_members"));
  try {
    await addSeatingConstraint(access.organizationId, parsed.data.eventId, parsed.data.planId, parsed.data.kind, parsed.data.guestIds);
  } catch (error) {
    return failure(error);
  }
  refresh(parsed.data.eventId);
  return { success: (await getTranslations("Guests.plan"))("constraintAdded") };
}

export async function removeConstraintAction(formData: FormData): Promise<void> {
  const access = await guestsAccess();
  const parsed = z.object({ eventId: id, constraintId: id }).safeParse({ eventId: field(formData, "eventId"), constraintId: field(formData, "constraintId") });
  if (!access || !parsed.success) return;
  await removeSeatingConstraint(access.organizationId, parsed.data.eventId, parsed.data.constraintId).catch((error: unknown) => {
    if (!guestErrorKey(error)) throw error;
  });
  refresh(parsed.data.eventId);
}

export async function setGuestMealTypeAction(formData: FormData): Promise<void> {
  const access = await guestsAccess();
  const parsed = z.object({ eventId: id, guestId: id, mealTypeId: optionalId }).safeParse({ eventId: field(formData, "eventId"), guestId: field(formData, "guestId"), mealTypeId: field(formData, "mealTypeId") });
  if (!access || !parsed.success) return;
  await setGuestMealType(access.organizationId, parsed.data.eventId, parsed.data.guestId, parsed.data.mealTypeId || null).catch((error: unknown) => {
    if (!guestErrorKey(error)) throw error;
  });
  refresh(parsed.data.eventId);
}

export async function setVendorMealsAction(_prev: PlanFormState, formData: FormData): Promise<PlanFormState> {
  const access = await guestsAccess();
  if (!access) return denied();
  const parsed = z.object({ eventId: id, keyMomentId: id, count: z.coerce.number().int() }).safeParse({ eventId: field(formData, "eventId"), keyMomentId: field(formData, "keyMomentId"), count: field(formData, "count") });
  if (!parsed.success) return failure(new SeatingInvalidError("vendor_count"));
  try {
    await setVendorMealCount(access.organizationId, parsed.data.eventId, parsed.data.keyMomentId, parsed.data.count);
  } catch (error) {
    return failure(error);
  }
  refresh(parsed.data.eventId);
  return { success: (await getTranslations("Guests.plan"))("vendorSaved") };
}
