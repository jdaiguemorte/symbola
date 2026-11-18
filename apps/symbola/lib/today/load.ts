// Lot 32a (HUB-08, UX-01, UX-06, EVT-02 ; décisions D2 à D4, D6) — tout ce qui demande une action,
// tous évènements confondus, assemblé depuis les modules par leur porte d'entrée (ADR 0011). Chaque
// module souscrit apporte sa source ; sans lui, elle disparaît (ARC-06) ; lente ou en panne, elle
// est « indisponible » et les autres restent (ARC-07, settle.ts). Le tri est dans rank.ts ; les
// mots viennent de l'appelant (traductions), pour que l'assemblage se teste sans écran.
import { appDatabase } from "@symbola/db/client";
import { formatAmount, parisToday, type Locale } from "@symbola/i18n";
import type { EventSummary } from "@symbola/contracts";
import { listPendingPaymentDeclarations, listUpcomingVendorPayments } from "@/modules/budget/service";
import {
  eventNames,
  listEvents,
  listOrganizationTasks,
  listPendingDecisions,
  listPendingLinkRenewals,
  listStaleProspects,
  listUncontractedVendors, isInProgress } from "@/modules/events/service";
import { getFollowUpDelays } from "@/modules/hub/service";
import { listGuestPurgeNotices, listRecentOppositions } from "@/modules/guests/service";
import { listEventIdsWithSentQuote, listOpenScheduledDeposits, listQuotesAwaitingAnswer, listUnpaidPayments } from "@/modules/quotes/service";
import { TODAY_HORIZON_DAYS, type TodayItem } from "./rank";
import { settleWithin, TODAY_SOURCE_TIMEOUT_MS } from "./settle";

// Lot 49 : « guests » (préavis de purge des invités, oppositions), facultatif pour les écrans qui ne
// le demandent pas.
export type TodayModules = { events: boolean; quotes: boolean; budget: boolean; guests?: boolean };
export type TodaySource = keyof TodayModules;

export type TodayWords = {
  clientTask: string;
  amount: (label: string, amount: string) => string;
  decision: (title: string) => string;
  paymentDeclaration: (label: string, amount: string) => string;
  quoteFollowUp: (number: string) => string;
  prospectFollowUp: string;
  depositBlocked: (number: string) => string;
  vendorContract: (vendorName: string, slotLabel: string) => string;
  dateConflict: (count: number) => string;
  linkRenewal: (personName: string) => string;
  // Lot 49 (RGP-08) : préavis de purge (« régimes » ou « tout ») et oppositions des invités.
  guestPurge?: (stage: "diets" | "all") => string;
  guestOpposition?: (count: number) => string;
};

// Évènements en cours : ni clôturés, ni annulés (lot 34a, EVT-05).
export function isActiveEvent(event: Pick<EventSummary, "status">): boolean {
  return isInProgress(event.status);
}

function day(instant: Date | string): string {
  return parisToday(typeof instant === "string" ? new Date(instant) : instant);
}

type Context = {
  organizationId: string;
  words: TodayWords;
  today: string;
  now: Date;
  events: EventSummary[];
  names: (eventId: string | null) => string | null;
  money: (cents: number) => string;
  delays: { prospectFollowUpDays: number; quoteFollowUpDays: number };
};

