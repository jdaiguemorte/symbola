// Lot 60 — règles pures des plans de salle : places proposées, contrôles signalés (chevauchement, hors
// de l'espace, places, prises), tableau « Électricité », aimantation et échelle du PDF.
import { describe, expect, it } from "vitest";
import type { FloorplanElement, FloorplanFixture } from "@symbola/contracts";
import { backgroundSize, capacityOf, checkLayout, clampRotation, footprint, nudge, pdfScale, powerTable, proposeSeats, snapToGrid } from "./geometry";

const SEATING = { seatWidthCm: 60, roundSeatWidthCm: 55, endSeatMinDepthCm: 75 };

function element(overrides: Partial<FloorplanElement> & { id: string }): FloorplanElement {
  return {
    elementTypeId: null,
    typeStarterKey: "round_table",
    typeLabel: null,
    category: "table",
    shape: "circle",
    name: null,
    xCm: 500,
    yCm: 500,
    widthCm: 180,
    depthCm: 180,
    rotationDeg: 0,
    seats: 10,
    color: null,
    note: null,
    vendorCandidateId: null,
    powerOutlets: 0,
    powerAmps: null,
    needsWater: false,
    maxCableM: null,
    fixtureId: null,
    ...overrides,
  };
}

function outlet(overrides: Partial<FloorplanFixture> & { id: string }): FloorplanFixture {
  return { kind: "outlet", label: null, xCm: 100, yCm: 20, widthCm: 40, depthCm: 20, rotationDeg: 0, outletCount: 2, amps: 16, threePhase: false, note: null, ...overrides };
}

const SPACE = { widthCm: 2000, depthCm: 1200 };

describe("L60-PLA-02 — Places proposées par la forme et la taille, puis modifiables", () => {
  it("ronde de 180 cm : 10 places ; rectangulaire 180 × 80 : 6 de côté et 2 en bout", () => {
    expect(proposeSeats("round", 180, 180, SEATING)).toBe(10);
    expect(proposeSeats("two_sides", 180, 80, SEATING)).toBe(8);
    expect(proposeSeats("two_sides", 180, 60, SEATING)).toBe(6);
  });

  it("table d'honneur sur un côté, carrée sur quatre, ovale par son pourtour, mange-debout sans place", () => {
    expect(proposeSeats("one_side", 400, 80, SEATING)).toBe(6);
    expect(proposeSeats("four_sides", 120, 120, SEATING)).toBe(8);
    expect(proposeSeats("oval", 240, 120, SEATING)).toBe(9);
    expect(proposeSeats("none", 70, 70, SEATING)).toBe(0);
  });

  it("capacité calculée : places assises des tables seulement", () => {
    const elements = [element({ id: "a", seats: 10 }), element({ id: "b", seats: 8, xCm: 900 }), element({ id: "dj", category: "setup", seats: 4, xCm: 1500 })];
    expect(capacityOf(elements)).toBe(18);
  });
});

