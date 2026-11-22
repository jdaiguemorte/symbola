// Lot 63f (HUB-11, HUB-10 ; ADR 0104) — à la fin d'un tutoriel, retour à l'écran d'où il a été
// lancé : une adresse relative de l'app seulement, jamais une redirection ouverte.
import { describe, expect, it } from "vitest";
import { originFromReferer, safeOrigin, withTutorialDone } from "./tutorial-origin";

describe("HUB-11 — Tutoriel : retour à l'écran de départ", () => {
  it("garde une adresse relative de l'app, avec sa recherche", () => {
    expect(safeOrigin("/events?statut=confirme")).toBe("/events?statut=confirme");
    expect(safeOrigin("/")).toBe("/");
  });

  it("refuse une adresse d'un autre site, protocolaire ou à double barre", () => {
    for (const value of ["https://exemple.test/", "//exemple.test", "/\\exemple.test", "javascript:alert(1)", "events", "", null, undefined]) {
      expect(safeOrigin(value), String(value)).toBeNull();
    }
  });

  it("ne revient jamais sur la page du tutoriel lui-même", () => {
    expect(safeOrigin("/aide/tutoriels/quote-signature")).toBeNull();
  });

  it("lit l'écran de départ dans l'en-tête Referer, seulement s'il vient de l'app", () => {
    expect(originFromReferer("http://localhost:3000/devis?page=2", "localhost:3000")).toBe("/devis?page=2");
    expect(originFromReferer("https://ailleurs.test/devis", "localhost:3000")).toBeNull();
    expect(originFromReferer("pas une adresse", "localhost:3000")).toBeNull();
    expect(originFromReferer(null, "localhost:3000")).toBeNull();
  });

  it("ajoute à l'écran de départ le signal « tutoriel terminé »", () => {
    expect(withTutorialDone("/", "catalog")).toBe("/?tutoriel-termine=catalog");
    expect(withTutorialDone("/events?statut=confirme", "event-page")).toBe("/events?statut=confirme&tutoriel-termine=event-page");
    expect(withTutorialDone("/events?tutoriel-termine=catalog", "event-page")).toBe("/events?tutoriel-termine=event-page");
  });
});