async function eventItems({ organizationId, words, today, now, events, names, delays }: Context): Promise<TodayItem[]> {
  const items: TodayItem[] = [];
  for (const task of await listOrganizationTasks({ organizationId, today, horizonDays: TODAY_HORIZON_DAYS })) {
    const mine = task.responsible === "planner";
    items.push({
      key: `task:${task.id}`,
      kind: mine ? "task" : "client_task",
      eventId: task.eventId,
      eventNames: task.event.names,
      title: task.label,
      detail: mine ? undefined : words.clientTask,
      dueOn: task.dueDate,
      since: null,
      actor: mine ? { kind: "you" } : { kind: "client" },
      href: `/events/${task.eventId}?onglet=retroplanning&tache=${task.id}`,
      action: mine ? { kind: "check_task", eventId: task.eventId, taskId: task.id } : { kind: "open" },
    });
  }
  for (const decision of await listPendingDecisions(organizationId)) {
    items.push({
      key: `decision:${decision.id}`,
      kind: "decision",
      eventId: decision.eventId,
      eventNames: names(decision.eventId),
      title: words.decision(decision.title),
      dueOn: decision.dueOn,
      since: day(decision.requestedAt),
      actor: { kind: "client" },
      href: `/events/${decision.eventId}?onglet=maries`,
      action: { kind: "open" },
    });
  }
  for (const vendor of await listUncontractedVendors(organizationId, today)) {
    items.push({
      key: `vendor:${vendor.candidateId}`,
      kind: "vendor_contract",
      eventId: vendor.eventId,
      eventNames: names(vendor.eventId),
      title: words.vendorContract(vendor.vendorName, vendor.slotLabel),
      dueOn: null,
      since: vendor.since,
      actor: { kind: "vendor", name: vendor.vendorName },
      href: `/events/${vendor.eventId}`,
      action: { kind: "remind_vendor", eventId: vendor.eventId, candidateId: vendor.candidateId },
    });
  }
  // Deux évènements en cours le même jour (EVT-07) : signalés à l'approche de la date.
  const byDate = new Map<string, EventSummary[]>();
  for (const event of events) {
    if (!isActiveEvent(event) || event.isDemo || !event.eventDate || event.eventDate < today) continue;
    byDate.set(event.eventDate, [...(byDate.get(event.eventDate) ?? []), event]);
  }
  for (const [date, sameDay] of byDate) {
    if (sameDay.length < 2) continue;
    items.push({
      key: `conflict:${date}`,
      kind: "date_conflict",
      eventId: null,
      eventNames: sameDay.map((event) => eventNames(event.clients)).join(" · "),
      title: words.dateConflict(sameDay.length),
      dueOn: date,
      since: null,
      actor: { kind: "you" },
      href: "/events",
      action: { kind: "open" },
    });
  }
  for (const prospect of await listStaleProspects(organizationId, delays.prospectFollowUpDays, now)) {
    items.push({
      key: `prospect:${prospect.eventId}`,
      kind: "prospect_follow_up",
      eventId: prospect.eventId,
      eventNames: prospect.names,
      title: words.prospectFollowUp,
      dueOn: null,
      since: day(prospect.lastUpdateAt),
      actor: { kind: "client" },
      href: `/events/${prospect.eventId}`,
      action: { kind: "open" },
    });
  }
  for (const renewal of await listPendingLinkRenewals(organizationId)) {
    items.push({
      key: `renewal:${renewal.linkId}`,
      kind: "link_renewal",
      eventId: renewal.eventId,
      eventNames: names(renewal.eventId),
      title: words.linkRenewal(renewal.personName),
      dueOn: null,
      since: day(renewal.requestedAt),
      actor: { kind: "you" },
      href: `/events/${renewal.eventId}?onglet=maries`,
      action: { kind: "open" },
    });
  }
  return items;
}

// Lot 49 (RGP-08 ; D9) : préavis de purge des invités (sept jours avant chaque purge) et oppositions
// des quatorze derniers jours ; ouvrent l'onglet Invités de l'évènement.
async function guestItems({ organizationId, words, now, names }: Context): Promise<TodayItem[]> {
  const items: TodayItem[] = [];
  for (const notice of await listGuestPurgeNotices(organizationId, now)) {
    items.push({
      key: `guest-purge:${notice.eventId}:${notice.stage}`,
      kind: "guest_purge",
      eventId: notice.eventId,
      eventNames: names(notice.eventId),
      title: words.guestPurge?.(notice.stage) ?? notice.stage,
      dueOn: notice.dueOn,
      since: null,
      actor: { kind: "you" },
      href: `/events/${notice.eventId}?onglet=invites#purge`,
      action: { kind: "open" },
    });
  }
  for (const opposition of await listRecentOppositions(organizationId, now)) {
    items.push({
      key: `guest-opposition:${opposition.eventId}`,
      kind: "guest_opposition",
      eventId: opposition.eventId,
      eventNames: names(opposition.eventId),
      title: words.guestOpposition?.(opposition.count) ?? String(opposition.count),
      dueOn: null,
      since: day(opposition.latest),
      actor: { kind: "you" },
      href: `/events/${opposition.eventId}?onglet=invites`,
      action: { kind: "open" },
    });
  }
  return items;
}

async function quoteItems({ organizationId, words, now, names, money, delays }: Context): Promise<TodayItem[]> {
  const items: TodayItem[] = [];
  const unpaid = await listUnpaidPayments(organizationId, { now, horizonDays: TODAY_HORIZON_DAYS });
  for (const payment of [...unpaid.overdue, ...unpaid.upcoming]) {
    items.push({
      key: `payment:${payment.scheduleItemId}`,
      kind: "client_payment",
      eventId: payment.eventId,
      eventNames: names(payment.eventId),
      title: words.amount(payment.label, money(payment.amountCents)),
      detail: payment.quoteNumber,
      dueOn: payment.dueDate,
      since: null,
      actor: { kind: "client" },
      href: `/devis/${payment.quoteId}#echeancier`,
      action: { kind: "open" },
    });
  }
  for (const quote of await listQuotesAwaitingAnswer(organizationId, delays.quoteFollowUpDays, now)) {
    items.push({
      key: `quote:${quote.quoteId}`,
      kind: "quote_follow_up",
      eventId: quote.eventId,
      eventNames: names(quote.eventId),
      title: words.quoteFollowUp(quote.number),
      dueOn: null,
      since: day(quote.sentAt),
      actor: { kind: "client" },
      href: `/devis/${quote.quoteId}`,
      action: { kind: "open" },
    });
  }
  for (const deposit of await listOpenScheduledDeposits(organizationId)) {
    if (deposit.status !== "blocked") continue;
    items.push({
      key: `deposit:${deposit.quoteId}`,
      kind: "deposit_blocked",
      eventId: deposit.eventId,
      eventNames: names(deposit.eventId),
      title: words.depositBlocked(deposit.quoteNumber),
      dueOn: null,
      since: null,
      actor: { kind: "you" },
      href: `/devis/${deposit.quoteId}#invoices-title`,
      action: { kind: "open" },
    });
  }
  return items;
}

