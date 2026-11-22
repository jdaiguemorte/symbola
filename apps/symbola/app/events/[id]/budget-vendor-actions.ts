"use server";

// Lot 63c (BUD-04, PRE-02 ; #39, maquette M9) — « Choisir un prestataire… » sur chaque ligne de
// « Budget et prestataires » : chercher dans le catalogue, ou créer la fiche dans une fenêtre sans
// quitter le budget. Lot 65b (PRE-02, BUD-02, BUD-05 ; maquette M14) : « Comparer » ou « Retenir »,
// jamais d'office ; la comparaison du poste dans sa fenêtre (retenir, écarter, changer de prestataire,
// ne plus retenir). Chaque action vérifie la session, l'organisation et les modules ; les entrées sont
// validées par Zod (SEC-18) ; le prestataire doit être du poste et de l'évènement (SEC-13).
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { ENGAGED_CANDIDATE_STATUSES, type VendorAvailability, type VendorCandidateStatus } from "@symbola/contracts";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { changeRetainedVendor, countWorkedWithByVendor, getVendorComparison, listVendorCandidates, selectVendorCandidate, updateVendorCandidate } from "@/modules/events/service";
import { isEventsModuleEnabled } from "../module-access";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import { compareVendorForSlot, createAndRetainVendor, retainVendorForSlot, searchSlotVendors, type SlotVendorSearch } from "@/lib/vendors/slot-retention";
import { engagementAlert } from "./engagement-alert";

async function eventsAccess(): Promise<{ organizationId: string; userId: string } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  const organizationId = auth.user.organizationId;
  if (!(await isEventsModuleEnabled(organizationId))) return null;
  return { organizationId, userId: auth.user.id };
}

// Le carnet : aussi le module Prestataires.
async function access(): Promise<{ organizationId: string; userId: string } | null> {
  const allowed = await eventsAccess();
  if (!allowed || !(await isVendorsModuleEnabled(allowed.organizationId))) return null;
  return allowed;
}

const slotSchema = z.object({ eventId: z.uuid(), slotId: z.uuid() });

