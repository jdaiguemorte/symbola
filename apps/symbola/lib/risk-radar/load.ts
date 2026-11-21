// Lot 53 (GC-02 ; D7 ; ADR 0095) — le radar des risques d'une organisation : les faits sont lus dans
// chaque module par son service (ARC-01), jamais dans ses tables ; un module fermé ne donne rien et ne
// produit aucune alerte (ARC-06) ; une source lente ou en panne est ignorée, les autres restent
// (ARC-07). Les règles du lot 48a (pièces des prestataires, IBAN « à vérifier ») lisent le service
// vendors, pour les prestataires retenus des évènements à venir. Les évènements d'essai, clôturés ou
// annulés n'entrent pas dans le radar.
import { appDatabase } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import type { RiskAlert, RiskRuleKey, RiskRuleView } from "@symbola/contracts";
import type { EventSummary } from "@symbola/contracts";
import { eventNames, isInProgress, listEvents, listLatePlannerTasks, listPendingDecisions, listUncontractedVendors, listVendorCandidates, listVendorRoadmapAlerts } from "@/modules/events/service";
import { getVendorsByIds, listPendingBankChecks, listVendorDocumentNotices } from "@/modules/vendors/service";
import { getRiskRules, isModuleEnabled } from "@/modules/hub/service";
import { listUnpaidPayments } from "@/modules/quotes/service";
import { settleWithin } from "../today/settle";
import { evaluateRisks, type RiskFacts } from "./rules";

// Le module dont chaque règle lit ses faits ; null : pas encore de source (lot 48).
const RULE_SOURCES: Record<RiskRuleKey, "events" | "quotes" | "vendors" | null> = {
  vendor_without_contract: "events",
  decision_overdue: "events",
  document_expired: "vendors",
  payment_overdue: "quotes",
  milestone_late: "events",
  iban_to_verify: "vendors",
  roadmap_unconfirmed: "events",
};

export type RiskRadar = { alerts: RiskAlert[]; rules: RiskRuleView[] };

export async function loadRiskRadar(organizationId: string, now: Date = new Date()): Promise<RiskRadar> {
  const db = appDatabase();
  const today = parisToday(now);
  const [eventsOpen, quotesOpen, vendorsOpen, settings] = await Promise.all([isModuleEnabled(db, organizationId, "events"), isModuleEnabled(db, organizationId, "quotes"), isModuleEnabled(db, organizationId, "vendors"), getRiskRules(organizationId)]);
  const open = { events: eventsOpen, quotes: quotesOpen, vendors: vendorsOpen && eventsOpen };
  const rules: RiskRuleView[] = settings.map((setting) => {
    const source = RULE_SOURCES[setting.rule];
    return { ...setting, module: source ?? "vendors", available: source !== null && open[source] };
  });
  // Sans le module Évènements, aucun évènement : aucune alerte.
  if (!eventsOpen) return { alerts: [], rules };
  const events = await settleWithin(() => listEvents({ organizationId }), undefined, "radar:évènements");
  if (!events.ok) return { alerts: [], rules };
  const facts: RiskFacts = {
    events: new Map(events.value.filter((event) => !event.isDemo && isInProgress(event.status)).map((event) => [event.id, { id: event.id, names: eventNames(event.clients, event.name), eventDate: event.eventDate }])),
  };
  const [uncontracted, decisions, milestones, roadmaps, payments] = await Promise.all([
    settleWithin(() => listUncontractedVendors(organizationId, today), undefined, "radar:prestataires"),
    settleWithin(() => listPendingDecisions(organizationId), undefined, "radar:décisions"),
    settleWithin(() => listLatePlannerTasks(organizationId, today), undefined, "radar:jalons"),
    settleWithin(() => listVendorRoadmapAlerts(organizationId, now), undefined, "radar:feuilles de route"),
    quotesOpen ? settleWithin(() => listUnpaidPayments(organizationId, { now }), undefined, "radar:échéances") : Promise.resolve({ ok: false as const }),
  ]);
  if (uncontracted.ok) facts.uncontracted = uncontracted.value;
  if (decisions.ok) facts.decisions = decisions.value.map((decision) => ({ id: decision.id, eventId: decision.eventId, title: decision.title, dueOn: decision.dueOn }));
  if (milestones.ok) facts.milestones = milestones.value.filter((task) => task.isMilestone).map((task) => ({ taskId: task.taskId, eventId: task.eventId, label: task.label, dueDate: task.dueDate }));
  if (roadmaps.ok) facts.roadmaps = roadmaps.value.map((roadmap) => ({ candidateId: roadmap.candidateId, eventId: roadmap.eventId, vendorName: roadmap.vendorName, sentAt: roadmap.sentAt }));
  if (payments.ok) facts.payments = payments.value.overdue.map((payment) => ({ scheduleItemId: payment.scheduleItemId, quoteId: payment.quoteId, quoteNumber: payment.quoteNumber, eventId: payment.eventId, label: payment.label, dueDate: payment.dueDate, amountCents: payment.amountCents }));
  if (open.vendors) {
    const vendorFacts = await settleWithin(() => retainedVendorFacts(organizationId, events.value.filter((event) => facts.events.has(event.id)), today, now), undefined, "radar:prestataires retenus");
    if (vendorFacts.ok) {
      facts.documents = vendorFacts.value.documents;
      facts.ibans = vendorFacts.value.ibans;
    }
  }
  const usable = settings.filter((setting) => rules.find((rule) => rule.rule === setting.rule)?.available);
  return { alerts: evaluateRisks(facts, usable, today), rules };
}

