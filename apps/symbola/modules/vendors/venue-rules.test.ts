import { starterVenueRules } from "@symbola/starter-templates";
import { describe, expect, it } from "vitest";
import { checkCapacity, checkProgramAgainstVenue, type VenueSequence } from "./venue-rules";

const rules = starterVenueRules();
const venue = { vendorId: "v1", name: "Château de Lilas", values: { music_end: "01:00", guests_departure: "02:00", vendor_access_start: "08:00", vendor_access_end: "03:00", decibel_limit: 95 } };

function sequence(id: string, startTime: string, endTime: string | null, scopes: { music?: boolean; vendors?: boolean } = {}): VenueSequence {
  return { id, startTime, endTime, music: scopes.music ?? false, withVendors: scopes.vendors ?? scopes.music ?? false };
}

describe("PRE-06 — Contraintes du lieu et contrôles du chrono", () => {
  it("une séquence de musique après l'heure de fin de la musique est signalée, avec sa règle", () => {
    const findings = checkProgramAgainstVenue(venue, [sequence("dj", "22:30", "02:00", { music: true })], rules);
    expect(findings).toContainEqual({ itemId: "dj", ruleKey: "music_end", venueName: "Château de Lilas", limit: "01:00", vendorId: "v1" });
  });

  it("ce qui finit à l'heure exacte n'est pas signalé ; la nuit se compte après minuit", () => {
    expect(checkProgramAgainstVenue(venue, [sequence("dj", "22:30", "01:00", { music: true })], rules)).toEqual([]);
    expect(checkProgramAgainstVenue(venue, [sequence("dj", "23:00", "00:30", { music: true })], rules)).toEqual([]);
  });

  it("la fin de la musique ne vise que les séquences de musique ; le départ des invités vise tout", () => {
    const findings = checkProgramAgainstVenue(venue, [sequence("bar", "23:00", "02:30")], rules);
    expect(findings.map((finding) => finding.ruleKey)).toEqual(["guests_departure"]);
  });

  it("une livraison avant l'accès des prestataires est signalée", () => {
    const findings = checkProgramAgainstVenue(venue, [sequence("livraison", "07:00", "07:30", { vendors: true })], rules);
    expect(findings).toEqual([{ itemId: "livraison", ruleKey: "vendor_access_start", venueName: "Château de Lilas", limit: "08:00", vendorId: "v1" }]);
  });

  it("sans contrainte saisie, aucun contrôle ; un contrôle n'empêche jamais rien (signalement seul)", () => {
    expect(checkProgramAgainstVenue({ ...venue, values: {} }, [sequence("dj", "22:00", "04:00", { music: true })], rules)).toEqual([]);
  });

  it("le nombre d'invités au-delà de la capacité assise est signalé", () => {
    expect(checkCapacity({ ...venue, values: { capacity_seated: 120 } }, 130, rules)).toEqual({ ruleKey: "capacity_seated", limit: 120, guests: 130, venueName: "Château de Lilas", vendorId: "v1" });
    expect(checkCapacity({ ...venue, values: { capacity_seated: 120 } }, 120, rules)).toBeNull();
    expect(checkCapacity({ ...venue, values: { capacity_standing: 200 } }, 210, rules)).toMatchObject({ ruleKey: "capacity_standing", limit: 200 });
    expect(checkCapacity({ ...venue, values: {} }, 500, rules)).toBeNull();
  });
});
