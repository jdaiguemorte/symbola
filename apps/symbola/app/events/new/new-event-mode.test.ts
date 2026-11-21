import { describe, expect, it } from "vitest";
import { isConfirmedChoice, newEventHref, newEventModeOf, newEventRules, NEW_EVENT_MODES } from "./new-event-mode";

describe("EVT-01, HUB-07 — Créer l'évènement qu'on veut (lot 63c, M7)", () => {
  it("« Nouveau » propose trois choix, chacun avec son adresse (la route existante)", () => {
    expect(NEW_EVENT_MODES.map(newEventHref)).toEqual(["/events/new", "/events/new?type=evenement", "/events/new?type=client"]);
    for (const mode of NEW_EVENT_MODES) expect(newEventModeOf(new URL(newEventHref(mode), "http://x").searchParams.get("type") ?? undefined)).toBe(mode);
  });

  it("un prospect demande un client et une source ; son rétroplanning est proposé décoché", () => {
    expect(newEventRules("prospect", false)).toEqual({ clientRequired: true, existingContactOnly: false, sourceRequired: true, templateCheckedByDefault: false });
    expect(isConfirmedChoice("prospect", "confirmed")).toBe(false);
  });

  it("un évènement confirmé n'exige ni client ni source (un shooting photo) ; son rétroplanning est coché", () => {
    expect(newEventRules("confirmed", true)).toEqual({ clientRequired: false, existingContactOnly: false, sourceRequired: false, templateCheckedByDefault: true });
    expect(isConfirmedChoice("confirmed", null)).toBe(true);
  });

  it("pour un client existant, un contact choisi ; confirmé ou à étudier, au choix", () => {
    expect(newEventRules("client", false)).toMatchObject({ clientRequired: true, existingContactOnly: true, sourceRequired: true, templateCheckedByDefault: false });
    expect(newEventRules("client", true)).toMatchObject({ sourceRequired: false, templateCheckedByDefault: true });
    expect(isConfirmedChoice("client", "confirmed")).toBe(true);
    expect(isConfirmedChoice("client", "option")).toBe(false);
  });

  it("un type inconnu dans l'adresse donne un prospect", () => {
    expect(newEventModeOf("autre")).toBe("prospect");
    expect(newEventModeOf(undefined)).toBe("prospect");
  });
});
