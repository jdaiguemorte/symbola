"use server";

// Lot 63c (BUD-04, PRE-02 ; #39, maquette M9) — « Choisir un prestataire… » sur chaque ligne de
// « Budget et prestataires » : chercher dans le catalogue, retenir pour le poste, ou créer la fiche
// dans une fenêtre sans quitter le budget. Chaque action vérifie la session, l'organisation et les
// modules (Évènements, Prestataires) ; les entrées sont validées par Zod (SEC-18).
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import { createAndRetainVendor, retainVendorForSlot, searchSlotVendors, type SlotVendorChoice } from "@/lib/vendors/slot-retention";

async function access(): Promise<{ organizationId: string; userId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId)) || !(await isVendorsModuleEnabled(organizationId))) return null;
  return { organizationId, userId: auth.user.id };
}

const slotSchema = z.object({ eventId: z.uuid(), slotId: z.uuid() });

export async function searchSlotVendorsAction(input: unknown): Promise<SlotVendorChoice[]> {
  const allowed = await access();
  const parsed = slotSchema.extend({ term: z.string().max(100) }).safeParse(input);
  if (!allowed || !parsed.success) return [];
  try {
    return await searchSlotVendors({ organizationId: allowed.organizationId, ...parsed.data, locale: await getLocale() });
  } catch {
    // Un poste d'un autre évènement ou d'une autre organisation : rien, sans dire pourquoi.
    return [];
  }
}

export type SlotVendorState = { ok: true } | { ok: false; error: string };

export async function retainSlotVendorAction(input: unknown): Promise<SlotVendorState> {
  const t = await getTranslations("BudgetVendors");
  const allowed = await access();
  if (!allowed) return { ok: false, error: t("unauthorized") };
  const parsed = slotSchema.extend({ vendorId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: t("notFound") };
  try {
    await retainVendorForSlot({ organizationId: allowed.organizationId, userId: allowed.userId, ...parsed.data });
  } catch {
    return { ok: false, error: t("notFound") };
  }
  revalidatePath(`/events/${parsed.data.eventId}`);
  return { ok: true };
}

const newVendorSchema = slotSchema.extend({
  name: z.string().trim().min(1).max(200),
  typeId: z.uuid().nullable(),
  email: z.email().max(320).nullable(),
  phone: z.string().trim().max(40).nullable(),
  city: z.string().trim().max(120).nullable(),
});

export async function createSlotVendorAction(input: unknown): Promise<SlotVendorState> {
  const t = await getTranslations("BudgetVendors");
  const allowed = await access();
  if (!allowed) return { ok: false, error: t("unauthorized") };
  const parsed = newVendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("newVendorInvalid") };
  const { eventId, slotId, ...vendor } = parsed.data;
  try {
    await createAndRetainVendor({ organizationId: allowed.organizationId, userId: allowed.userId, eventId, slotId, vendor });
  } catch {
    return { ok: false, error: t("notFound") };
  }
  revalidatePath(`/events/${eventId}`);
  return { ok: true };
}
