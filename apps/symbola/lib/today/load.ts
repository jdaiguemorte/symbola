// Lot 32a (HUB-08, UX-01, UX-06, EVT-02 ; décisions D2 à D4, D6) — tout ce qui demande une action,
// tous évènements confondus, assemblé depuis les modules par leur porte d'entrée (ADR 0011). Chaque
// module souscrit apporte sa source ; sans lui, elle disparaît (ARC-06) ; lente ou en panne, elle
// est « indisponible » et les autres restent (ARC-07, settle.ts). Le tri est dans rank.ts ; les
// mots viennent de l'appelant (traductions), pour que l'assemblage se teste sans écran.
import { appDatabase } from "@symbola/db/client";
import { formatAmount, formatDateTime, parisToday, type Locale } from "@symbola/i18n";
import type { EventSummary } from "@symbola/contracts";
import { listPendingPaymentDeclarations, listUpcomingVendorPayments } from "@/modules/budget/service";
import {
  eventNames,
  listVendorCandidates,
  listEvents,
  listOrganizationTasks,
  listPendingDecisions,
  listPendingLinkRenewals,
  listStaleProspects,
  listEngagedChoiceNotices,
  listVendorAnswerNotices,
  listVendorRoadmapAlerts,
  listUncontractedVendors, isInProgress,
  countProspectRequestsToReview,
  listNewProspectRequests,
  listFinishedUnseenQuestionnaires,
  listReadyFollowUps,
} from "@/modules/events/service";
import { countDuplicatePairs, getFollowUpDelays } from "@/modules/hub/service";
import { listGuestPurgeNotices, listRecentOppositions } from "@/modules/guests/service";
import { listEventIdsWithSentQuote, listOpenScheduledDeposits, listQuotesAwaitingAnswer, listTransferDeclarations, listUnpaidPayments } from "@/modules/quotes/service";
import { listCalendarSourcesInError, listTodayAppointments } from "@/modules/appointments/service";
import { getVendorsByIds, listPendingBankChecks, listVendorDocumentNotices } from "@/modules/vendors/service";
import { TODAY_HORIZON_DAYS, type TodayItem } from "./rank";
import { settleWithin, TODAY_SOURCE_TIMEOUT_MS } from "./settle";

// Lot 49 : « guests » (préavis de purge des invités, oppositions), facultatif pour les écrans qui ne
// le demandent pas.
// Lot 46 (HUB-08) : « appointments », le module Rendez-vous (absent = fermé).
export type TodayModules = { events: boolean; quotes: boolean; budget: boolean; guests?: boolean; appointments?: boolean; vendors?: boolean };
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
  // Lot 46 (HUB-08) : « 10:00 · Découverte avec Léa Martin », et ses changements.
  appointment?: (time: string, type: string, person: string) => string;
  appointmentChange?: (change: "new" | "rescheduled" | "cancelled", time: string, type: string, person: string) => string;
  calendarSourceError?: (label: string) => string;
  // Lot 44 (CRM-01, PAR-02) : nouvelle demande du formulaire (« Léa M., 12 juin 2027 »), date déjà
  // prise, demandes « à vérifier ».
  prospectRequest?: (names: string, when: string | null) => string;
  prospectRequestDateTaken?: string;
  prospectToReview?: (count: number) => string;
  // Lot 47 (PAR-05) : réponse d'un prestataire, choix du client engagé, feuille de route non confirmée.
  vendorAnswer?: (vendor: string, slot: string, answer: "available" | "quote" | "unavailable") => string;
  vendorChoice?: (vendor: string, slot: string) => string;
  vendorRoadmap?: (vendor: string) => string;
  // Lot 43 (FAC-08, ADR 0087) : « Léa déclare avoir viré 1 200 € ».
  transferDeclaration?: (name: string, amount: string) => string;
  // Lot 45 (CRM-06, POR-07, CRM-07) : « Relancer Léa M. : prête, à relire », « Léa a terminé le
  // questionnaire Découverte », « 2 doublons possibles ».
  followUpReady?: (names: string) => string;
  questionnaireFinished?: (names: string, questionnaire: string) => string;
  contactDuplicates?: (count: number) => string;
  // Lot 48a (PRE-05, PRE-10, SEC-27) : pièce expirée, proche de sa fin, expirant avant un évènement
  // où le prestataire est retenu, déposée « à vérifier » ; IBAN changé « à vérifier par un autre canal ».
  vendorDocument?: (vendor: string, document: string, reason: "expired" | "expiring" | "lapses_before_event" | "to_verify") => string;
  vendorBankCheck?: (vendor: string) => string;
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
  locale: Locale;
  delays: { prospectFollowUpDays: number; quoteFollowUpDays: number };
};

