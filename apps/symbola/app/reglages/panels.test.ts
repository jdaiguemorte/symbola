import { describe, expect, it } from "vitest";
import { backKeyOf, isSettingsPanelKey, SETTINGS_PANELS, settingsPanelHref, settingsPanelKeyOf } from "./panels";

describe("UX-09, UX-13 — Les réglages sans perdre l'écran (lot 63c, ADR 0107)", () => {
  it("la roue « Réglages » d'un écran mène au panneau de ses réglages, avec l'écran d'où l'on vient", () => {
    expect(settingsPanelHref("/events/parametres", "events")).toBe("/reglages/evenements?retour=events");
    expect(settingsPanelHref("/devis/parametres")).toBe("/reglages/devis");
    for (const [key, path] of Object.entries(SETTINGS_PANELS)) expect(settingsPanelKeyOf(path)).toBe(key);
  });

  it("une page de réglages sans panneau garde son adresse", () => {
    expect(settingsPanelHref("/events/parametres/types")).toBe("/events/parametres/types");
  });

  it("seules des clés connues passent par l'adresse, jamais un nom", () => {
    expect(isSettingsPanelKey("evenements")).toBe(true);
    expect(isSettingsPanelKey("toString")).toBe(false);
    expect(backKeyOf("event")).toBe("event");
    expect(backKeyOf("Mariage Durand")).toBeNull();
    expect(backKeyOf(undefined)).toBeNull();
  });
});
