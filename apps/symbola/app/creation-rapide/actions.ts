"use server";

// Lot 32b (HUB-07, UX-03 ; décision D9) — création rapide depuis tout écran : prospect, tâche,
// dépense (ligne de budget, avec le montant du devis d'un prestataire s'il y en a un), devis. Chaque
// création reste sur l'écran et se confirme par un message et un lien. Contrôles côté serveur :
// session planner, organisation, module souscrit, évènement de l'organisation (RLS), entrées
// validées ; mêmes services et mêmes règles que les formulaires de chaque écran.
import { revalidatePath } from "next/cache";
import { getLocale, getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { parseAmountToCents, type Locale } from "@symbola/i18n";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { ensureEventTypes } from "@/lib/events/event-types";
import { isActiveEvent } from "@/lib/today/load";
import { eventsMessageFor } from "@/lib/vocabulary";
import { isValidId } from "@/app/events/module-access";
import { addBudgetLine, BudgetLineDetailsInvalidError, updateBudgetLine } from "@/modules/budget/service";
import {
  addEventTask,
  createProspect,
  eventNames,
  getEvent,
  listEvents,
  listEventVendorSlots,
  listProspectSources,
  listVendorCandidates,
} from "@/modules/events/service";
import { isModuleEnabled } from "@/modules/hub/service";
import { createQuote, EventNotFoundError, getQuote } from "@/modules/quotes/service";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export type QuickModules = { events: boolean; quotes: boolean; budget: boolean };
export type QuickEvent = { id: string; names: string; date: string | null };
export type QuickCreateOptions = {
  modules: QuickModules;
  events: QuickEvent[];
  currentEventId: string | null;
  sources: { id: string; label: string }[];
  eventTypes: { id: string; label: string }[];
};
export type QuickSlot = { id: string; label: string; candidates: { id: string; vendorName: string }[] };
export type QuickCreateState = { error?: string; done?: { message: string; href: string }; nonce?: number };

async function planner(): Promise<{ organizationId: string; userId: string; modules: QuickModules } | null> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return null;
  const organizationId = auth.user.organizationId;
  const db = appDatabase();
  const modules = {
    events: await isModuleEnabled(db, organizationId, "events"),
    quotes: await isModuleEnabled(db, organizationId, "quotes"),
    budget: await isModuleEnabled(db, organizationId, "budget"),
  };
  return { organizationId, userId: auth.user.id, modules };
}

