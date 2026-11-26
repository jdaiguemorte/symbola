// Lot 69 (UX-10, NFR-16 ; C-17 de l'audit UX) — « (Today.source.vendors) » : une source de l'accueil
// qui ne répond pas se dit en mots, jamais par le nom de sa clé de traduction.
import { describe, expect, it } from "vitest";
import enMessages from "@symbola/i18n/messages/en.json";
import frMessages from "@symbola/i18n/messages/fr.json";
import type { TodaySource } from "./load";

// Le compilateur refuse une source de plus qui n'a pas sa ligne ici.
const SOURCES = { events: true, quotes: true, budget: true, guests: true, appointments: true, vendors: true } satisfies Record<TodaySource, true>;

describe("UX-10, NFR-16 — Les sources de l'accueil se lisent en mots (lot 69)", () => {
  for (const [locale, messages] of [["fr", frMessages], ["en", enMessages]] as const) {
    it(`${locale} : chaque source possible a son mot, sans nom technique`, () => {
      const words = messages.Today.source as Record<string, string>;
      for (const source of Object.keys(SOURCES)) {
        expect(words[source], `Today.source.${source} (${locale})`).toBeTypeOf("string");
        expect(words[source]).not.toMatch(/[_.]|source\./);
      }
    });
  }
});