// Lot 48a (PRE-05, PRE-10) : pour chaque évènement à venir, les pièces de ses prestataires retenus
// expirées ou qui expirent avant lui, et leurs IBAN « à vérifier » (rattachés au premier évènement à
// venir où le prestataire est retenu). Lu par les services events et vendors.
async function retainedVendorFacts(organizationId: string, events: EventSummary[], today: string, now: Date): Promise<{ documents: NonNullable<RiskFacts["documents"]>; ibans: NonNullable<RiskFacts["ibans"]> }> {
  const documents: NonNullable<RiskFacts["documents"]> = [];
  const firstEventOf = new Map<string, { eventId: string; eventDate: string }>();
  for (const event of events.filter((candidate) => candidate.eventDate !== null && candidate.eventDate >= today).sort((a, b) => a.eventDate!.localeCompare(b.eventDate!))) {
    const vendorIds = [...new Set((await listVendorCandidates(organizationId, event.id)).filter((candidate) => candidate.outcome === "selected" && candidate.vendorId).map((candidate) => candidate.vendorId!))];
    if (vendorIds.length === 0) continue;
    for (const vendorId of vendorIds) if (!firstEventOf.has(vendorId)) firstEventOf.set(vendorId, { eventId: event.id, eventDate: event.eventDate! });
    for (const notice of await listVendorDocumentNotices(organizationId, { vendorIds, eventDate: event.eventDate, now })) {
      if ((notice.reason !== "expired" && notice.reason !== "lapses_before_event") || !notice.validUntil) continue;
      documents.push({ documentId: notice.documentId, vendorId: notice.vendorId, eventId: event.id, vendorName: notice.vendorName, label: notice.kindLabel, expiresOn: notice.validUntil });
    }
  }
  const pending = await listPendingBankChecks(organizationId, [...firstEventOf.keys()]);
  const names = new Map((await getVendorsByIds(organizationId, [...pending.keys()])).map((vendor) => [vendor.id, vendor.name]));
  const ibans: NonNullable<RiskFacts["ibans"]> = [];
  for (const check of pending.values()) {
    const first = firstEventOf.get(check.vendorId);
    const name = names.get(check.vendorId);
    if (first && name) ibans.push({ vendorId: check.vendorId, eventId: first.eventId, vendorName: name, since: check.changedAt.slice(0, 10) });
  }
  return { documents, ibans };
}
