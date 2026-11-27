import { describe, expect, it } from "vitest";
import { phoneTabs } from "./phone-tabs";

const all = { events: true, vendors: true, appointments: true, quotes: true };

describe("UX-05 — Barre du bas du téléphone : quatre entrées et « Plus » (lot 70f, D4)", () => {
  it("toutes souscrites : Aujourd'hui, Évènements, Tâches, Prestataires ; rien d'autre ne monte de « Plus »", () => {
    expect(phoneTabs(all)).toEqual({ tabs: ["today", "events", "tasks", "vendors"], promoted: [] });
  });

  it("jamais plus de quatre entrées, « Plus » en cinquième", () => {
    for (const events of [true, false])
      for (const vendors of [true, false])
        for (const appointments of [true, false])
          for (const quotes of [true, false]) expect(phoneTabs({ events, vendors, appointments, quotes }).tabs.length).toBeLessThanOrEqual(4);
  });
});

describe("ARC-06 — Dégradation propre de la barre du bas (A17)", () => {
  it("Prestataires non souscrit : sa place va à la première entrée de « Plus », Contacts", () => {
    expect(phoneTabs({ ...all, vendors: false })).toEqual({ tabs: ["today", "events", "tasks", "contacts"], promoted: ["contacts"] });
  });

  it("Évènements non souscrit : Évènements et Tâches partent ; Contacts puis Rendez-vous prennent leurs places", () => {
    expect(phoneTabs({ ...all, events: false })).toEqual({ tabs: ["today", "vendors", "contacts", "appointments"], promoted: ["contacts", "appointments"] });
  });

  it("une entrée non souscrite n'est jamais remplacée par une entrée « indisponible » : on saute au module suivant", () => {
    expect(phoneTabs({ events: false, vendors: false, appointments: false, quotes: true })).toEqual({ tabs: ["today", "contacts", "quotes", "payments"], promoted: ["contacts", "quotes", "payments"] });
  });

  it("rien que le noyau : Aujourd'hui et Contacts, sans case vide", () => {
    expect(phoneTabs({ events: false, vendors: false, appointments: false, quotes: false })).toEqual({ tabs: ["today", "contacts"], promoted: ["contacts"] });
  });
});
