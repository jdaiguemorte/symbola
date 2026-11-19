import { describe, expect, it } from "vitest";
import { RISK_RULES } from "@symbola/contracts";
import { starterRiskRules } from "@symbola/starter-templates";
import { evaluateRisks, type RiskFacts, type RiskRuleSetting } from "./rules";

const EVENT = "11111111-1111-4111-8111-111111111111";
const today = "2027-04-20";
const rules = (overrides: Partial<Record<string, Partial<RiskRuleSetting>>> = {}): RiskRuleSetting[] =>
  RISK_RULES.map((rule) => ({ rule, enabled: true, thresholdDays: starterRiskRules()[rule]!.thresholdDays, ...overrides[rule] }));
const facts = (extra: Partial<RiskFacts> = {}): RiskFacts => ({ events: new Map([[EVENT, { id: EVENT, names: "Léa & Maxime", eventDate: "2027-06-12" }]]), ...extra });

describe("GC-02 — Radar des risques quotidien (lot 53, D7)", () => {
  it("chaque règle a son seuil de départ, en données (risk-radar.json)", () => {
    const starter = starterRiskRules();
    expect(Object.keys(starter).sort()).toEqual([...RISK_RULES].sort());
  });

  it("prestataire retenu sans contrat : alerte à moins de N jours de l'évènement, avec sa règle expliquée", () => {
    const uncontracted = [{ candidateId: "c1", eventId: EVENT, vendorName: "Fleurs & Co", slotLabel: "Fleurs", since: "2027-03-30" }];
    expect(evaluateRisks(facts({ uncontracted }), rules({ vendor_without_contract: { thresholdDays: 30 } }), today)).toEqual([]);
    const [alert] = evaluateRisks(facts({ uncontracted }), rules({ vendor_without_contract: { thresholdDays: 60 } }), today);
    expect(alert).toMatchObject({ rule: "vendor_without_contract", eventNames: "Léa & Maxime", thresholdDays: 60, facts: { retainedDays: 21, daysLeft: 53, vendor: "Fleurs & Co" }, href: `/events/${EVENT}?onglet=prestataires` });
  });

  it("décision du client en attente au-delà de son échéance", () => {
    const decisions = [{ id: "d1", eventId: EVENT, title: "Choix du traiteur", dueOn: "2027-04-19" }, { id: "d2", eventId: EVENT, title: "Sans date", dueOn: null }];
    expect(evaluateRisks(facts({ decisions }), rules(), today).map((alert) => [alert.key, alert.facts.daysLate])).toEqual([["decision_overdue:d1", 1]]);
    expect(evaluateRisks(facts({ decisions }), rules({ decision_overdue: { thresholdDays: 3 } }), today)).toEqual([]);
  });

  it("échéance impayée, jalon en retard, feuille de route non confirmée, chacune avec son seuil", () => {
    const found = evaluateRisks(
      facts({
        payments: [{ scheduleItemId: "p1", quoteId: "q1", quoteNumber: "D-2027-0042", eventId: EVENT, label: "Acompte", dueDate: "2027-04-15", amountCents: 120000 }],
        milestones: [{ taskId: "t1", eventId: EVENT, label: "Contrat traiteur signé", dueDate: "2027-04-18" }],
        roadmaps: [{ candidateId: "c2", eventId: EVENT, vendorName: "DJ Nova", sentAt: "2027-04-16T08:00:00.000Z" }],
      }),
      rules(),
      today,
    );
    expect(found.map((alert) => alert.rule).sort()).toEqual(["milestone_late", "payment_overdue", "roadmap_unconfirmed"]);
    expect(found.find((alert) => alert.rule === "payment_overdue")!.facts).toMatchObject({ daysLate: 5, amountCents: 120000 });
  });

  it("une règle coupée ne produit rien ; les seuils réglés changent le résultat", () => {
    const payments = [{ scheduleItemId: "p1", quoteId: "q1", quoteNumber: "D-1", eventId: EVENT, label: "Solde", dueDate: "2027-04-15", amountCents: 100 }];
    expect(evaluateRisks(facts({ payments }), rules({ payment_overdue: { enabled: false } }), today)).toEqual([]);
    expect(evaluateRisks(facts({ payments }), rules({ payment_overdue: { thresholdDays: 10 } }), today)).toEqual([]);
  });

  it("les règles du lot 48 (pièces, IBAN à vérifier) restent sans alerte tant que le module ne donne rien", () => {
    expect(evaluateRisks(facts(), rules(), today)).toEqual([]);
    const documents = [{ documentId: "doc", vendorId: "v1", eventId: EVENT, vendorName: "Fleurs & Co", label: "Attestation RC Pro", expiresOn: "2027-05-01" }];
    expect(evaluateRisks(facts({ documents }), rules(), today).map((alert) => alert.rule)).toEqual(["document_expired"]);
  });

  it("un évènement inconnu (d'essai, clos, d'une autre organisation) ne produit rien", () => {
    const other = "22222222-2222-4222-8222-222222222222";
    expect(evaluateRisks(facts({ decisions: [{ id: "d", eventId: other, title: "x", dueOn: "2027-01-01" }] }), rules(), today)).toEqual([]);
  });
});
