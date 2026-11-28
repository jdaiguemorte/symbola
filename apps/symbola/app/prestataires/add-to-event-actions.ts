"use server";

// Lot 73c (PRE-02, BUD-01, BUD-02, UX-07, SEC-10 à SEC-13, SEC-18 ; spécification du lot 73, § 5.3 ;
// P12, P-14) — les actions de « Ajouter à un mariage… », les mêmes pour la fenêtre du carnet (ligne,
// fiche, sélection, carnet ouvert depuis un poste) et le panneau du poste. Chaque action revérifie la
// session, l'organisation, les modules Prestataires et Évènements, l'équipe d'une Planner restreinte
// (lot 52) ; les entrées sont validées par Zod. Une fiche, un mariage ou un poste hors de portée répond
// toujours « introuvable », sans dire ce qui existe ailleurs.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { z } from "zod";
import { formatAmount, parisToday, type Locale } from "@symbola/i18n";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { taskListViewer } from "@/lib/event-visibility";
import { addToEvent, loadAdditionChoices, undoAddition, type AdditionAccess } from "@/lib/vendors/add-to-event";
import { isBudgetModuleEnabled } from "@/app/budget/module-access";
import { isEventsModuleEnabled } from "@/app/events/module-access";
import { isVendorsModuleEnabled } from "./module-access";
import { additionFeedback, type AdditionChoices } from "./add-to-event-model";

// Au plus les fiches d'une sélection du carnet (lot 73b).
const MAX_VENDORS = 500;

async function access(): Promise<AdditionAccess | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  const organizationId = auth.user.organizationId;
  const [vendors, eventsModule, budget] = await Promise.all([isVendorsModuleEnabled(organizationId), isEventsModuleEnabled(organizationId), isBudgetModuleEnabled(organizationId)]);
  if (!vendors || !eventsModule) return null;
  const viewer = await taskListViewer({ user: { id: auth.user.id, role: auth.user.role, organizationId } });
  return { organizationId, userId: auth.user.id, viewer, budgetEnabled: budget };
}

const idsSchema = z.array(z.uuid()).min(1).max(MAX_VENDORS);

export type LoadAdditionResult = { ok: true; choices: AdditionChoices } | { ok: false; error: string };

export async function loadAdditionAction(input: unknown): Promise<LoadAdditionResult> {
  const t = await getTranslations("VendorAddition");
  const allowed = await access();
  if (!allowed) return { ok: false, error: t("unauthorized") };
  const parsed = z.object({ vendorIds: idsSchema }).safeParse(input);
  if (!parsed.success) return { ok: false, error: t("notFound") };
  const choices = await loadAdditionChoices(allowed, { vendorIds: parsed.data.vendorIds, today: parisToday(new Date()) });
  return choices ? { ok: true, choices } : { ok: false, error: t("notFound") };
}

const requestSchema = z
  .object({
    eventId: z.uuid(),
    slotId: z.uuid().optional(),
    newSlotLabel: z.string().trim().min(1).max(120).optional(),
    vendorIds: idsSchema,
    mode: z.enum(["compare", "retain", "replace", "retain_also"]),
    confirmed: z.boolean().default(false),
  })
  .refine((value) => (value.slotId === undefined) !== (value.newSlotLabel === undefined));

export type AdditionActionResult =
  | { ok: true; title: string; detail: string; undoId: string; eventId: string; slotId: string; slotHref: string }
  | { ok: false; kind: "error"; error: string }
  // « Retenir quand même ? » au-delà du seuil d'alerte de l'enveloppe.
  | { ok: false; kind: "confirm"; message: string }
  // Poste déjà pourvu (P12) : « Remplacer {nom} » ou « Retenir aussi ».
  | { ok: false; kind: "choice"; retainedName: string };

export async function addToEventAction(input: unknown): Promise<AdditionActionResult> {
  const t = await getTranslations("VendorAddition");
  const allowed = await access();
  if (!allowed) return { ok: false, kind: "error", error: t("unauthorized") };
  const parsed = requestSchema.safeParse(input);
  if (!parsed.success) return { ok: false, kind: "error", error: t("notFound") };
  const { confirmed, slotId, newSlotLabel, ...request } = parsed.data;
  const outcome = await addToEvent(allowed, { ...request, ...(slotId ? { slotId } : {}), ...(newSlotLabel !== undefined ? { newSlotLabel } : {}), confirmed });
  if (outcome.status === "not_found") return { ok: false, kind: "error", error: t("notFound") };
  if (outcome.status === "choice_required") return { ok: false, kind: "choice", retainedName: outcome.retainedName };
  if (outcome.status === "confirm_budget") {
    const locale: Locale = (await getLocale()) === "en" ? "en" : "fr";
    const tCandidates = await getTranslations("VendorCandidates");
    return { ok: false, kind: "confirm", message: tCandidates("engagementAlert", { committed: formatAmount(outcome.committedAfterCents, locale), over: formatAmount(outcome.overThresholdCents, locale), percent: outcome.thresholdPercent }) };
  }
  revalidatePath(`/events/${outcome.eventId}`);
  revalidatePath("/prestataires");
  const message = additionFeedback({ mode: outcome.mode, slotLabel: outcome.slotLabel, vendorNames: outcome.vendorNames, eventLabel: outcome.eventLabel, comparingCount: outcome.comparingCount, replacedName: outcome.replacedName });
  type Key = Parameters<typeof t>[0];
  return {
    ok: true,
    title: t(`feedback.${message.title.key}` as Key, message.title.values),
    detail: message.detail.map((part) => ("text" in part ? part.text : t(`feedback.${part.key}` as Key, part.values))).join(" · "),
    undoId: outcome.undoId,
    eventId: outcome.eventId,
    slotId: outcome.slotId,
    slotHref: `/events/${outcome.eventId}?onglet=budget&poste=${outcome.slotId}`,
  };
}

export async function undoAdditionAction(input: unknown): Promise<{ ok: boolean; message: string }> {
  const t = await getTranslations("VendorAddition");
  const allowed = await access();
  const parsed = z.object({ undoId: z.uuid(), eventId: z.uuid() }).safeParse(input);
  if (!allowed || !parsed.success) return { ok: false, message: t("undoExpired") };
  const undone = await undoAddition(allowed, parsed.data.undoId);
  if (undone) {
    revalidatePath(`/events/${parsed.data.eventId}`);
    revalidatePath("/prestataires");
  }
  return { ok: undone, message: t(undone ? "undone" : "undoExpired") };
}
