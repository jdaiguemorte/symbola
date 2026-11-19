// Lot 60 (L60-PLA-02, L60-PLA-03 ; D2, D6) — règles pures des plans de salle, partagées par le
// serveur, l'éditeur (navigateur) et le PDF : places proposées, emprise d'un élément tourné,
// contrôles signalés (jamais bloquants), tableau « Électricité », aimantation, pas du clavier,
// fond de plan calibré et échelle normalisée du PDF. Aucune valeur métier ici : la largeur d'une
// place, la grille et les pas viennent des données de départ (floorplan-elements.json).
import type { FloorplanCalibration, FloorplanElement, FloorplanFinding, FloorplanFixture, FloorplanPowerRow, FloorplanSeatRule } from "@symbola/contracts";

export type SeatingRules = { seatWidthCm: number; roundSeatWidthCm: number; endSeatMinDepthCm: number };
export type Point = { x: number; y: number };
type Shaped = Pick<FloorplanElement, "shape" | "xCm" | "yCm" | "widthCm" | "depthCm" | "rotationDeg">;

// Places proposées par la forme et la taille (partie B), puis modifiables élément par élément.
export function proposeSeats(rule: FloorplanSeatRule, widthCm: number, depthCm: number, rules: SeatingRules): number {
  const along = (length: number) => Math.max(0, Math.floor(length / rules.seatWidthCm));
  switch (rule) {
    case "round":
      return Math.max(0, Math.floor((Math.PI * Math.max(widthCm, depthCm)) / rules.roundSeatWidthCm));
    case "two_sides":
      return 2 * along(widthCm) + (depthCm >= rules.endSeatMinDepthCm ? 2 : 0);
    case "one_side":
      return along(widthCm);
    case "four_sides":
      return 2 * along(widthCm) + 2 * along(depthCm);
    case "oval": {
      // Pourtour d'une ellipse (approximation de Ramanujan).
      const a = widthCm / 2;
      const b = depthCm / 2;
      const perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
      return Math.max(0, Math.floor(perimeter / rules.seatWidthCm));
    }
    default:
      return 0;
  }
}

// Capacité d'une configuration : places assises de ses tables.
export function capacityOf(elements: Pick<FloorplanElement, "category" | "seats">[]): number {
  return elements.filter((element) => element.category === "table").reduce((sum, element) => sum + element.seats, 0);
}

