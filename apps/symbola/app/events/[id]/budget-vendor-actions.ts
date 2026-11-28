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
import { changeRetainedVendor, countWorkedWithByVendor, getVendorComparison, listLastVendorReminders, listVendorCandidates, selectVendorCandidate, updateVendorCandidate, type VendorReminderChannel } from "@/modules/events/service";
import { isEventsModuleEnabled } from "../module-access";
import { isVendorsModuleEnabled } from "@/app/prestataires/module-access";
import { searchSlotVendors, type SlotVendorSearch } from "@/lib/vendors/slot-retention";
import { documentStateView, shortDayMonth } from "@/app/prestataires/book-row";
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

// Lot 73c (critère 7) : chaque fiche du panneau du poste avec l'état de ses pièces en mots (P3, mêmes mots
// que le carnet) et son évaluation, formatés ici : le panneau n'importe aucune règle serveur.
export type SlotPanelChoice = SlotVendorSearch["choices"][number] & { documents: { tone: string; icon: string | null; text: string }; ratingText: string | null };
export type SlotPanelSearch = Omit<SlotVendorSearch, "choices"> & { choices: SlotPanelChoice[] };
const EMPTY_SEARCH: SlotPanelSearch = { choices: [], matchingCount: 0, tradeLabel: null, bookCount: 0 };

export async function searchSlotVendorsAction(input: unknown): Promise<SlotPanelSearch> {
  const allowed = await access();
  const parsed = slotSchema.extend({ term: z.string().max(100) }).safeParse(input);
  if (!allowed || !parsed.success) return EMPTY_SEARCH;
  try {
    const rawLocale = await getLocale();
    const locale = rawLocale === "en" ? "en" : "fr";
    const found = await searchSlotVendors({ organizationId: allowed.organizationId, ...parsed.data, locale: rawLocale });
    const t = await getTranslations("VendorBook");
    type Key = Parameters<typeof t>[0];
    return {
      ...found,
      choices: found.choices.map((choice) => {
        const view = documentStateView(choice.documentState);
        const values = Object.fromEntries(Object.entries(view.message.values).map(([key, value]) => [key, key === "date" && typeof value === "string" ? shortDayMonth(value, locale) : value]));
        return {
          ...choice,
          documents: { tone: view.tone, icon: view.icon, text: `${t(`documents.${view.message.key}` as Key, values)}${view.more > 0 ? ` ${t("documents.more", { count: view.more })}` : ""}` },
          ratingText: choice.rating ? t("row.rating", { rating: choice.rating }) : null,
        };
      }),
    };
  } catch {
    // Un poste d'un autre évènement ou d'une autre organisation : rien, sans dire pourquoi.
    return EMPTY_SEARCH;
  }
}

// confirm : le dépassement du seuil d'alerte du budget, à confirmer avant de retenir (BUD-02).
export type SlotVendorState = { ok: true } | { ok: false; error: string } | { ok: false; confirm: string };

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
  // La dernière relance : notée par la planner (lot 65d, avec son moyen), ou le rappel de brief du lot
  // 47 (sans moyen) ; jour de Paris.
  remindedOn: string | null;
  remindedBy: VendorReminderChannel | null;
  note: string | null;
  workedWithCount: number;
};

export type SlotComparisonState = { ok: true; columns: SlotComparisonColumn[] } | { ok: false };

export async function slotComparisonAction(input: unknown): Promise<SlotComparisonState> {
  const allowed = await eventsAccess();
  const parsed = slotSchema.safeParse(input);
  if (!allowed || !parsed.success) return { ok: false };
  try {
    const [comparison, worked, reminders] = await Promise.all([
      getVendorComparison(allowed.organizationId, parsed.data.eventId, parsed.data.slotId),
      countWorkedWithByVendor(allowed.organizationId),
      listLastVendorReminders(allowed.organizationId, parsed.data.eventId),
    ]);
    const parisDay = (instant: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(instant));
    const columns = comparison.rows.map((row): SlotComparisonColumn => {
      const status = row.status as VendorCandidateStatus;
      const noted = reminders.get(row.candidateId) ?? null;
      const briefReminder = row.remindedAt ? parisDay(row.remindedAt) : null;
      const latestNoted = noted && (!briefReminder || noted.remindedOn >= briefReminder);
      return {
        candidateId: row.candidateId,
        vendorName: row.vendorName,
        status,
        retained: ENGAGED_CANDIDATE_STATUSES.includes(status),
        dismissed: status === "dismissed",
        quoteAmountCents: row.quoteAmountCents,
        hasQuoteFile: row.hasQuoteFile,
        availability: row.availability,
        remindedOn: latestNoted ? noted.remindedOn : briefReminder,
        remindedBy: latestNoted ? noted.channel : null,
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
