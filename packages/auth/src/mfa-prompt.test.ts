import { describe, expect, it } from "vitest";
import { isMfaPromptDue, MFA_PROMPT_INTERVAL_MS } from "./mfa-prompt";

const now = new Date("2027-03-15T09:00:00Z");
const daysAgo = (days: number) => new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

describe("SEC-02 (lot 52, D5) — Bandeau « Sécurisez votre compte »", () => {
  it("proposé à une Planner sans second facteur qui ne l'a jamais fermé", () => {
    expect(isMfaPromptDue({ role: "member", mfaEnabled: false, dismissedAt: null, now })).toBe(true);
  });

  it("fermé, il revient au plus une fois par mois (veille du mois : non ; jour même : oui)", () => {
    expect(MFA_PROMPT_INTERVAL_MS).toBe(30 * 24 * 60 * 60 * 1000);
    expect(isMfaPromptDue({ role: "member", mfaEnabled: false, dismissedAt: daysAgo(29), now })).toBe(false);
    expect(isMfaPromptDue({ role: "member", mfaEnabled: false, dismissedAt: daysAgo(30), now })).toBe(true);
  });

  it("jamais à celle qui a un facteur installé", () => {
    expect(isMfaPromptDue({ role: "member", mfaEnabled: true, dismissedAt: null, now })).toBe(false);
  });

  it("jamais pour la Propriétaire, le Comptable ni l'Exploitation : elle leur est exigée", () => {
    for (const role of ["owner", "accountant", "admin"] as const) expect(isMfaPromptDue({ role, mfaEnabled: false, dismissedAt: null, now })).toBe(false);
  });
});