// Emprise d'un élément : coins d'un rectangle, ou polygone de 24 côtés pour une ronde ou une ovale,
// tournés autour du centre.
export function footprint(item: Shaped): Point[] {
  const angle = (item.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const w = item.widthCm / 2;
  const d = item.depthCm / 2;
  const local: Point[] =
    item.shape === "rect"
      ? [
          { x: -w, y: -d },
          { x: w, y: -d },
          { x: w, y: d },
          { x: -w, y: d },
        ]
      : Array.from({ length: 24 }, (_, index) => {
          const t = (index / 24) * 2 * Math.PI;
          return { x: w * Math.cos(t), y: d * Math.sin(t) };
        });
  return local.map((point) => ({ x: item.xCm + point.x * cos - point.y * sin, y: item.yCm + point.x * sin + point.y * cos }));
}

// Séparation des axes entre deux polygones convexes. Une marge d'un centimètre : deux tables qui se
// touchent ne se chevauchent pas.
function overlaps(a: Point[], b: Point[]): boolean {
  for (const polygon of [a, b]) {
    for (let index = 0; index < polygon.length; index += 1) {
      const p = polygon[index]!;
      const q = polygon[(index + 1) % polygon.length]!;
      const axis = { x: q.y - p.y, y: p.x - q.x };
      const length = Math.hypot(axis.x, axis.y);
      if (length === 0) continue;
      const project = (points: Point[]) => points.map((point) => (point.x * axis.x + point.y * axis.y) / length);
      const pa = project(a);
      const pb = project(b);
      if (Math.max(...pa) <= Math.min(...pb) + 1 || Math.max(...pb) <= Math.min(...pa) + 1) return false;
    }
  }
  return true;
}

function radius(item: Shaped): number {
  return Math.hypot(item.widthCm, item.depthCm) / 2;
}

function outside(points: Point[], space: { widthCm: number; depthCm: number }): boolean {
  return points.some((point) => point.x < -0.5 || point.y < -0.5 || point.x > space.widthCm + 0.5 || point.y > space.depthCm + 0.5);
}

function distanceM(a: Pick<FloorplanElement, "xCm" | "yCm">, b: Pick<FloorplanFixture, "xCm" | "yCm">): number {
  return Math.round(Math.hypot(a.xCm - b.xCm, a.yCm - b.yCm) / 10) / 10;
}

type PowerElement = Pick<FloorplanElement, "id" | "powerOutlets" | "powerAmps" | "fixtureId" | "maxCableM" | "xCm" | "yCm">;
type PowerFixture = Pick<FloorplanFixture, "id" | "kind" | "label" | "outletCount" | "amps" | "threePhase" | "xCm" | "yCm">;

// Tableau « Électricité » (partie C) : les prises de l'espace, le nombre de prises demandées par ce
// qui s'y branche, et la surcharge déclarée. Jamais une étude électrique (D6).
export function powerTable(fixtures: PowerFixture[], elements: PowerElement[]): FloorplanPowerRow[] {
  return fixtures
    .filter((fixture) => fixture.kind === "outlet")
    .map((fixture) => {
      const plugged = elements.filter((element) => element.fixtureId === fixture.id);
      const used = plugged.reduce((sum, element) => sum + Math.max(1, element.powerOutlets), 0);
      const outletCount = fixture.outletCount ?? 0;
      const amps = fixture.amps ?? 0;
      return {
        fixtureId: fixture.id,
        label: fixture.label,
        outletCount,
        amps,
        threePhase: fixture.threePhase,
        used,
        overloaded: used > outletCount || plugged.some((element) => (element.powerAmps ?? 0) > amps),
        elementIds: plugged.map((element) => element.id),
      };
    });
}

export type LayoutCheckInput = {
  space: { widthCm: number; depthCm: number };
  fixtures: PowerFixture[];
  elements: (Shaped & PowerElement & Pick<FloorplanElement, "category" | "seats">)[];
  expectedGuests: number | null;
};

// Contrôles de la partie B, signalés et jamais bloquants.
export function checkLayout(input: LayoutCheckInput): FloorplanFinding[] {
  const findings: FloorplanFinding[] = [];
  const shapes = input.elements.map((element) => ({ element, points: footprint(element), radius: radius(element) }));
  for (let i = 0; i < shapes.length; i += 1) {
    for (let j = i + 1; j < shapes.length; j += 1) {
      const a = shapes[i]!;
      const b = shapes[j]!;
      if (Math.hypot(a.element.xCm - b.element.xCm, a.element.yCm - b.element.yCm) >= a.radius + b.radius) continue;
      if (overlaps(a.points, b.points)) findings.push({ kind: "overlap", elementIds: [a.element.id, b.element.id] });
    }
  }
  for (const { element, points } of shapes) {
    if (outside(points, input.space)) findings.push({ kind: "outside", elementId: element.id });
  }
  const seats = capacityOf(input.elements);
  if (input.expectedGuests !== null && input.expectedGuests > 0 && seats < input.expectedGuests) findings.push({ kind: "seats_short", seats, expected: input.expectedGuests });
  const outlets = new Map(input.fixtures.filter((fixture) => fixture.kind === "outlet").map((fixture) => [fixture.id, fixture]));
  for (const element of input.elements) {
    if (element.powerOutlets <= 0) continue;
    const fixture = element.fixtureId ? outlets.get(element.fixtureId) : undefined;
    if (!fixture) {
      findings.push({ kind: "power_unlinked", elementId: element.id });
      continue;
    }
    if (element.powerAmps !== null && fixture.amps !== null && element.powerAmps > fixture.amps) {
      findings.push({ kind: "amps_exceeded", elementId: element.id, fixtureId: fixture.id, needed: element.powerAmps, available: fixture.amps });
    }
    if (element.maxCableM !== null) {
      const distance = distanceM(element, fixture);
      if (distance > element.maxCableM) findings.push({ kind: "cable_too_far", elementId: element.id, fixtureId: fixture.id, distanceM: distance, maxM: element.maxCableM });
    }
  }
  for (const row of powerTable(input.fixtures, input.elements)) {
    if (row.used > row.outletCount) findings.push({ kind: "outlet_overloaded", fixtureId: row.fixtureId, used: row.used, available: row.outletCount });
  }
  return findings;
}

// Aimantation sur la grille (désactivable).
export function snapToGrid(valueCm: number, gridCm: number, enabled: boolean): number {
  if (!enabled || gridCm <= 0) return Math.round(valueCm);
  return Math.round(valueCm / gridCm) * gridCm;
}

export type ArrowKey = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight";

// Flèches du clavier : petit pas, grand pas avec Maj.
export function nudge(position: { xCm: number; yCm: number }, key: ArrowKey, large: boolean, steps: { nudgeCm: number; nudgeLargeCm: number }): { xCm: number; yCm: number } {
  const step = large ? steps.nudgeLargeCm : steps.nudgeCm;
  const dx = key === "ArrowLeft" ? -step : key === "ArrowRight" ? step : 0;
  const dy = key === "ArrowUp" ? -step : key === "ArrowDown" ? step : 0;
  return { xCm: position.xCm + dx, yCm: position.yCm + dy };
}

export function clampRotation(degrees: number): number {
  return ((Math.round(degrees) % 360) + 360) % 360;
}

// Taille du fond de plan dans l'espace : à l'échelle de la calibration (deux points et leur distance
// réelle), sinon étendu à la largeur de l'espace et signalé non calibré.
export function backgroundSize(image: { widthPx: number; heightPx: number }, calibration: FloorplanCalibration | null, spaceWidthCm: number): { widthCm: number; heightCm: number; calibrated: boolean } {
  if (calibration) {
    const pixels = Math.hypot(calibration.bx - calibration.ax, calibration.by - calibration.ay);
    const cmPerPx = calibration.distanceCm / pixels;
    return { widthCm: Math.round(image.widthPx * cmPerPx), heightCm: Math.round(image.heightPx * cmPerPx), calibrated: true };
  }
  const cmPerPx = spaceWidthCm / image.widthPx;
  return { widthCm: Math.round(image.widthPx * cmPerPx), heightCm: Math.round(image.heightPx * cmPerPx), calibrated: false };
}

// Échelles normalisées d'un plan imprimé (1:20 à 1:1000).
export const PDF_SCALES = [20, 25, 50, 75, 100, 125, 150, 200, 250, 500, 1000] as const;

// La plus grande échelle (le plus petit dénominateur) qui fait tenir l'espace dans la zone de dessin
// de la page, en millimètres.
export function pdfScale(widthCm: number, depthCm: number, areaWidthMm: number, areaHeightMm: number): number {
  for (const scale of PDF_SCALES) {
    if ((widthCm * 10) / scale <= areaWidthMm && (depthCm * 10) / scale <= areaHeightMm) return scale;
  }
  return PDF_SCALES[PDF_SCALES.length - 1]!;
}