// L'évènement de l'écran courant : sa fiche, son budget, son jour J, ou l'un de ses devis.
async function eventOfPath(organizationId: string, pathname: string, quotes: boolean): Promise<string | null> {
  const direct = /^\/(?:events|budget|jour-j)\/([0-9a-f-]{36})(?:[/?#]|$)/.exec(pathname);
  if (direct && isValidId(direct[1]!)) return direct[1]!;
  const quote = /^\/devis\/([0-9a-f-]{36})(?:[/?#]|$)/.exec(pathname);
  if (quote && quotes && isValidId(quote[1]!)) {
    try {
      return (await getQuote(organizationId, quote[1]!)).eventId;
    } catch {
      return null;
    }
  }
  return null;
}

export async function quickCreateOptionsAction(pathname: string): Promise<QuickCreateOptions | null> {
  const access = await planner();
  if (!access || !access.modules.events) return null;
  const { organizationId } = access;
  const all = await listEvents({ organizationId });
  const active = all.filter((event) => isActiveEvent(event) && !event.isDemo).sort((a, b) => (a.eventDate ?? "9999").localeCompare(b.eventDate ?? "9999"));
  const currentId = typeof pathname === "string" ? await eventOfPath(organizationId, pathname, access.modules.quotes) : null;
  const current = currentId ? all.find((event) => event.id === currentId) : undefined;
  const events = [...(current && !active.includes(current) ? [current] : []), ...active].map((event) => ({ id: event.id, names: eventNames(event.clients), date: event.eventDate }));
  const locale = (await getLocale()) as Locale;
  const [sources, eventTypes] = await Promise.all([listProspectSources(organizationId), ensureEventTypes(organizationId, locale)]);
  return {
    modules: access.modules,
    events,
    currentEventId: current?.id ?? null,
    sources: sources.map((source) => ({ id: source.id, label: source.label })),
    eventTypes: eventTypes.map((type) => ({ id: type.id, label: type.label })),
  };
}

// Dépense : les postes de l'évènement et leurs prestataires consultés.
export async function quickCreateSlotsAction(eventId: string): Promise<QuickSlot[]> {
  const access = await planner();
  if (!access || !access.modules.events || !access.modules.budget || typeof eventId !== "string" || !isValidId(eventId)) return [];
  const [slots, candidates] = await Promise.all([listEventVendorSlots(access.organizationId, eventId), listVendorCandidates(access.organizationId, eventId)]);
  return slots.map((slot) => ({
    id: slot.id,
    label: slot.label,
    candidates: candidates.filter((candidate) => candidate.vendorSlotId === slot.id).map((candidate) => ({ id: candidate.id, vendorName: candidate.vendorName })),
  }));
}

function field(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}

function refresh(eventId: string | null): void {
  revalidatePath("/");
  revalidatePath("/events");
  revalidatePath("/taches");
  if (eventId) revalidatePath(`/events/${eventId}`);
}

export async function quickCreateProspectAction(_prev: QuickCreateState, formData: FormData): Promise<QuickCreateState> {
  const t = await getTranslations("QuickCreate");
  const tEvents = await getTranslations("Events");
  const access = await planner();
  if (!access) return { error: tEvents("unauthenticated") };
  if (!access.modules.events) return { error: tEvents("moduleUnavailable") };
  const { organizationId } = access;
  const locale = (await getLocale()) as Locale;
  const eventType = (await ensureEventTypes(organizationId, locale)).find((type) => type.id === field(formData, "eventTypeId"));
  if (!eventType) return { error: tEvents("missingEventType") };
  const firstName = field(formData, "firstName");
  if (!firstName) return { error: eventsMessageFor(locale, eventType.audience, "missingFirstName") };
  const prospectSourceId = field(formData, "prospectSourceId");
  if (!(await listProspectSources(organizationId)).some((source) => source.id === prospectSourceId)) return { error: tEvents("missingSource") };
  const eventDate = field(formData, "eventDate");
  if (eventDate && !DATE.test(eventDate)) return { error: tEvents("invalidDate") };
  const created = await createProspect({
    organizationId,
    createdByUserId: access.userId,
    clients: [{ firstName, lastName: null }],
    prospectSourceId,
    eventTypeId: eventType.id,
    eventDate: eventDate || null,
    venueName: null,
    venueCity: null,
  });
  refresh(created.id);
  return { done: { message: t("prospectDone", { name: firstName }), href: `/events/${created.id}` }, nonce: Date.now() };
}

export async function quickCreateTaskAction(_prev: QuickCreateState, formData: FormData): Promise<QuickCreateState> {
  const t = await getTranslations("QuickCreate");
  const tEvents = await getTranslations("Events");
  const access = await planner();
  if (!access) return { error: tEvents("unauthenticated") };
  if (!access.modules.events) return { error: tEvents("moduleUnavailable") };
  const eventId = field(formData, "eventId");
  if (!isValidId(eventId)) return { error: t("chooseEventError") };
  const label = field(formData, "label");
  if (!label) return { error: tEvents("missingLabel") };
  const dueDate = field(formData, "dueDate");
  if (!DATE.test(dueDate)) return { error: tEvents("invalidDate") };
  const responsible = field(formData, "responsible");
  if (responsible !== "planner" && responsible !== "clients") return { error: tEvents("invalidResponsible") };
  try {
    await addEventTask(access.organizationId, eventId, { label, dueDate, responsible });
  } catch (error) {
    if (error instanceof RangeError) return { error: tEvents("invalidDate") };
    if ((error as Error).name === "EventNotFoundError") return { error: tEvents("eventNotFound") };
    throw error;
  }
  refresh(eventId);
  return { done: { message: t("taskDone", { label }), href: `/events/${eventId}?onglet=retroplanning` }, nonce: Date.now() };
}

export async function quickCreateExpenseAction(_prev: QuickCreateState, formData: FormData): Promise<QuickCreateState> {
  const t = await getTranslations("QuickCreate");
  const tBudget = await getTranslations("Budget");
  const access = await planner();
  if (!access) return { error: tBudget("unauthenticated") };
  if (!access.modules.events || !access.modules.budget) return { error: tBudget("moduleUnavailable") };
  const eventId = field(formData, "eventId");
  if (!isValidId(eventId)) return { error: t("chooseEventError") };
  const eventVendorSlotId = field(formData, "eventVendorSlotId");
  if (!isValidId(eventVendorSlotId)) return { error: tBudget("unknownVendorSlot") };
  const candidate = field(formData, "vendorCandidateId");
  const amount = parseAmountToCents(field(formData, "amount"));
  if (amount === undefined) return { error: t("amountInvalid") };
  const label = field(formData, "label");
  try {
    const view = await addBudgetLine({ organizationId: access.organizationId, eventId, eventVendorSlotId, label, vendorCandidateId: isValidId(candidate) ? candidate : null });
    // La ligne créée : la dernière de son poste portant ce libellé.
    const lineId = view.lines.filter((line) => line.eventVendorSlotId === eventVendorSlotId && line.label === label.slice(0, 200)).at(-1)?.id;
    if (amount !== null && lineId) {
      await updateBudgetLine({ organizationId: access.organizationId, eventId, lineId, field: "quoted", amountCents: amount, changedByUserId: access.userId });
    }
  } catch (error) {
    if (error instanceof BudgetLineDetailsInvalidError) return { error: tBudget(error.reason === "label" ? "lineLabelRequired" : error.reason === "vendor" ? "lineVendorInvalid" : "lineVatRateInvalid") };
    if (["EventNotFoundError", "EventVendorSlotNotFoundError", "BudgetLineNotFoundError"].includes((error as Error).name)) return { error: tBudget("unknownVendorSlot") };
    throw error;
  }
  refresh(eventId);
  revalidatePath(`/budget/${eventId}`);
  return { done: { message: t("expenseDone", { label }), href: `/budget/${eventId}` }, nonce: Date.now() };
}

export async function quickCreateQuoteAction(_prev: QuickCreateState, formData: FormData): Promise<QuickCreateState> {
  const t = await getTranslations("QuickCreate");
  const tQuotes = await getTranslations("Quotes");
  const access = await planner();
  if (!access) return { error: tQuotes("unauthenticated") };
  if (!access.modules.events || !access.modules.quotes) return { error: tQuotes("moduleUnavailable") };
  const eventId = field(formData, "eventId");
  if (!isValidId(eventId) || !(await getEvent(access.organizationId, eventId))) return { error: t("chooseEventError") };
  let quote;
  try {
    quote = await createQuote({ organizationId: access.organizationId, eventId, createdByUserId: access.userId });
  } catch (error) {
    if (error instanceof EventNotFoundError) return { error: t("chooseEventError") };
    throw error;
  }
  refresh(eventId);
  revalidatePath("/devis");
  return { done: { message: t("quoteDone", { number: quote.number }), href: `/devis/${quote.id}` }, nonce: Date.now() };
}