describe("L60-PLA-02 — Contrôles signalés, jamais bloquants", () => {
  it("deux tables qui se chevauchent sont signalées ; deux tables qui se touchent ne le sont pas", () => {
    const findings = checkLayout({ space: SPACE, fixtures: [], elements: [element({ id: "a" }), element({ id: "b", xCm: 600 })], expectedGuests: null });
    expect(findings).toContainEqual({ kind: "overlap", elementIds: ["a", "b"] });
    const touching = checkLayout({ space: SPACE, fixtures: [], elements: [element({ id: "a" }), element({ id: "b", xCm: 680 })], expectedGuests: null });
    expect(touching.filter((finding) => finding.kind === "overlap")).toEqual([]);
  });

  it("le chevauchement tient compte de l'angle : un rectangle tourné de 45° dépasse sur son voisin", () => {
    const flat = [element({ id: "a", shape: "rect", widthCm: 200, depthCm: 100, xCm: 500, yCm: 500 }), element({ id: "b", shape: "rect", widthCm: 100, depthCm: 100, xCm: 660, yCm: 500 })];
    expect(checkLayout({ space: SPACE, fixtures: [], elements: flat, expectedGuests: null }).some((finding) => finding.kind === "overlap")).toBe(false);
    const turned = [{ ...flat[0]!, rotationDeg: 45 }, flat[1]!];
    expect(checkLayout({ space: SPACE, fixtures: [], elements: turned, expectedGuests: null }).some((finding) => finding.kind === "overlap")).toBe(false);
    const closer = [{ ...flat[0]!, rotationDeg: 45 }, { ...flat[1]!, xCm: 610 }];
    expect(checkLayout({ space: SPACE, fixtures: [], elements: closer, expectedGuests: null }).some((finding) => finding.kind === "overlap")).toBe(true);
  });

  it("un élément hors de l'espace est signalé, y compris par un coin après rotation", () => {
    expect(checkLayout({ space: SPACE, fixtures: [], elements: [element({ id: "a", xCm: 50 })], expectedGuests: null })).toContainEqual({ kind: "outside", elementId: "a" });
    const square = element({ id: "s", shape: "rect", widthCm: 100, depthCm: 100, xCm: 55, yCm: 500 });
    expect(checkLayout({ space: SPACE, fixtures: [], elements: [square], expectedGuests: null })).toEqual([]);
    expect(checkLayout({ space: SPACE, fixtures: [], elements: [{ ...square, rotationDeg: 45 }], expectedGuests: null })).toContainEqual({ kind: "outside", elementId: "s" });
  });

  it("places assises inférieures au nombre d'invités attendus", () => {
    const elements = [element({ id: "a", seats: 10 })];
    expect(checkLayout({ space: SPACE, fixtures: [], elements, expectedGuests: 12 })).toContainEqual({ kind: "seats_short", seats: 10, expected: 12 });
    expect(checkLayout({ space: SPACE, fixtures: [], elements, expectedGuests: 10 })).toEqual([]);
  });

  it("L60-PLA-03 : un élément qui a un besoin électrique sans prise est signalé", () => {
    const dj = element({ id: "dj", category: "setup", shape: "rect", widthCm: 200, depthCm: 100, seats: 0, powerOutlets: 2, powerAmps: 16 });
    expect(checkLayout({ space: SPACE, fixtures: [], elements: [dj], expectedGuests: null })).toContainEqual({ kind: "power_unlinked", elementId: "dj" });
    expect(checkLayout({ space: SPACE, fixtures: [outlet({ id: "p" })], elements: [{ ...dj, fixtureId: "p" }], expectedGuests: null })).toEqual([]);
  });

  it("L60-PLA-03 : surcharge déclarée d'une prise (plus de prises demandées que disponibles, ampérage supérieur)", () => {
    const dj = element({ id: "dj", category: "setup", shape: "rect", widthCm: 200, depthCm: 100, seats: 0, powerOutlets: 2, powerAmps: 16, fixtureId: "p" });
    const bar = element({ id: "bar", category: "setup", shape: "rect", widthCm: 300, depthCm: 80, seats: 0, xCm: 1200, powerOutlets: 1, powerAmps: 32, fixtureId: "p" });
    const findings = checkLayout({ space: SPACE, fixtures: [outlet({ id: "p", outletCount: 2, amps: 16 })], elements: [dj, bar], expectedGuests: null });
    expect(findings).toContainEqual({ kind: "outlet_overloaded", fixtureId: "p", used: 3, available: 2 });
    expect(findings).toContainEqual({ kind: "amps_exceeded", elementId: "bar", fixtureId: "p", needed: 32, available: 16 });
  });

  it("L60-PLA-03 : distance à la prise supérieure à la longueur de câble déclarée", () => {
    const dj = element({ id: "dj", category: "setup", shape: "rect", widthCm: 200, depthCm: 100, seats: 0, xCm: 1100, yCm: 20, powerOutlets: 1, powerAmps: 16, maxCableM: 5, fixtureId: "p" });
    expect(checkLayout({ space: SPACE, fixtures: [outlet({ id: "p", xCm: 100, yCm: 20 })], elements: [dj], expectedGuests: null })).toContainEqual({ kind: "cable_too_far", elementId: "dj", fixtureId: "p", distanceM: 10, maxM: 5 });
  });

  it("tableau « Électricité » : chaque prise, sa charge et qui s'y branche", () => {
    const dj = element({ id: "dj", category: "setup", seats: 0, powerOutlets: 2, powerAmps: 16, fixtureId: "p" });
    const rows = powerTable([outlet({ id: "p", outletCount: 4 }), outlet({ id: "q" }), { ...outlet({ id: "w" }), kind: "water", outletCount: null, amps: null }], [dj]);
    expect(rows).toEqual([
      { fixtureId: "p", label: null, outletCount: 4, amps: 16, threePhase: false, used: 2, overloaded: false, elementIds: ["dj"] },
      { fixtureId: "q", label: null, outletCount: 2, amps: 16, threePhase: false, used: 0, overloaded: false, elementIds: [] },
    ]);
  });
});

describe("L60-PLA-02 — Aimantation, clavier et échelle", () => {
  it("aimantation sur une grille de 50 cm, désactivable", () => {
    expect(snapToGrid(624, 50, true)).toBe(600);
    expect(snapToGrid(626, 50, true)).toBe(650);
    expect(snapToGrid(626, 50, false)).toBe(626);
  });

  it("flèches : 10 cm, 1 m avec Maj ; R tourne de 15° modulo 360", () => {
    expect(nudge({ xCm: 100, yCm: 100 }, "ArrowRight", false, { nudgeCm: 10, nudgeLargeCm: 100 })).toEqual({ xCm: 110, yCm: 100 });
    expect(nudge({ xCm: 100, yCm: 100 }, "ArrowUp", true, { nudgeCm: 10, nudgeLargeCm: 100 })).toEqual({ xCm: 100, yCm: 0 });
    expect(clampRotation(350 + 15)).toBe(5);
    expect(clampRotation(-15)).toBe(345);
  });

  it("fond de plan calibré par deux points : la distance réelle donne la taille de l'image", () => {
    expect(backgroundSize({ widthPx: 1000, heightPx: 500 }, { ax: 0, ay: 0, bx: 300, by: 400, distanceCm: 1000 }, 3000)).toEqual({ widthCm: 2000, heightCm: 1000, calibrated: true });
    // Sans calibration, l'image s'étend à la largeur de l'espace (signalé « non calibré »).
    expect(backgroundSize({ widthPx: 1000, heightPx: 500 }, null, 3000)).toEqual({ widthCm: 3000, heightCm: 1500, calibrated: false });
  });

  it("emprise d'une ronde : un polygone centré sur l'élément", () => {
    const points = footprint(element({ id: "a", xCm: 0, yCm: 0, widthCm: 200, depthCm: 200 }));
    expect(points.length).toBeGreaterThanOrEqual(16);
    for (const point of points) expect(Math.round(Math.hypot(point.x, point.y))).toBe(100);
  });

  it("PDF à l'échelle : la plus grande échelle normalisée qui fait tenir l'espace", () => {
    expect(pdfScale(2000, 1200, 270, 160)).toBe(75);
    expect(pdfScale(2000, 1200, 200, 120)).toBe(100);
    expect(pdfScale(4000, 2000, 270, 160)).toBe(150);
    expect(pdfScale(500, 300, 270, 160)).toBe(20);
  });
});
