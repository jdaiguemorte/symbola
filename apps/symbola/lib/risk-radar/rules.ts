// Lot 53 (GC-02 ; D7 ; ADR 0095) — règles pures du radar des risques, sans base. Chaque alerte dit sa
// règle, ses faits chiffrés (pour l'explication : « retenu depuis 21 jours sans contrat signé ; seuil :
// 14 jours avant l'évènement ») et l'écran où agir. Les seuils sont des données de l'organisation
// (risk-radar.json au départ). Dates « AAAA-MM-JJ », jours calendaires de Paris. Les évènements
// d'essai, clôturés ou annulés ne produisent rien (l'appelant ne les donne pas).
import type { RiskAlert, RiskRuleKey } from "@symbola/contracts";

export type RiskEvent = { id: string; names: string; eventDate: string | null };
export type RiskFacts = {
  events: Map<string, RiskEvent>;
  uncontracted?: { candidateId: string; eventId: string; vendorName: string; slotLabel: string; since: string | null }[];
  decisions?: { id: string; eventId: string; title: string; dueOn: string | null }[];
  payments?: { scheduleItemId: string; quoteId: string; quoteNumber: string; eventId: string; label: string; dueDate: string; amountCents: number }[];
  milestones?: { taskId: string; eventId: string; label: string; dueDate: string }[];
  roadmaps?: { candidateId: string; eventId: string; vendorName: string; sentAt: string }[];
  // Lot 48 : pièces des prestataires (expiration) et IBAN « à vérifier » ; absents tant que le module ne
  // les donne pas (aucune alerte, ARC-07).
  documents?: { documentId: string; vendorId: string; eventId: string; vendorName: string; label: string; expiresOn: string }[];
  ibans?: { vendorId: string; eventId: string; vendorName: string; since: string }[];
};
export type RiskRuleSetting = { rule: RiskRuleKey; enabled: boolean; thresholdDays: number };

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

export function evaluateRisks(facts: RiskFacts, rules: RiskRuleSetting[], today: string): RiskAlert[] {
  const alerts: RiskAlert[] = [];
  const rule = (key: RiskRuleKey) => rules.find((candidate) => candidate.rule === key && candidate.enabled) ?? null;
  const event = (eventId: string) => facts.events.get(eventId) ?? null;

  const vendors = rule("vendor_without_contract");
  for (const vendor of vendors ? (facts.uncontracted ?? []) : []) {
    const found = event(vendor.eventId);
    if (!found?.eventDate || found.eventDate < today) continue;
    const daysLeft = daysBetween(today, found.eventDate);
    if (daysLeft > vendors!.thresholdDays) continue;
    alerts.push({ rule: "vendor_without_contract", key: `vendor_without_contract:${vendor.candidateId}`, eventId: vendor.eventId, eventNames: found.names, label: `${vendor.vendorName} · ${vendor.slotLabel}`, facts: { vendor: vendor.vendorName, slot: vendor.slotLabel, retainedDays: vendor.since ? Math.max(0, daysBetween(vendor.since, today)) : 0, daysLeft }, thresholdDays: vendors!.thresholdDays, href: `/events/${vendor.eventId}?onglet=prestataires` });
  }

  const decisions = rule("decision_overdue");
  for (const decision of decisions ? (facts.decisions ?? []) : []) {
    const found = event(decision.eventId);
    if (!found || !decision.dueOn) continue;
    const daysLate = daysBetween(decision.dueOn, today);
    if (daysLate <= decisions!.thresholdDays) continue;
    alerts.push({ rule: "decision_overdue", key: `decision_overdue:${decision.id}`, eventId: decision.eventId, eventNames: found.names, label: decision.title, facts: { title: decision.title, daysLate }, thresholdDays: decisions!.thresholdDays, href: `/events/${decision.eventId}?onglet=maries` });
  }

  const documents = rule("document_expired");
  for (const document of documents ? (facts.documents ?? []) : []) {
    const found = event(document.eventId);
    if (!found?.eventDate || found.eventDate < today) continue;
    // Expirée, ou qui expire avant l'évènement (plus le seuil de marge).
    if (daysBetween(document.expiresOn, found.eventDate) < -documents!.thresholdDays) continue;
    alerts.push({ rule: "document_expired", key: `document_expired:${document.documentId}:${document.eventId}`, eventId: document.eventId, eventNames: found.names, label: `${document.vendorName} · ${document.label}`, facts: { vendor: document.vendorName, document: document.label, expiresOn: document.expiresOn }, thresholdDays: documents!.thresholdDays, href: `/prestataires/${document.vendorId}` });
  }

  const payments = rule("payment_overdue");
  for (const payment of payments ? (facts.payments ?? []) : []) {
    const found = event(payment.eventId);
    if (!found) continue;
    const daysLate = daysBetween(payment.dueDate, today);
    if (daysLate < Math.max(1, payments!.thresholdDays)) continue;
    alerts.push({ rule: "payment_overdue", key: `payment_overdue:${payment.scheduleItemId}`, eventId: payment.eventId, eventNames: found.names, label: `${payment.quoteNumber} · ${payment.label}`, facts: { quote: payment.quoteNumber, amountCents: payment.amountCents, daysLate }, thresholdDays: payments!.thresholdDays, href: `/devis/${payment.quoteId}#echeancier` });
  }

  const milestones = rule("milestone_late");
  for (const milestone of milestones ? (facts.milestones ?? []) : []) {
    const found = event(milestone.eventId);
    if (!found) continue;
    const daysLate = daysBetween(milestone.dueDate, today);
    if (daysLate < Math.max(1, milestones!.thresholdDays)) continue;
    alerts.push({ rule: "milestone_late", key: `milestone_late:${milestone.taskId}`, eventId: milestone.eventId, eventNames: found.names, label: milestone.label, facts: { task: milestone.label, daysLate }, thresholdDays: milestones!.thresholdDays, href: `/events/${milestone.eventId}?onglet=taches&tache=${milestone.taskId}` });
  }

  const ibans = rule("iban_to_verify");
  for (const iban of ibans ? (facts.ibans ?? []) : []) {
    const found = event(iban.eventId);
    if (!found) continue;
    const days = daysBetween(iban.since, today);
    if (days < ibans!.thresholdDays) continue;
    alerts.push({ rule: "iban_to_verify", key: `iban_to_verify:${iban.vendorId}`, eventId: iban.eventId, eventNames: found.names, label: iban.vendorName, facts: { vendor: iban.vendorName, days }, thresholdDays: ibans!.thresholdDays, href: `/prestataires/${iban.vendorId}` });
  }

  const roadmaps = rule("roadmap_unconfirmed");
  for (const roadmap of roadmaps ? (facts.roadmaps ?? []) : []) {
    const found = event(roadmap.eventId);
    if (!found) continue;
    const days = daysBetween(roadmap.sentAt.slice(0, 10), today);
    if (days < roadmaps!.thresholdDays) continue;
    alerts.push({ rule: "roadmap_unconfirmed", key: `roadmap_unconfirmed:${roadmap.candidateId}`, eventId: roadmap.eventId, eventNames: found.names, label: roadmap.vendorName, facts: { vendor: roadmap.vendorName, days }, thresholdDays: roadmaps!.thresholdDays, href: `/events/${roadmap.eventId}?onglet=prestataires` });
  }
  return alerts;
}
