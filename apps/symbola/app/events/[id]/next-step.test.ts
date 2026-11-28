import { describe, expect, it } from "vitest";
import { eventSuite, pendingSteps, suiteQuote, type SuiteInput } from "./next-step";

const base: SuiteInput = {
  status: "confirmed",
  archived: false,
  isDemo: false,
  quotesAvailable: true,
  quote: { id: "q1", number: "D-2026-001", status: "signed", sentOn: "2026-10-02" },
  taskCount: 12,
  templateCount: 1,
  eventDate: "2027-06-12",
  programItemCount: 4,
  clientLinkCount: 1,
  budgetSimulationPending: false,
  takeoverOpen: false,
  closingDue: false,
  today: "2026-11-06",
};

describe("EVT-02 — Une seule suite par mariage (lot 72e, critère 1 ; C-24, C-55)", () => {
  it("une demande sans devis : envoyer le devis ; avec un brouillon, le même geste le reprend", () => {
    expect(eventSuite({ ...base, status: "option", quote: null })).toEqual({ kind: "send_quote", draftId: null });
    expect(eventSuite({ ...base, status: "option", quote: { id: "q2", number: null, status: "draft", sentOn: null } })).toEqual({ kind: "send_quote", draftId: "q2" });
  });
  it("une demande dont le devis est parti : sa relance, jamais « envoyer le devis »", () => {
    expect(eventSuite({ ...base, status: "option", quote: { id: "q3", number: "D-7", status: "sent", sentOn: "2026-11-02" } })).toEqual({ kind: "follow_quote", quoteId: "q3", number: "D-7", sentOn: "2026-11-02" });
  });
  it("une demande dont le devis est signé : le passage en signé, jamais « faire signer »", () => {
    expect(eventSuite({ ...base, status: "option" })).toEqual({ kind: "quote_signed", quoteId: "q1", number: "D-2026-001" });
  });
  it("une demande sans le module Devis : ses points, sans geste de devis (ARC-06)", () => {
    expect(eventSuite({ ...base, status: "option", quotesAvailable: false, quote: null })).toEqual({ kind: "enquiry" });
  });
  it("signé sans tâches : créer la liste (rétroplanning s'il y a un modèle ; la date d'abord si elle manque)", () => {
    expect(eventSuite({ ...base, taskCount: 0 })).toEqual({ kind: "create_tasks", withTemplate: true, needsDate: false });
    expect(eventSuite({ ...base, taskCount: 0, templateCount: 0, eventDate: null })).toEqual({ kind: "create_tasks", withTemplate: false, needsDate: true });
  });
  it("en préparation : les points de l'évènement, sans étape quand rien n'attend", () => {
    expect(eventSuite(base)).toEqual({ kind: "lines", steps: [] });
  });
  it("en préparation, une étape en attente est une ligne de la suite (jamais « tout est à jour »)", () => {
    expect(eventSuite({ ...base, clientLinkCount: 0 })).toEqual({ kind: "lines", steps: ["invite_clients"] });
    expect(eventSuite({ ...base, programItemCount: 0, eventDate: "2027-02-06", clientLinkCount: 0, budgetSimulationPending: true })).toEqual({ kind: "lines", steps: ["confirm_budget", "prepare_program", "invite_clients"] });
  });
  it("repris : « À compléter après la reprise » passe devant tout le reste tant qu'il a un point (lot 71f)", () => {
    expect(eventSuite({ ...base, takeoverOpen: true, taskCount: 0, clientLinkCount: 0 })).toEqual({ kind: "takeover" });
    expect(eventSuite({ ...base, status: "option", quote: null, takeoverOpen: true })).toEqual({ kind: "takeover" });
    expect(eventSuite({ ...base, takeoverOpen: true, closingDue: true })).toEqual({ kind: "takeover" });
  });
  it("le lendemain du jour J : « Clôturer l'évènement… », devant les points", () => {
    expect(eventSuite({ ...base, closingDue: true, clientLinkCount: 0 })).toEqual({ kind: "close" });
  });
  it("reporté, annulé, clôturé ou archivé : pas de suite (la frise porte la seule suite, lot 72d)", () => {
    for (const status of ["postponed", "closed", "cancelled"] as const) expect(eventSuite({ ...base, status, taskCount: 0 })).toEqual({ kind: "none" });
    expect(eventSuite({ ...base, archived: true, closingDue: true })).toEqual({ kind: "none" });
  });
  it("un essai guidé : ni étape ni devis à envoyer, ses points seulement", () => {
    expect(eventSuite({ ...base, isDemo: true, taskCount: 0, clientLinkCount: 0 })).toEqual({ kind: "lines", steps: [] });
    expect(eventSuite({ ...base, isDemo: true, status: "option", quote: null })).toEqual({ kind: "enquiry" });
  });
});

describe("L13-EVT-19 — Les étapes de la préparation (règle gardée, devenue des lignes)", () => {
  it("programme vide à moins de 3 mois : à préparer ; à plus de 3 mois, rien à ce titre", () => {
    expect(pendingSteps({ ...base, programItemCount: 0, eventDate: "2027-02-06" })).toEqual(["prepare_program"]);
    expect(pendingSteps({ ...base, programItemCount: 0, eventDate: "2027-02-07" })).toEqual([]);
  });
  it("sans accès des mariés : les inviter", () => {
    expect(pendingSteps({ ...base, clientLinkCount: 0 })).toEqual(["invite_clients"]);
  });
});

describe("EVT-02 — Le devis qui dit où en est la demande", () => {
  it("signé passe devant envoyé, envoyé devant brouillon ; refusé ou expiré ne compte pas", () => {
    expect(suiteQuote([])).toBeNull();
    expect(suiteQuote([{ id: "a", number: "1", status: "declined" }])).toBeNull();
    expect(suiteQuote([{ id: "a", number: "1", status: "draft" }, { id: "b", number: "2", status: "sent", sentAt: "2026-11-02T09:00:00Z" }])).toEqual({ id: "b", number: "2", status: "sent", sentOn: "2026-11-02" });
    expect(suiteQuote([{ id: "b", number: "2", status: "sent" }, { id: "c", number: "3", status: "signed" }])?.status).toBe("signed");
  });
});