function refresh(eventId: string, slotId: string) {
  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/consultation/${slotId}`);
}

export async function searchSlotVendorsAction(input: unknown): Promise<SlotVendorSearch> {
  const allowed = await access();
  const parsed = slotSchema.extend({ term: z.string().max(100) }).safeParse(input);
  if (!allowed || !parsed.success) return { choices: [], matchingCount: 0 };
  try {
    return await searchSlotVendors({ organizationId: allowed.organizationId, ...parsed.data, locale: await getLocale() });
  } catch {
    // Un poste d'un autre évènement ou d'une autre organisation : rien, sans dire pourquoi.
    return { choices: [], matchingCount: 0 };
  }
}

// confirm : le dépassement du seuil d'alerte du budget, à confirmer avant de retenir (BUD-02).
export type SlotVendorState = { ok: true } | { ok: false; error: string } | { ok: false; confirm: string };

export async function retainSlotVendorAction(input: unknown): Promise<SlotVendorState> {
  const t = await getTranslations("BudgetVendors");
  const allowed = await access();
  if (!allowed) return { ok: false, error: t("unauthorized") };
  const parsed = slotSchema.extend({ vendorId: z.uuid(), confirmed: z.boolean().default(false) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: t("notFound") };
  const { confirmed, ...target } = parsed.data;
  try {
    const existing = (await listVendorCandidates(allowed.organizationId, target.eventId)).find((candidate) => candidate.vendorSlotId === target.slotId && candidate.vendorId === target.vendorId);
    const confirm = await engagementAlert({ organizationId: allowed.organizationId, eventId: target.eventId, vendorSlotId: target.slotId, amountCents: existing?.quoteAmountCents ?? null, ...(existing ? { candidateId: existing.id } : {}), confirmed });
    if (confirm) return { ok: false, confirm };
    await retainVendorForSlot({ organizationId: allowed.organizationId, userId: allowed.userId, ...target });
  } catch {
    return { ok: false, error: t("notFound") };
  }
  refresh(target.eventId, target.slotId);
  return { ok: true };
}

// « Comparer » : le prestataire entre dans la comparaison du poste, sans être retenu.
export async function compareSlotVendorAction(input: unknown): Promise<SlotVendorState> {
  const t = await getTranslations("BudgetVendors");
  const allowed = await access();
  if (!allowed) return { ok: false, error: t("unauthorized") };
  const parsed = slotSchema.extend({ vendorId: z.uuid() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: t("notFound") };
  try {
    await compareVendorForSlot({ organizationId: allowed.organizationId, ...parsed.data });
  } catch {
    return { ok: false, error: t("notFound") };
  }
  refresh(parsed.data.eventId, parsed.data.slotId);
  return { ok: true };
}

// --- La comparaison du poste, dans sa fenêtre (M14 B) ---

export type SlotComparisonColumn = {
  candidateId: string;
  vendorName: string;
  status: VendorCandidateStatus;
  retained: boolean;
  dismissed: boolean;
  quoteAmountCents: number | null;
  hasQuoteFile: boolean;
  availability: VendorAvailability | null;
  remindedAt: string | null;
  note: string | null;
  workedWithCount: number;
};

export type SlotComparisonState = { ok: true; columns: SlotComparisonColumn[] } | { ok: false };

export async function slotComparisonAction(input: unknown): Promise<SlotComparisonState> {
  const allowed = await eventsAccess();
  const parsed = slotSchema.safeParse(input);
  if (!allowed || !parsed.success) return { ok: false };
  try {
    const [comparison, worked] = await Promise.all([getVendorComparison(allowed.organizationId, parsed.data.eventId, parsed.data.slotId), countWorkedWithByVendor(allowed.organizationId)]);
    const columns = comparison.rows.map((row): SlotComparisonColumn => {
      const status = row.status as VendorCandidateStatus;
      return {
        candidateId: row.candidateId,
        vendorName: row.vendorName,
        status,
        retained: ENGAGED_CANDIDATE_STATUSES.includes(status),
        dismissed: status === "dismissed",
        quoteAmountCents: row.quoteAmountCents,
        hasQuoteFile: row.hasQuoteFile,
        availability: row.availability,
        remindedAt: row.remindedAt,
        note: row.internalNotes.at(-1) ?? null,
        workedWithCount: row.vendorId ? (worked.get(row.vendorId) ?? 0) : 0,
      };
    });
    // Le retenu en tête, puis ceux en lice, puis les écartés (grisés) ; à l'intérieur, l'ordre des devis.
    const rank = (column: SlotComparisonColumn) => (column.retained ? 0 : column.dismissed ? 2 : 1);
    return { ok: true, columns: columns.map((column, index) => ({ column, index })).sort((a, b) => rank(a.column) - rank(b.column) || a.index - b.index).map(({ column }) => column) };
  } catch {
    return { ok: false };
  }
}

const candidateSchema = slotSchema.extend({ candidateId: z.uuid() });

async function slotCandidate(organizationId: string, eventId: string, slotId: string, candidateId: string) {
  return (await listVendorCandidates(organizationId, eventId)).find((candidate) => candidate.id === candidateId && candidate.vendorSlotId === slotId) ?? null;
}

// « Retenir », ou « Retenir à la place » (replace : le retenu actuel est écarté, son engagé libéré).
export async function retainSlotCandidateAction(input: unknown): Promise<SlotVendorState> {
  const t = await getTranslations("BudgetVendors");
  const allowed = await eventsAccess();
  if (!allowed) return { ok: false, error: t("unauthorized") };
  const parsed = candidateSchema.extend({ replace: z.boolean().default(false), confirmed: z.boolean().default(false) }).safeParse(input);
  if (!parsed.success) return { ok: false, error: t("notFound") };
  const { eventId, slotId, candidateId, replace, confirmed } = parsed.data;
  const candidate = await slotCandidate(allowed.organizationId, eventId, slotId, candidateId);
  if (!candidate) return { ok: false, error: t("notFound") };
  const confirm = await engagementAlert({ organizationId: allowed.organizationId, eventId, vendorSlotId: slotId, amountCents: candidate.quoteAmountCents, candidateId, confirmed });
  if (confirm) return { ok: false, confirm };
  try {
    if (replace) await changeRetainedVendor({ organizationId: allowed.organizationId, eventId, vendorSlotId: slotId, candidateId, userId: allowed.userId });
    else await selectVendorCandidate({ organizationId: allowed.organizationId, candidateId, changedByUserId: allowed.userId });
  } catch {
    return { ok: false, error: t("notFound") };
  }
  refresh(eventId, slotId);
  return { ok: true };
}

// « Ne plus retenir » : personne n'est retenu ; l'ancien retenu et ceux écartés pour lui reviennent en
// lice, l'engagé est libéré (D6 du lot 47).
export async function releaseSlotRetainedAction(input: unknown): Promise<SlotVendorState> {
  const t = await getTranslations("BudgetVendors");
  const allowed = await eventsAccess();
  if (!allowed) return { ok: false, error: t("unauthorized") };
  const parsed = slotSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("notFound") };
  try {
    await changeRetainedVendor({ organizationId: allowed.organizationId, eventId: parsed.data.eventId, vendorSlotId: parsed.data.slotId, candidateId: null, userId: allowed.userId });
  } catch {
    return { ok: false, error: t("notFound") };
  }
  refresh(parsed.data.eventId, parsed.data.slotId);
  return { ok: true };
}

// « Écarter » un prestataire en lice, ou le « Remettre en comparaison ».
export async function setSlotCandidateDismissedAction(input: unknown): Promise<SlotVendorState> {
  const t = await getTranslations("BudgetVendors");
  const allowed = await eventsAccess();
  if (!allowed) return { ok: false, error: t("unauthorized") };
  const parsed = candidateSchema.extend({ dismissed: z.boolean() }).safeParse(input);
  if (!parsed.success) return { ok: false, error: t("notFound") };
  const { eventId, slotId, candidateId, dismissed } = parsed.data;
  const candidate = await slotCandidate(allowed.organizationId, eventId, slotId, candidateId);
  // Un retenu ne s'écarte pas ici : « Ne plus retenir » ou « Changer de prestataire ».
  if (!candidate || ENGAGED_CANDIDATE_STATUSES.includes(candidate.status)) return { ok: false, error: t("notFound") };
  const back: VendorCandidateStatus = candidate.quoteAmountCents !== null || candidate.hasQuoteFile ? "quote_received" : candidate.contactedOn ? "contacted" : "shortlisted";
  await updateVendorCandidate({ organizationId: allowed.organizationId, candidateId, status: dismissed ? "dismissed" : back });
  refresh(eventId, slotId);
  return { ok: true };
}

const newVendorSchema = slotSchema.extend({
  name: z.string().trim().min(1).max(200),
  typeId: z.uuid().nullable(),
  email: z.email().max(320).nullable(),
  phone: z.string().trim().max(40).nullable(),
  city: z.string().trim().max(120).nullable(),
  // Lot 65b : la fiche créée entre dans la comparaison ; « retain » la retient.
  retain: z.boolean().default(false),
});

export async function createSlotVendorAction(input: unknown): Promise<SlotVendorState> {
  const t = await getTranslations("BudgetVendors");
  const allowed = await access();
  if (!allowed) return { ok: false, error: t("unauthorized") };
  const parsed = newVendorSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: t("newVendorInvalid") };
  const { eventId, slotId, retain, ...vendor } = parsed.data;
  try {
    await createAndRetainVendor({ organizationId: allowed.organizationId, userId: allowed.userId, eventId, slotId, retain, vendor });
  } catch {
    return { ok: false, error: t("notFound") };
  }
  refresh(eventId, slotId);
  return { ok: true };
}
