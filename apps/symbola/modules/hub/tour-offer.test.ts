// Lot 74d (D2, B10, B11 ; L74-D9) — quand une visite se propose ; horloge simulée, à l'heure de Paris.
import { describe, expect, it } from "vitest";
import { nextTourVenue, tourOffer, type TourProgress } from "./tour-offer";

const base = { automatic: false, preference: true, setupDone: true, empty: false };
const at = (iso: string) => new Date(iso);
const postponed = (step: number, updatedAt: string): TourProgress => ({ status: "postponed", step, updatedAt: at(updatedAt) });

describe("L74-74d — Les visites proposées", () => {
  describe("critère 1 — seule la visite de l'accueil s'ouvre seule, une fois, après l'assistant", () => {
    it("s'ouvre à la première venue après l'assistant", () => {
      expect(tourOffer({ ...base, automatic: true, progress: null, now: at("2026-11-25T08:00:00Z") })).toBe("auto");
    });
    it("jamais pendant l'assistant", () => {
      expect(tourOffer({ ...base, automatic: true, setupDone: false, progress: null, now: at("2026-11-25T08:00:00Z") })).toBeNull();
    });
    it("une fois : vue, elle ne revient pas d'elle-même, même sur l'écran vide", () => {
      expect(tourOffer({ ...base, automatic: true, empty: true, progress: { status: "completed", step: 0, updatedAt: at("2026-11-25T08:00:00Z") }, now: at("2026-11-26T08:00:00Z") })).toBeNull();
      expect(tourOffer({ ...base, automatic: true, empty: true, progress: null, now: at("2026-11-25T08:00:00Z") })).toBe("auto");
    });
    it("les autres écrans ne s'ouvrent jamais seuls : ils proposent la ligne", () => {
      expect(tourOffer({ ...base, progress: null, now: at("2026-11-25T08:00:00Z") })).toBe("line");
    });
  });

  describe("critère 2 — la ligne « Découvrir » : trois venues, un écran rempli, jusqu'à « Lancer » ou « Fermer »", () => {
    it("jamais sur un écran vide", () => {
      expect(tourOffer({ ...base, empty: true, progress: null, now: at("2026-11-25T08:00:00Z") })).toBeNull();
    });
    it("disparaît après « Lancer » ou « Fermer » (visite vue)", () => {
      expect(tourOffer({ ...base, progress: { status: "completed", step: 1, updatedAt: at("2026-11-25T08:00:00Z") }, now: at("2026-11-25T09:00:00Z") })).toBeNull();
    });
    it("une venue = un jour différent : recharger dans la journée ne compte pas", () => {
      expect(nextTourVenue(null, at("2026-11-25T08:00:00Z"))).toBe(1);
      expect(nextTourVenue(postponed(1, "2026-11-25T08:00:00Z"), at("2026-11-25T21:00:00Z"))).toBeNull();
      expect(nextTourVenue(postponed(1, "2026-11-25T08:00:00Z"), at("2026-11-26T08:00:00Z"))).toBe(2);
    });
    it("le jour se juge à Paris : 23 h 30 à Paris et minuit et demi le lendemain sont deux venues", () => {
      // 25/11 23 h 30 à Paris = 22 h 30 UTC ; 26/11 0 h 30 à Paris = 23 h 30 UTC le 25.
      expect(nextTourVenue(postponed(1, "2026-11-25T22:30:00Z"), at("2026-11-25T23:30:00Z"))).toBe(2);
    });
    it("passage à l'heure d'été : la veille et le jour même restent distincts", () => {
      // 28/03/2027 : la nuit du passage à l'heure d'été.
      expect(nextTourVenue(postponed(1, "2027-03-27T22:30:00Z"), at("2027-03-28T01:30:00Z"))).toBe(2);
      expect(nextTourVenue(postponed(2, "2027-03-28T01:30:00Z"), at("2027-03-28T20:00:00Z"))).toBeNull();
    });
    it("présente aux trois premières venues, absente à la quatrième", () => {
      expect(tourOffer({ ...base, progress: postponed(2, "2026-11-25T08:00:00Z"), now: at("2026-11-26T08:00:00Z") })).toBe("line");
      // La troisième venue, déjà comptée aujourd'hui : la ligne reste jusqu'au soir.
      expect(tourOffer({ ...base, progress: postponed(3, "2026-11-26T08:00:00Z"), now: at("2026-11-26T18:00:00Z") })).toBe("line");
      expect(tourOffer({ ...base, progress: postponed(3, "2026-11-26T08:00:00Z"), now: at("2026-11-27T08:00:00Z") })).toBeNull();
      expect(nextTourVenue(postponed(3, "2026-11-26T08:00:00Z"), at("2026-11-27T08:00:00Z"))).toBeNull();
    });
    it("une visite vue ne compte plus de venue", () => {
      expect(nextTourVenue({ status: "completed", step: 1, updatedAt: at("2026-11-25T08:00:00Z") }, at("2026-11-27T08:00:00Z"))).toBeNull();
    });
  });

  describe("critère 6 — la préférence coupée retire la ligne et la visite de l'accueil", () => {
    it("ni ligne, ni ouverture d'elle-même", () => {
      expect(tourOffer({ ...base, preference: false, progress: null, now: at("2026-11-25T08:00:00Z") })).toBeNull();
      expect(tourOffer({ ...base, automatic: true, preference: false, progress: null, now: at("2026-11-25T08:00:00Z") })).toBeNull();
    });
  });
});