async function budgetItems({ organizationId, words, today, names, money }: Context): Promise<TodayItem[]> {
  const items: TodayItem[] = [];
  for (const payment of await listUpcomingVendorPayments(organizationId, today)) {
    items.push({
      key: `vendor-payment:${payment.id}`,
      kind: "vendor_payment",
      eventId: payment.eventId,
      eventNames: payment.eventName || names(payment.eventId),
      title: words.amount(payment.vendorName ? `${payment.label} · ${payment.vendorName}` : `${payment.label} · ${payment.lineLabel}`, money(payment.amountCents)),
      dueOn: payment.dueOn,
      since: null,
      actor: { kind: "client" },
      href: `/events/${payment.eventId}?onglet=budget`,
      action: { kind: "open" },
    });
  }
  for (const declaration of await listPendingPaymentDeclarations(organizationId)) {
    items.push({
      key: `declaration:${declaration.paymentId}`,
      kind: "payment_declaration",
      eventId: declaration.eventId,
      eventNames: names(declaration.eventId),
      title: words.paymentDeclaration(declaration.label, money(declaration.amountCents)),
      dueOn: null,
      since: day(declaration.declaredAt),
      actor: { kind: "you" },
      href: `/events/${declaration.eventId}?onglet=budget`,
      action: { kind: "open" },
    });
  }
  return items;
}

export async function loadTodayItems(
  organizationId: string,
  modules: TodayModules,
  words: TodayWords,
  locale: Locale,
  now: Date = new Date(),
  timeoutMs: number = TODAY_SOURCE_TIMEOUT_MS,
): Promise<{ items: TodayItem[]; today: string; events: EventSummary[]; unavailable: TodaySource[] }> {
  const today = parisToday(now);
  const unavailable: TodaySource[] = [];
  const listed = modules.events ? await settleWithin(() => listEvents({ organizationId }), timeoutMs, "events") : { ok: true as const, value: [] };
  if (!listed.ok) unavailable.push("events");
  const events = listed.ok ? listed.value : [];
  const namesOf = new Map(events.map((event) => [event.id, eventNames(event.clients)]));
  const context: Context = {
    organizationId,
    words,
    today,
    now,
    events,
    names: (eventId) => (eventId ? (namesOf.get(eventId) ?? null) : null),
    money: (cents) => formatAmount(cents, locale),
    delays: await getFollowUpDelays(appDatabase(), organizationId),
  };
  const sources: [TodaySource, boolean, (context: Context) => Promise<TodayItem[]>][] = [
    ["events", modules.events && listed.ok, eventItems],
    ["quotes", modules.quotes, quoteItems],
    ["budget", modules.budget, budgetItems],
    ["guests", Boolean(modules.guests) && modules.events && listed.ok, guestItems],
  ];
  const settled = await Promise.all(
    sources.map(async ([source, enabled, collect]) => [source, enabled ? await settleWithin(() => collect(context), timeoutMs, source) : { ok: true as const, value: [] }] as const),
  );
  const items: TodayItem[] = [];
  for (const [source, result] of settled) {
    if (result.ok) items.push(...result.value);
    else if (!unavailable.includes(source)) unavailable.push(source);
  }
  return { items: await withoutQuotedOptions(items, organizationId, modules.quotes, timeoutMs), today, events, unavailable };
}

// Lot 34a (EVT-05, D2) : « Devis envoyé » n'est plus un statut ; une option dont le devis est parti
// se relance par son devis (« devis sans réponse »), pas comme prospect sans nouvelle. Sans le
// module Devis, ou s'il ne répond pas, elle reste un prospect à relancer.
async function withoutQuotedOptions(items: TodayItem[], organizationId: string, quotesEnabled: boolean, timeoutMs: number): Promise<TodayItem[]> {
  if (!quotesEnabled || !items.some((item) => item.kind === "prospect_follow_up")) return items;
  const quoted = await settleWithin(() => listEventIdsWithSentQuote(organizationId), timeoutMs, "quotes");
  if (!quoted.ok) return items;
  return items.filter((item) => item.kind !== "prospect_follow_up" || item.eventId === null || !quoted.value.has(item.eventId));
}
