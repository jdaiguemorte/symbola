import { describe, expect, it } from "vitest";
import { nextStep, type NextStepInput } from "./next-step";

const base: NextStepInput = {
  status: "confirmed",
  isDemo: false,
  quotesAvailable: true,
  hasSentOrSignedQuote: true,
  taskCount: 12,
  templateCount: 1,
  eventDate: "2027-06-12",
  programItemCount: 4,
  clientAccessCount: 1,
  today: "2026-11-06",
};

describe("EVT-19 — Prochaine étape de la fiche événement", () => {
  it("un prospect sans devis envoyé : envoyer le devis", () => {
    expect(nextStep({ ...base, status: "prospect", hasSentOrSignedQuote: false })).toBe("send_quote");
  });
  it("un prospect sans module Devis, ou dont le devis est parti : rien", () => {
    expect(nextStep({ ...base, status: "prospect", hasSentOrSignedQuote: false, quotesAvailable: false })).toBeNull();
    expect(nextStep({ ...base, status: "prospect" })).toBeNull();
  });
  it("confirmé sans tâches, avec un modèle : appliquer le rétroplanning", () => {
    expect(nextStep({ ...base, taskCount: 0 })).toBe("apply_retroplanning");
  });
  it("confirmé, programme vide à moins de 3 mois : préparer le programme ; à plus de 3 mois, rien à ce titre", () => {
    expect(nextStep({ ...base, programItemCount: 0, eventDate: "2027-02-06" })).toBe("prepare_program");
    expect(nextStep({ ...base, programItemCount: 0, eventDate: "2027-02-07" })).toBeNull();
  });
  it("confirmé sans accès mariés : inviter les mariés", () => {
    expect(nextStep({ ...base, clientAccessCount: 0 })).toBe("invite_clients");
  });
  it("une seule étape à la fois, dans l'ordre rétroplanning, programme, mariés", () => {
    expect(nextStep({ ...base, taskCount: 0, programItemCount: 0, eventDate: "2026-12-01", clientAccessCount: 0 })).toBe("apply_retroplanning");
  });
  it("devis envoyé, réalisé, perdu ou essai : pas de bandeau", () => {
    for (const status of ["quote_sent", "done", "lost"] as const) expect(nextStep({ ...base, status, taskCount: 0 })).toBeNull();
    expect(nextStep({ ...base, isDemo: true, taskCount: 0 })).toBeNull();
  });
});
