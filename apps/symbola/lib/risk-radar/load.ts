// Lot 53 (GC-02 ; D7 ; ADR 0095) — le radar des risques d'une organisation : les faits sont lus dans
// chaque module par son service (ARC-01), jamais dans ses tables ; un module fermé ne donne rien et ne
// produit aucune alerte (ARC-06) ; une source lente ou en panne est ignorée, les autres restent
// (ARC-07). Les règles du lot 48 (pièces des prestataires, IBAN « à vérifier ») n'ont pas encore de
// source : elles sont « indisponibles » et ne produisent rien. Les évènements d'essai, clôturés ou
// annulés n'entrent pas dans le radar.
import { appDatabase } from "@symbola/db/client";
import { parisToday } from "@symbola/i18n";
import type { RiskAlert, RiskRuleKey, RiskRuleView } from "@symbola/contracts";
import { eventNames, isInProgress, listEvents, listLatePlannerTasks, listPendingDecisions, listUncontractedVendors, listVendorRoadmapAlerts } from "@/modules/events/service";
import { getRiskRules, isModuleEnabled } from "@/modules/hub/service";
import { listUnpaidPayments } from "@/modules/quotes/service";
import { settleWithin } from "../today/settle";
import { evaluateRisks, type RiskFacts } from "./rules";

// Le module dont chaque règle lit ses faits ; null : pas encore de source (lot 48).
const RULE_SOURCES: Record<RiskRuleKey, "events" | "quotes" | null> = {
  vendor_without_contract: "events",
  decision_overdue: "events",
  document_expired: null,
  payment_overdue: "quotes",
  milestone_late: "events",
  iban_to_verify: null,
  roadmap_unconfirmed: "events",
};

export type RiskRadar = { alerts: RiskAlert[]; rules: RiskRuleView[] };

export async function loadRiskRadar(organizationId: string, now: Date = new Date()): Promise<RiskRadar> {
  const db = appDatabase();
  const today = parisToday(now);
  const [eventsOpen, quotesOpen, settings] = await Promise.all([isModuleEnabled(db, organizationId, "events"), isModuleEnabled(db, organizationId, "quotes"), getRiskRules(organizationId)]);
  const open = { events: eventsOpen, quotes: quotesOpen };
  const rules: RiskRuleView[] = settings.map((setting) => {
    const source = RULE_SOURCES[setting.rule];
    return { ...setting, module: source ?? "vendors", available: source !== null && open[source] };
  });
  // Sans le module Évènements, aucun évènement : aucune alerte.
  if (!eventsOpen) return { alerts: [], rules };
  const events = await settleWithin(() => listEvents({ organizationId }), undefined, "radar:évènements");
  if (!events.ok) return { alerts: [], rules };
  const facts: RiskFacts = {
    events: new Map(events.value.filter((event) => !event.isDemo && isInProgress(event.status)).map((event) => [event.id, { id: event.id, names: eventNames(event.clients), eventDate: event.eventDate }])),
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
  const usable = settings.filter((setting) => rules.find((rule) => rule.rule === setting.rule)?.available);
  return { alerts: evaluateRisks(facts, usable, today), rules };
}