async function eventItems({ organizationId, words, locale, today, now, events, names, delays }: Context): Promise<TodayItem[]> {
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
  // Lot 47 (PAR-05 ; D3, D6, D8) : ce qu'ont fait les prestataires et les clients par leur lien.
  if (words.vendorAnswer) {
    for (const notice of await listVendorAnswerNotices(organizationId, now)) {
      items.push({
        key: `vendor-answer:${notice.candidateId}`,
        kind: "vendor_answer",
        eventId: notice.eventId,
        eventNames: names(notice.eventId),
        title: words.vendorAnswer(notice.vendorName, notice.slotLabel, notice.availability === "unavailable" ? "unavailable" : notice.hasQuote ? "quote" : "available"),
        dueOn: null,
        since: day(notice.answeredAt),
        actor: { kind: "you" },
        href: `/events/${notice.eventId}/consultation/${notice.vendorSlotId}`,
        action: { kind: "open" },
      });
    }
  }
  if (words.vendorChoice) {
    for (const notice of await listEngagedChoiceNotices(organizationId, now)) {
      items.push({
        key: `vendor-choice:${notice.decisionId}`,
        kind: "vendor_choice",
        eventId: notice.eventId,
        eventNames: names(notice.eventId),
        title: words.vendorChoice(notice.vendorName, notice.slotLabel),
        dueOn: null,
        since: day(notice.engagedAt),
        actor: { kind: "you" },
        href: `/events/${notice.eventId}/consultation/${notice.vendorSlotId}`,
        action: { kind: "open" },
      });
    }
  }
  if (words.vendorRoadmap) {
    for (const alert of await listVendorRoadmapAlerts(organizationId, now)) {
      items.push({
        key: `vendor-roadmap:${alert.candidateId}`,
        kind: "vendor_roadmap",
        eventId: alert.eventId,
        eventNames: names(alert.eventId),
        title: words.vendorRoadmap(alert.vendorName),
        dueOn: null,
        since: day(alert.sentAt),
        actor: { kind: "vendor", name: alert.vendorName },
        href: `/events/${alert.eventId}?onglet=budget`,
        action: { kind: "open" },
      });
    }
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
  // Lot 44 (CRM-01, PAR-02 étape 1) : la demande du formulaire, tant qu'elle est à la première étape du
  // pipeline, avec le contrôle de disponibilité de la date (CRM-04) ; les demandes « à vérifier ».
  if (words.prospectRequest) {
    const dateFormat = new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
    for (const request of await listNewProspectRequests(organizationId, locale === "en" ? "en" : "fr")) {
      items.push({
        key: `prospect-request:${request.eventId}`,
        kind: "prospect_request",
        eventId: request.eventId,
        eventNames: request.names,
        title: words.prospectRequest(request.names, request.eventDate ? dateFormat.format(new Date(`${request.eventDate}T12:00:00Z`)) : request.period),
        detail: request.dateTaken ? words.prospectRequestDateTaken : undefined,
        dueOn: null,
        since: day(request.receivedAt),
        actor: { kind: "you" },
        href: `/events/${request.eventId}`,
        action: { kind: "open" },
      });
    }
  }
  if (words.prospectToReview) {
    const review = await countProspectRequestsToReview(organizationId);
    if (review.count > 0) {
      items.push({
        key: "prospect-review",
        kind: "prospect_review",
        eventId: null,
        eventNames: null,
        title: words.prospectToReview(review.count),
        dueOn: null,
        since: review.oldest ? day(review.oldest) : null,
        actor: { kind: "you" },
        href: "/events/pipeline#a-verifier",
        action: { kind: "open" },
      });
    }
  }
  // Lot 45 (CRM-06, D2) : les relances prêtes, à relire puis envoyer d'un geste.
  if (words.followUpReady) {
    for (const followUp of await listReadyFollowUps(organizationId, now)) {
      const label = names(followUp.eventId) ?? "";
      items.push({
        key: `follow-up:${followUp.id}`,
        kind: "prospect_follow_up_ready",
        eventId: followUp.eventId,
        eventNames: label,
        title: words.followUpReady(label),
        dueOn: null,
        since: day(followUp.readyAt),
        actor: { kind: "you" },
        href: `/events/${followUp.eventId}/relances/${followUp.id}`,
        action: { kind: "open" },
      });
    }
  }
  // Lot 45 (POR-07, CRM-09) : un questionnaire terminé, à lire (et ses écarts avec la fiche).
  if (words.questionnaireFinished) {
    for (const finished of await listFinishedUnseenQuestionnaires(organizationId)) {
      const label = names(finished.eventId) ?? "";
      items.push({
        key: `questionnaire:${finished.id}`,
        kind: "questionnaire_finished",
        eventId: finished.eventId,
        eventNames: label,
        title: words.questionnaireFinished(label, finished.name),
        dueOn: null,
        since: day(finished.finishedAt),
        actor: { kind: "you" },
        href: `/events/${finished.eventId}/questionnaires`,
        action: { kind: "open" },
      });
    }
  }
  // Lot 45 (CRM-07, D4) : des doublons possibles, jamais fusionnés sans la planner.
  if (words.contactDuplicates) {
    const duplicates = await countDuplicatePairs(organizationId);
    if (duplicates > 0) {
      items.push({ key: "contact-duplicates", kind: "contact_duplicates", eventId: null, eventNames: null, title: words.contactDuplicates(duplicates), dueOn: null, since: null, actor: { kind: "you" }, href: "/contacts/doublons", action: { kind: "open" } });
    }
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
  // Lot 43 (FAC-08, ADR 0087) : virement déclaré par le payeur, à confirmer par l'encaissement existant.
  for (const declaration of await listTransferDeclarations(organizationId)) {
    items.push({
      key: `transfer:${declaration.scheduleItemId}`,
      kind: "transfer_declaration",
      eventId: declaration.eventId,
      eventNames: names(declaration.eventId),
      title: words.transferDeclaration ? words.transferDeclaration(declaration.byName, money(declaration.amountCents)) : words.paymentDeclaration(declaration.label, money(declaration.amountCents)),
      detail: `${declaration.quoteNumber} · ${declaration.reference}`,
      dueOn: null,
      since: day(declaration.declaredAt),
      actor: { kind: "you" },
      href: `/devis/${declaration.quoteId}#reglement-${declaration.scheduleItemId}`,
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

// Lot 46 (HUB-08, D2) — les rendez-vous du jour, ceux pris, reportés ou annulés depuis la veille, et
// les agendas extérieurs en erreur (aucun créneau proposé tant qu'ils ne sont pas relus).
// Lot 48a (PRE-05, PRE-10, SEC-27 ; ADR 0093) : les pièces et les IBAN des prestataires.
async function vendorItems({ organizationId, words, today, now, events }: Context): Promise<TodayItem[]> {
  if (!words.vendorDocument || !words.vendorBankCheck) return [];
  const items: TodayItem[] = [];
  const pending = await listPendingBankChecks(organizationId);
  const named = new Map((await getVendorsByIds(organizationId, [...pending.keys()])).map((vendor) => [vendor.id, vendor.name]));
  for (const check of pending.values()) {
    const name = named.get(check.vendorId);
    if (!name) continue;
    items.push({
      key: `vendor-bank:${check.vendorId}`,
      kind: "vendor_bank_check",
      eventId: null,
      eventNames: null,
      title: words.vendorBankCheck(name),
      dueOn: null,
      since: day(check.changedAt),
      actor: { kind: "you" },
      href: `/prestataires/${check.vendorId}`,
      action: { kind: "open" },
    });
  }
  for (const notice of await listVendorDocumentNotices(organizationId, { now })) {
    items.push({
      key: `vendor-document:${notice.documentId}`,
      kind: "vendor_document",
      eventId: null,
      eventNames: null,
      title: words.vendorDocument(notice.vendorName, notice.kindLabel, notice.reason),
      // Une pièce expirée est en retard ; proche de sa fin ou à vérifier, elle est à traiter maintenant
      // (l'horizon de quatorze jours ne la cacherait pas, l'alerte part à trente jours).
      dueOn: notice.reason === "expired" ? notice.validUntil : null,
      since: null,
      actor: { kind: "you" },
      href: `/prestataires/${notice.vendorId}`,
      action: { kind: "open" },
    });
  }
  // Critère de PRE-05 : la pièce d'un prestataire retenu qui expire avant la date de l'évènement.
  for (const event of events.filter((candidate) => isActiveEvent(candidate) && !candidate.isDemo && candidate.eventDate !== null && candidate.eventDate >= today)) {
    const vendorIds = (await listVendorCandidates(organizationId, event.id)).filter((candidate) => candidate.outcome === "selected" && candidate.vendorId).map((candidate) => candidate.vendorId!);
    if (vendorIds.length === 0) continue;
    for (const notice of (await listVendorDocumentNotices(organizationId, { vendorIds, eventDate: event.eventDate, now })).filter((candidate) => candidate.reason === "lapses_before_event")) {
      items.push({
        key: `vendor-document:${notice.documentId}:${event.id}`,
        kind: "vendor_document",
        eventId: event.id,
        eventNames: eventNames(event.clients),
        title: words.vendorDocument(notice.vendorName, notice.kindLabel, notice.reason),
        // À traiter maintenant : demander la pièce à jour avant le jour J, aussi lointain soit-il.
        dueOn: null,
        since: null,
        actor: { kind: "vendor", name: notice.vendorName },
        href: `/prestataires/${notice.vendorId}`,
        action: { kind: "open" },
      });
    }
  }
  return items;
}

async function appointmentItems({ organizationId, words, today, now, names, locale }: Context): Promise<TodayItem[]> {
  const items: TodayItem[] = [];
  const time = (iso: string) => new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" }).format(new Date(iso));
  for (const appointment of await listTodayAppointments(organizationId, now)) {
    const when = time(appointment.startsAt);
    const isToday = appointment.change === "today";
    items.push({
      key: `appointment:${appointment.id}`,
      kind: isToday ? "appointment" : "appointment_change",
      eventId: appointment.eventId,
      eventNames: names(appointment.eventId),
      title: isToday
        ? (words.appointment?.(when, appointment.typeName, appointment.personName) ?? appointment.typeName)
        : (words.appointmentChange?.(appointment.change as "new" | "rescheduled" | "cancelled", formatDateTime(new Date(appointment.startsAt), locale), appointment.typeName, appointment.personName) ?? appointment.typeName),
      dueOn: isToday ? today : null,
      since: appointment.changedAt ? day(appointment.changedAt) : null,
      actor: { kind: "you" },
      href: `/rendez-vous/${appointment.id}`,
      action: { kind: "open" },
    });
  }
  for (const source of await listCalendarSourcesInError(organizationId)) {
    items.push({
      key: `calendar-source:${source.id}`,
      kind: "calendar_source_error",
      eventId: null,
      eventNames: null,
      title: words.calendarSourceError?.(source.label) ?? source.label,
      dueOn: null,
      since: source.lastSuccessAt ? day(source.lastSuccessAt) : null,
      actor: { kind: "you" },
      href: "/rendez-vous/disponibilites#agendas",
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
    locale,
    delays: await getFollowUpDelays(appDatabase(), organizationId),
  };
  const sources: [TodaySource, boolean, (context: Context) => Promise<TodayItem[]>][] = [
    ["events", modules.events && listed.ok, eventItems],
    ["quotes", modules.quotes, quoteItems],
    ["budget", modules.budget, budgetItems],
    ["guests", Boolean(modules.guests) && modules.events && listed.ok, guestItems],
    ["appointments", modules.appointments === true, appointmentItems],
    ["vendors", modules.vendors === true && modules.events && listed.ok, vendorItems],
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
