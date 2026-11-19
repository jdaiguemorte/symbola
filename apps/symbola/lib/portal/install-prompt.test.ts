import { describe, expect, it } from "vitest";
import { dismissInstallPrompt, parseInstallPromptState, recordVisit, shouldOfferInstall } from "./install-prompt";

const DAY = 24 * 60 * 60 * 1000;
const now = Date.UTC(2027, 5, 1, 10);

describe("POR-11 — Proposition d'installation du portail (lot 55)", () => {
  it("rien à la première visite, la proposition à la deuxième", () => {
    let state = parseInstallPromptState(null);
    state = recordVisit(state, true);
    expect(shouldOfferInstall(state, { now, standalone: false })).toBe(false);
    // Une autre page de la même session ne compte pas.
    state = recordVisit(state, false);
    expect(shouldOfferInstall(state, { now, standalone: false })).toBe(false);
    state = recordVisit(state, true);
    expect(state.visits).toBe(2);
    expect(shouldOfferInstall(state, { now, standalone: false })).toBe(true);
  });

  it("refusée, elle se tait 30 jours, puis revient", () => {
    const state = dismissInstallPrompt({ visits: 3, dismissedAt: null }, now);
    expect(shouldOfferInstall(state, { now: now + 29 * DAY, standalone: false })).toBe(false);
    expect(shouldOfferInstall(state, { now: now + 30 * DAY - 1, standalone: false })).toBe(false);
    expect(shouldOfferInstall(state, { now: now + 30 * DAY, standalone: false })).toBe(true);
  });

  it("jamais une fois le portail installé (affichage autonome)", () => {
    expect(shouldOfferInstall({ visits: 5, dismissedAt: null }, { now, standalone: true })).toBe(false);
  });

  it("un état illisible repart de zéro", () => {
    expect(parseInstallPromptState("{pas du json")).toEqual({ visits: 0, dismissedAt: null });
    expect(parseInstallPromptState(JSON.stringify({ visits: -3, dismissedAt: "hier" }))).toEqual({ visits: 0, dismissedAt: null });
  });
});
