"use client";

// Lot 60 (L60-PLA-02, L60-PLA-03 ; D2, D3, D5) — l'éditeur de plan de salle, en SVG dessiné par
// React, sans dépendance. Trois voies équivalentes :
// - le dessin, à la souris et au doigt (événements « pointeur ») : glisser, tourner, redimensionner,
//   aimantation sur la grille (désactivable), sélection multiple (Maj), zoom ;
// - le clavier : Tab passe d'un élément à l'autre, les flèches déplacent de 10 cm (1 m avec Maj),
//   R tourne de 15° (Maj+R dans l'autre sens), Suppr retire, Ctrl+Z et Ctrl+Maj+Z annulent et
//   rétablissent, Ctrl+C, Ctrl+V et Ctrl+D copient, collent et dupliquent ; chaque action est
//   annoncée (role="status") ;
// - le panneau des propriétés et la liste des éléments, équivalente au dessin : la voie du lecteur
//   d'écran et du téléphone (à 375 px, le glisser fin est réservé à la tablette et à l'ordinateur).
// Les contrôles (chevauchement, hors de l'espace, places, prises) sont signalés, jamais bloquants.
// Rien n'est écrit avant « Enregistrer » ; le serveur relit et valide tout.
import { useCallback, useEffect, useId, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type PointerEvent as ReactPointerEvent } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { FloorplanColor, FloorplanElement, FloorplanElementType, FloorplanFinding, FloorplanFixture, FloorplanFixtureKind } from "@symbola/contracts";
import { FLOORPLAN_COLORS, FLOORPLAN_FIXTURE_KINDS } from "@symbola/contracts";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { capacityOf, checkLayout, clampRotation, nudge, powerTable, proposeSeats, snapToGrid, type ArrowKey, type SeatingRules } from "@/modules/floorplans/geometry";
import { PlanDrawing, type DrawnElement, type DrawnFixture } from "./plan-drawing";
import { saveElementsAction, saveFixturesAction } from "./actions";

type FixtureItem = FloorplanFixture & { shape: "rect" };
type Item = FloorplanElement | FixtureItem;
type Mode = "elements" | "fixtures";

export type EditorRules = { gridCm: number; nudgeCm: number; nudgeLargeCm: number; rotationStepDeg: number; maxElements: number };
export type FixtureDefault = { kind: FloorplanFixtureKind; widthCm: number; depthCm: number; outletCount?: number | undefined; amps?: number | undefined };

export type FloorplanEditorProps = {
  mode: Mode;
  layoutId: string | null;
  spaceId: string;
  revision: number;
  title: string;
  space: { widthCm: number; depthCm: number };
  background: { href: string; widthCm: number; heightCm: number; calibrated: boolean } | null;
  fixtures: FloorplanFixture[];
  elements: FloorplanElement[];
  types: FloorplanElementType[];
  vendors: { id: string; name: string }[];
  rules: EditorRules;
  seating: SeatingRules;
  fixtureDefaults: FixtureDefault[];
  ampChoices: number[];
  expectedGuests: number | null;
  isEvent: boolean;
  typeLabels: Record<string, string>;
};

const ZOOMS = [0.5, 0.75, 1, 1.5, 2, 3, 4];
const FIXTURE_MARKS: Record<FloorplanFixtureKind, string> = { outlet: "⚡", water: "💧", door: "", emergency_exit: "⇥", delivery: "⇩", pillar: "", stage: "" };

let counter = 0;
const newId = () => `new-${Date.now().toString(36)}-${(counter += 1)}`;
// Mètres à deux décimales, à la manière de la langue (« 10,50 » ou « 10.50 »), sans séparateur de
// milliers : la même écriture se relit dans les champs.
function metersFormat(locale: string) {
  const format = new Intl.NumberFormat(locale === "en" ? "en-GB" : "fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2, useGrouping: false });
  return (cm: number) => format.format(cm / 100);
}
const toCm = (value: string) => Math.round(Number.parseFloat(value.replace(",", ".")) * 100);

function isFixture(item: Item): item is FixtureItem {
  return "kind" in item;
}

export function FloorplanEditor(props: FloorplanEditorProps) {
  const meters = metersFormat(useLocale());
  const t = useTranslations("Floorplans.editor");
  const tKinds = useTranslations("Floorplans.fixtureKinds");
  const tColors = useTranslations("Floorplans.colors");
  const tFindings = useTranslations("Floorplans.findings");
  const tPower = useTranslations("Floorplans.power");
  const ids = { status: useId(), panel: useId(), list: useId(), sort: useId() };
  const initial: Item[] = props.mode === "fixtures" ? props.fixtures.map((fixture) => ({ ...fixture, shape: "rect" as const })) : props.elements;
  const [items, setItems] = useState<Item[]>(initial);
  const [selected, setSelected] = useState<string[]>([]);
  const [past, setPast] = useState<Item[][]>([]);
  const [future, setFuture] = useState<Item[][]>([]);
  const [snap, setSnap] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState("");
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [revision, setRevision] = useState(props.revision);
  const [clipboard, setClipboard] = useState<Item[]>([]);
  const [sort, setSort] = useState<"order" | "name" | "seats">("order");
  const svgRef = useRef<SVGSVGElement | null>(null);
  const itemRefs = useRef(new Map<string, SVGGElement>());
  const focusAfter = useRef<string | null>(null);
  const drag = useRef<{ kind: "move" | "rotate" | "resize"; id: string; startX: number; startY: number; origin: Item[]; moved: boolean } | null>(null);

  const labelOf = useCallback(
    (item: Item): string => {
      if (isFixture(item)) return item.label ?? tKinds(item.kind);
      const type = item.typeStarterKey ? (props.typeLabels[item.typeStarterKey] ?? item.typeStarterKey) : (item.typeLabel ?? "");
      return item.name ?? type;
    },
    [props.typeLabels, tKinds],
  );
  const typeOf = (item: FloorplanElement) => (item.typeStarterKey ? (props.typeLabels[item.typeStarterKey] ?? item.typeStarterKey) : (item.typeLabel ?? ""));
  const vendorName = (id: string | null) => (id ? (props.vendors.find((vendor) => vendor.id === id)?.name ?? null) : null);

  // Historique : chaque changement garde l'état d'avant (annuler, rétablir).
  const commit = useCallback(
    (next: Item[], message: string, previous: Item[] = items) => {
      setPast((stack) => [...stack.slice(-99), previous]);
      setFuture([]);
      setItems(next);
      setDirty(true);
      setStatus(message);
    },
    [items],
  );

  useEffect(() => {
    if (focusAfter.current) {
      itemRefs.current.get(focusAfter.current)?.focus();
      focusAfter.current = null;
    }
  });

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const elementsNow = props.mode === "elements" ? (items as FloorplanElement[]) : props.elements;
  const fixturesNow: FloorplanFixture[] = props.mode === "fixtures" ? (items as FixtureItem[]).map(({ shape: _shape, ...fixture }) => fixture) : props.fixtures;
  const findings: FloorplanFinding[] = useMemo(
    () => (props.mode === "elements" ? checkLayout({ space: props.space, fixtures: fixturesNow, elements: elementsNow, expectedGuests: props.expectedGuests }) : []),
    [props.mode, props.space, fixturesNow, elementsNow, props.expectedGuests],
  );
  const flagged = new Set(findings.flatMap((finding) => ("elementIds" in finding ? finding.elementIds : "elementId" in finding ? [finding.elementId] : [])));
  const power = props.mode === "elements" ? powerTable(fixturesNow, elementsNow) : [];
  const single = selected.length === 1 ? items.find((item) => item.id === selected[0]) : undefined;
  const outlets = fixturesNow.filter((fixture) => fixture.kind === "outlet");

  const update = (id: string, patch: Partial<FloorplanElement> & Partial<FloorplanFixture>, message?: string) => {
    const next = items.map((item) => (item.id === id ? ({ ...item, ...patch } as Item) : item));
    const item = next.find((entry) => entry.id === id);
    commit(next, message ?? (item ? t("announce.changed", { label: labelOf(item) }) : ""));
  };

  const describe = (item: Item) => t("itemPosition", { label: labelOf(item), x: meters(item.xCm), y: meters(item.yCm), angle: item.rotationDeg });

  // —— Ajouter, retirer, copier ————————————————————————————————————————————————————————————

  const center = () => ({ xCm: snapToGrid(props.space.widthCm / 2, props.rules.gridCm, snap), yCm: snapToGrid(props.space.depthCm / 2, props.rules.gridCm, snap) });

  const addElement = (type: FloorplanElementType) => {
    if (items.length >= props.rules.maxElements) {
      setStatus(t("announce.tooMany"));
      return;
    }
    const element: FloorplanElement = {
      id: newId(),
      elementTypeId: type.id,
      typeStarterKey: type.starterKey,
      typeLabel: type.starterKey ? null : type.label,
      category: type.category,
      shape: type.shape,
      name: null,
      ...center(),
      widthCm: type.widthCm,
      depthCm: type.depthCm,
      rotationDeg: 0,
      seats: proposeSeats(type.seatRule, type.widthCm, type.depthCm, props.seating),
      color: null,
      note: null,
      vendorCandidateId: null,
      powerOutlets: type.powerOutlets,
      powerAmps: type.powerAmps,
      needsWater: type.needsWater,
      maxCableM: null,
      fixtureId: null,
    };
    commit([...items, element], t("announce.added", { label: type.label, x: meters(element.xCm), y: meters(element.yCm) }));
    setSelected([element.id]);
    focusAfter.current = element.id;
  };

  const addFixture = (fixtureDefault: FixtureDefault) => {
    const fixture: FixtureItem = {
      id: newId(),
      kind: fixtureDefault.kind,
      label: null,
      ...center(),
      widthCm: fixtureDefault.widthCm,
      depthCm: fixtureDefault.depthCm,
      rotationDeg: 0,
      outletCount: fixtureDefault.kind === "outlet" ? (fixtureDefault.outletCount ?? 1) : null,
      amps: fixtureDefault.kind === "outlet" ? (fixtureDefault.amps ?? props.ampChoices[0] ?? 16) : null,
      threePhase: false,
      note: null,
      shape: "rect",
    };
    commit([...items, fixture], t("announce.added", { label: tKinds(fixture.kind), x: meters(fixture.xCm), y: meters(fixture.yCm) }));
    setSelected([fixture.id]);
    focusAfter.current = fixture.id;
  };

  const removeSelected = () => {
    if (selected.length === 0) return;
    const gone = items.filter((item) => selected.includes(item.id));
    const next = items.filter((item) => !selected.includes(item.id));
    commit(next, gone.length === 1 ? t("announce.removed", { label: labelOf(gone[0]!) }) : t("announce.removedMany", { count: gone.length }));
    setSelected([]);
  };

  const copySelected = () => {
    const chosen = items.filter((item) => selected.includes(item.id));
    if (chosen.length === 0) return;
    setClipboard(chosen);
    setStatus(t("announce.copied", { count: chosen.length }));
  };

  const paste = (source: Item[] = clipboard) => {
    if (source.length === 0) return;
    if (items.length + source.length > props.rules.maxElements) {
      setStatus(t("announce.tooMany"));
      return;
    }
    const offset = props.rules.gridCm;
    const copies = source.map((item) => ({ ...item, id: newId(), xCm: item.xCm + offset, yCm: item.yCm + offset, ...(isFixture(item) ? {} : { vendorCandidateId: null, fixtureId: null }) }) as Item);
    commit([...items, ...copies], t("announce.pasted", { count: copies.length }));
    setSelected(copies.map((item) => item.id));
    focusAfter.current = copies[0]!.id;
  };

  const undo = () => {
    const previous = past.at(-1);
    if (!previous) return;
    setPast((stack) => stack.slice(0, -1));
    setFuture((stack) => [items, ...stack]);
    setItems(previous);
    setDirty(true);
    setSelected((current) => current.filter((id) => previous.some((item) => item.id === id)));
    setStatus(t("announce.undone"));
  };

  const redo = () => {
    const next = future[0];
    if (!next) return;
    setFuture((stack) => stack.slice(1));
    setPast((stack) => [...stack, items]);
    setItems(next);
    setDirty(true);
    setStatus(t("announce.redone"));
  };

  const align = (how: "left" | "centerX" | "top" | "centerY") => {
    const chosen = items.filter((item) => selected.includes(item.id));
    if (chosen.length < 2) return;
    const target =
      how === "left" ? Math.min(...chosen.map((item) => item.xCm - item.widthCm / 2)) : how === "top" ? Math.min(...chosen.map((item) => item.yCm - item.depthCm / 2)) : how === "centerX" ? chosen[0]!.xCm : chosen[0]!.yCm;
    const next = items.map((item) => {
      if (!selected.includes(item.id)) return item;
      if (how === "left") return { ...item, xCm: Math.round(target + item.widthCm / 2) };
      if (how === "top") return { ...item, yCm: Math.round(target + item.depthCm / 2) };
      if (how === "centerX") return { ...item, xCm: target };
      return { ...item, yCm: target };
    });
    commit(next, t("announce.aligned", { count: chosen.length }));
  };

  // —— Clavier ————————————————————————————————————————————————————————————————————————————

  const onItemKeyDown = (id: string) => (event: ReactKeyboardEvent<SVGGElement>) => {
    const item = items.find((entry) => entry.id === id);
    if (!item) return;
    const mod = event.ctrlKey || event.metaKey;
    if (event.key.startsWith("Arrow")) {
      event.preventDefault();
      const ids = selected.includes(id) ? selected : [id];
      const moved = nudge(item, event.key as ArrowKey, event.shiftKey, props.rules);
      const dx = moved.xCm - item.xCm;
      const dy = moved.yCm - item.yCm;
      const next = items.map((entry) => (ids.includes(entry.id) ? { ...entry, xCm: entry.xCm + dx, yCm: entry.yCm + dy } : entry));
      const after = next.find((entry) => entry.id === id)!;
      commit(next, t("announce.moved", { label: labelOf(after), x: meters(after.xCm), y: meters(after.yCm) }));
      return;
    }
    if ((event.key === "r" || event.key === "R") && !mod) {
      event.preventDefault();
      const step = event.shiftKey ? -props.rules.rotationStepDeg : props.rules.rotationStepDeg;
      const angle = clampRotation(item.rotationDeg + step);
      update(id, { rotationDeg: angle }, t("announce.rotated", { label: labelOf(item), angle }));
      return;
    }
    if (event.key === "Delete" || event.key === "Backspace") {
      event.preventDefault();
      removeSelected();
      return;
    }
    if (event.key === "Escape") {
      setSelected([]);
      setStatus(t("announce.deselected"));
      return;
    }
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      setSelected((current) => (event.shiftKey ? (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]) : [id]));
      document.getElementById(ids.panel)?.querySelector<HTMLInputElement>("input, select")?.focus();
      return;
    }
    if (mod && event.key.toLowerCase() === "z") {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
      return;
    }
    if (mod && event.key.toLowerCase() === "y") {
      event.preventDefault();
      redo();
      return;
    }
    if (mod && event.key.toLowerCase() === "c") {
      event.preventDefault();
      copySelected();
      return;
    }
    if (mod && event.key.toLowerCase() === "v") {
      event.preventDefault();
      paste();
      return;
    }
    if (mod && event.key.toLowerCase() === "d") {
      event.preventDefault();
      paste(items.filter((entry) => selected.includes(entry.id)));
    }
  };

  // —— Pointeur (souris et doigt) ————————————————————————————————————————————————————————————

  const toPlan = (event: { clientX: number; clientY: number }) => {
    const svg = svgRef.current;
    const matrix = svg?.getScreenCTM();
    if (!svg || !matrix) return { x: 0, y: 0 };
    const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
    return { x: point.x, y: point.y };
  };
  const fineDrag = () => typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

  const startDrag = (kind: "move" | "rotate" | "resize", id: string) => (event: ReactPointerEvent<SVGElement>) => {
    if (event.button !== 0) return;
    event.stopPropagation();
    const additive = event.shiftKey && kind === "move";
    setSelected((current) => (additive ? (current.includes(id) ? current : [...current, id]) : current.includes(id) && kind === "move" ? current : [id]));
    if (!fineDrag()) return;
    const point = toPlan(event);
    (event.currentTarget as Element).setPointerCapture(event.pointerId);
    drag.current = { kind, id, startX: point.x, startY: point.y, origin: items, moved: false };
  };

  const onPointerMove = (event: ReactPointerEvent<SVGSVGElement>) => {
    const state = drag.current;
    if (!state) return;
    const point = toPlan(event);
    const origin = state.origin.find((item) => item.id === state.id);
    if (!origin) return;
    if (state.kind === "move") {
      const moving = selected.includes(state.id) ? selected : [state.id];
      const x = snapToGrid(origin.xCm + point.x - state.startX, props.rules.gridCm, snap);
      const y = snapToGrid(origin.yCm + point.y - state.startY, props.rules.gridCm, snap);
      const dx = x - origin.xCm;
      const dy = y - origin.yCm;
      if (dx === 0 && dy === 0 && !state.moved) return;
      state.moved = true;
      setItems(state.origin.map((item) => (moving.includes(item.id) ? { ...item, xCm: item.xCm + dx, yCm: item.yCm + dy } : item)));
    } else if (state.kind === "rotate") {
      const raw = (Math.atan2(point.y - origin.yCm, point.x - origin.xCm) * 180) / Math.PI + 90;
      const angle = clampRotation(snap ? Math.round(raw / props.rules.rotationStepDeg) * props.rules.rotationStepDeg : raw);
      state.moved = true;
      setItems(state.origin.map((item) => (item.id === state.id ? { ...item, rotationDeg: angle } : item)));
    } else {
      const angle = (-origin.rotationDeg * Math.PI) / 180;
      const dx = point.x - origin.xCm;
      const dy = point.y - origin.yCm;
      const localX = Math.abs(dx * Math.cos(angle) - dy * Math.sin(angle));
      const localY = Math.abs(dx * Math.sin(angle) + dy * Math.cos(angle));
      const step = props.rules.nudgeCm;
      let width = Math.max(step, Math.round((2 * localX) / step) * step);
      let depth = Math.max(step, Math.round((2 * localY) / step) * step);
      if (origin.shape === "circle") width = depth = Math.max(width, depth);
      width = Math.min(width, 10000);
      depth = Math.min(depth, 10000);
      state.moved = true;
      setItems(state.origin.map((item) => (item.id === state.id ? { ...item, widthCm: width, depthCm: depth } : item)));
    }
  };

  const endDrag = () => {
    const state = drag.current;
    drag.current = null;
    if (!state?.moved) return;
    const item = items.find((entry) => entry.id === state.id);
    if (!item) return;
    const message =
      state.kind === "move"
        ? t("announce.moved", { label: labelOf(item), x: meters(item.xCm), y: meters(item.yCm) })
        : state.kind === "rotate"
          ? t("announce.rotated", { label: labelOf(item), angle: item.rotationDeg })
          : t("announce.resized", { label: labelOf(item), w: meters(item.widthCm), d: meters(item.depthCm) });
    commit(items, message, state.origin);
  };

  // —— Enregistrer ————————————————————————————————————————————————————————————————————————

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      if (props.mode === "elements" && props.layoutId) {
        const result = await saveElementsAction(props.layoutId, revision, JSON.stringify(items));
        if (!result.ok) {
          setError(result.error);
          return;
        }
        setRevision(result.revision);
      } else {
        const result = await saveFixturesAction(props.spaceId, JSON.stringify(fixturesNow));
        if (!result.ok) {
          setError(result.error);
          return;
        }
      }
      setDirty(false);
      setStatus(t("announce.saved"));
    } finally {
      setSaving(false);
    }
  };

  // —— Dessin ————————————————————————————————————————————————————————————————————————————————

  const drawnFixtures: DrawnFixture[] = fixturesNow.map((fixture) => ({ ...fixture, label: fixture.label ?? tKinds(fixture.kind), mark: FIXTURE_MARKS[fixture.kind], selected: props.mode === "fixtures" && selected.includes(fixture.id) }));
  const drawnElements: DrawnElement[] =
    props.mode === "elements"
      ? elementsNow.map((element) => ({ ...element, label: labelOf(element), selected: selected.includes(element.id), flagged: flagged.has(element.id) }))
      : props.elements.map((element) => ({ ...element, label: labelOf(element) }));

  const interactiveProps = (id: string) => {
    const item = items.find((entry) => entry.id === id);
    return {
      tabIndex: 0,
      role: "button",
      "aria-pressed": selected.includes(id),
      "aria-label": item ? describe(item) : "",
      "aria-describedby": ids.status,
      onPointerDown: startDrag("move", id),
      onKeyDown: onItemKeyDown(id),
      onFocus: () => setSelected((current) => (current.includes(id) ? current : [id])),
      ref: (node: SVGGElement | null) => {
        if (node) itemRefs.current.set(id, node);
        else itemRefs.current.delete(id);
      },
      "data-testid": `plan-item-${id}`,
    };
  };

  const handles = single ? (
      <g transform={`translate(${single.xCm} ${single.yCm}) rotate(${single.rotationDeg})`} className="plan-handles" aria-hidden="true">
        <line x1={0} y1={-single.depthCm / 2} x2={0} y2={-single.depthCm / 2 - 40} />
        <circle cx={0} cy={-single.depthCm / 2 - 40} r={14} className="plan-handle" onPointerDown={startDrag("rotate", single.id)} />
        <rect x={single.widthCm / 2 - 12} y={single.depthCm / 2 - 12} width={24} height={24} className="plan-handle" onPointerDown={startDrag("resize", single.id)} />
      </g>
    ) : null;

  const sortedItems = [...items].sort((a, b) => {
    if (sort === "name") return labelOf(a).localeCompare(labelOf(b), "fr");
    if (sort === "seats" && !isFixture(a) && !isFixture(b)) return b.seats - a.seats;
    return 0;
  });

  const findingText = (finding: FloorplanFinding): string => {
    const name = (id: string) => {
      const item = elementsNow.find((element) => element.id === id);
      return item ? labelOf(item) : "";
    };
    const fixtureName = (id: string) => {
      const fixture = fixturesNow.find((entry) => entry.id === id);
      return fixture ? (fixture.label ?? tKinds(fixture.kind)) : "";
    };
    switch (finding.kind) {
      case "overlap":
        return tFindings("overlap", { a: name(finding.elementIds[0]), b: name(finding.elementIds[1]) });
      case "outside":
        return tFindings("outside", { label: name(finding.elementId) });
      case "seats_short":
        return tFindings("seatsShort", { seats: finding.seats, expected: finding.expected });
      case "power_unlinked":
        return tFindings("powerUnlinked", { label: name(finding.elementId) });
      case "outlet_overloaded":
        return tFindings("outletOverloaded", { outlet: fixtureName(finding.fixtureId), used: finding.used, available: finding.available });
      case "amps_exceeded":
        return tFindings("ampsExceeded", { label: name(finding.elementId), needed: finding.needed, available: finding.available });
      case "cable_too_far":
        return tFindings("cableTooFar", { label: name(finding.elementId), distance: finding.distanceM, max: finding.maxM });
    }
  };

  const capacity = capacityOf(elementsNow);
  const visibleTypes = props.types.filter((type) => !type.hidden);

  return (
    <div className="plan-editor">
      <p id={ids.status} role="status" aria-live="polite" className="plan-status">
        {status}
      </p>
      <div className="plan-toolbar" role="toolbar" aria-label={t("toolbar")}>
        <button type="button" className="button-primary" onClick={save} disabled={saving || !dirty}>
          {saving ? t("saving") : t("save")}
        </button>
        <span className="meta">{dirty ? t("unsaved") : t("allSaved")}</span>
        <button type="button" onClick={undo} disabled={past.length === 0}>
          {t("undo")}
        </button>
        <button type="button" onClick={redo} disabled={future.length === 0}>
          {t("redo")}
        </button>
        <label className="checkbox">
          <input type="checkbox" checked={snap} onChange={(event) => setSnap(event.target.checked)} />
          {t("snap", { grid: meters(props.rules.gridCm) })}
        </label>
        <button type="button" onClick={() => setZoom((value) => ZOOMS[Math.max(0, ZOOMS.indexOf(value) - 1)]!)} aria-label={t("zoomOut")}>
          −
        </button>
        <span className="meta" aria-live="off">
          {t("zoomLevel", { percent: Math.round(zoom * 100) })}
        </span>
        <button type="button" onClick={() => setZoom((value) => ZOOMS[Math.min(ZOOMS.length - 1, ZOOMS.indexOf(value) + 1)]!)} aria-label={t("zoomIn")}>
          +
        </button>
        <button type="button" onClick={() => setZoom(1)}>
          {t("zoomFit")}
        </button>
      </div>
      {error ? (
        <p role="alert" className="plan-error">
          {error}
        </p>
      ) : null}
      <p className="meta">{t("keyboardHelp")}</p>

      <div className="plan-layout">
        <div className="plan-canvas" style={{ ["--plan-zoom" as string]: zoom }}>
          <PlanDrawing
            widthCm={props.space.widthCm}
            depthCm={props.space.depthCm}
            title={props.title}
            background={props.background}
            gridCm={snap ? props.rules.gridCm : null}
            fixtures={drawnFixtures}
            elements={drawnElements}
            fixturesInteractive={props.mode === "fixtures"}
            {...(props.mode === "elements" ? { elementProps: interactiveProps } : { fixtureProps: interactiveProps })}
            overlay={handles}
            svgProps={{
              ref: svgRef,
              onPointerMove,
              onPointerUp: endDrag,
              onPointerCancel: endDrag,
              onPointerDown: () => setSelected([]),
              style: { width: `${zoom * 100}%` },
            }}
          />
          {props.background && !props.background.calibrated ? <p className="meta">{t("notCalibrated")}</p> : null}
        </div>

        <div className="plan-side">
          <section aria-labelledby={`${ids.panel}-add`} className="plan-palette">
            <h2 id={`${ids.panel}-add`}>{t("addTitle")}</h2>
            {props.mode === "elements" ? (
              <>
                <h3>{t("tables")}</h3>
                <div className="row-wrap">
                  {visibleTypes
                    .filter((type) => type.category === "table")
                    .map((type) => (
                      <button key={type.id} type="button" onClick={() => addElement(type)}>
                        {t("add", { label: type.label })}
                      </button>
                    ))}
                </div>
                <h3>{t("setups")}</h3>
                <div className="row-wrap">
                  {visibleTypes
                    .filter((type) => type.category === "setup")
                    .map((type) => (
                      <button key={type.id} type="button" onClick={() => addElement(type)}>
                        {t("add", { label: type.label })}
                      </button>
                    ))}
                </div>
              </>
            ) : (
              <div className="row-wrap">
                {props.fixtureDefaults.map((fixture) => (
                  <button key={fixture.kind} type="button" onClick={() => addFixture(fixture)}>
                    {t("add", { label: tKinds(fixture.kind) })}
                  </button>
                ))}
              </div>
            )}
          </section>

          <section id={ids.panel} aria-labelledby={`${ids.panel}-title`} className="plan-panel">
            <h2 id={`${ids.panel}-title`}>{t("propertiesTitle")}</h2>
            {selected.length > 1 ? (
              <div className="stack">
                <p>{t("selectedMany", { count: selected.length })}</p>
                <div className="row-wrap">
                  <button type="button" onClick={() => align("left")}>
                    {t("alignLeft")}
                  </button>
                  <button type="button" onClick={() => align("top")}>
                    {t("alignTop")}
                  </button>
                  <button type="button" onClick={() => align("centerX")}>
                    {t("alignCenterX")}
                  </button>
                  <button type="button" onClick={() => align("centerY")}>
                    {t("alignCenterY")}
                  </button>
                </div>
              </div>
            ) : null}
            {!single ? <p className="meta">{t("nothingSelected")}</p> : null}
            {single ? (
              <Properties
                key={single.id}
                item={single}
                mode={props.mode}
                isEvent={props.isEvent}
                vendors={props.vendors}
                outlets={outlets.map((fixture) => ({ id: fixture.id, label: fixture.label ?? tKinds(fixture.kind) }))}
                ampChoices={props.ampChoices}
                typeLabel={isFixture(single) ? tKinds(single.kind) : typeOf(single)}
                onChange={(patch) => update(single.id, patch)}
                tColors={(color) => tColors(color)}
              />
            ) : null}
            {selected.length > 0 ? (
              <div className="row-wrap">
                <button type="button" onClick={copySelected}>
                  {t("copy")}
                </button>
                <button type="button" onClick={() => paste(items.filter((item) => selected.includes(item.id)))}>
                  {t("duplicate")}
                </button>
                <button type="button" onClick={removeSelected}>
                  {t("remove")}
                </button>
              </div>
            ) : null}
            {clipboard.length > 0 ? (
              <button type="button" onClick={() => paste()}>
                {t("paste", { count: clipboard.length })}
              </button>
            ) : null}
          </section>
        </div>
      </div>

      {props.mode === "elements" ? (
        <section aria-labelledby={`${ids.list}-findings`} className="plan-findings">
          <h2 id={`${ids.list}-findings`}>{t("findingsTitle")}</h2>
          <p className="meta">
            {t("capacity", { seats: capacity })}
            {props.expectedGuests !== null ? ` · ${t("expected", { guests: props.expectedGuests })}` : ""}
          </p>
          {findings.length === 0 ? (
            <p>{t("noFindings")}</p>
          ) : (
            <ul className="item-list">
              {findings.map((finding, index) => (
                <li key={index}>
                  <span className="badge badge-ambre">{t("toCheck")}</span> {findingText(finding)}
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}

      <section aria-labelledby={ids.list} className="plan-list">
        <div className="section-head">
          <h2 id={ids.list}>{props.mode === "elements" ? t("listTitle") : t("fixturesListTitle")}</h2>
          <label htmlFor={ids.sort}>{t("sortBy")}</label>
          <select id={ids.sort} value={sort} onChange={(event) => setSort(event.target.value as typeof sort)}>
            <option value="order">{t("sortOrder")}</option>
            <option value="name">{t("sortName")}</option>
            {props.mode === "elements" ? <option value="seats">{t("sortSeats")}</option> : null}
          </select>
        </div>
        {items.length === 0 ? <p>{t("empty")}</p> : null}
        <ul className="plan-rows">
          {sortedItems.map((item) => (
            <li key={item.id} className={selected.includes(item.id) ? "plan-row is-selected" : "plan-row"}>
              <button
                type="button"
                className="button-ghost"
                aria-pressed={selected.includes(item.id)}
                onClick={() => {
                  setSelected([item.id]);
                  document.getElementById(ids.panel)?.scrollIntoView({ block: "nearest" });
                }}
              >
                {labelOf(item)}
              </button>
              <span className="meta">
                {isFixture(item)
                  ? [tKinds(item.kind), item.kind === "outlet" ? t("outletSummary", { count: item.outletCount ?? 0, amps: item.amps ?? 0 }) : null].filter(Boolean).join(" · ")
                  : [typeOf(item), vendorName(item.vendorCandidateId), item.category === "table" ? t("seats", { count: item.seats }) : null].filter(Boolean).join(" · ")}
              </span>
              <span className="meta">{t("position", { x: meters(item.xCm), y: meters(item.yCm), angle: item.rotationDeg })}</span>
              {!isFixture(item) && item.fixtureId ? <span className="meta">{t("pluggedTo", { outlet: outlets.find((outlet) => outlet.id === item.fixtureId)?.label ?? tKinds("outlet") })}</span> : null}
            </li>
          ))}
        </ul>
      </section>

      {props.mode === "elements" ? (
        <section aria-labelledby={`${ids.list}-power`} className="plan-power">
          <h2 id={`${ids.list}-power`}>{tPower("title")}</h2>
          <p role="note" className="meta">
            {tPower("disclaimer")}
          </p>
          {power.length === 0 ? (
            <p>{tPower("none")}</p>
          ) : (
            <ul className="plan-rows">
              {power.map((row) => (
                <li key={row.fixtureId} className="plan-row">
                  <strong>{row.label ?? tKinds("outlet")}</strong>
                  <span className="meta">{tPower(row.threePhase ? "capacityThreePhase" : "capacityValue", { count: row.outletCount, amps: row.amps })}</span>
                  <span className={row.overloaded ? "badge badge-ambre" : "meta"}>{tPower(row.overloaded ? "usedOverloaded" : "usedValue", { used: row.used, count: row.outletCount })}</span>
                  <span className="meta">{row.elementIds.map((id) => labelOf(elementsNow.find((element) => element.id === id)!)).join(", ") || tPower("nothingPlugged")}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </div>
  );
}

type PropertiesProps = {
  item: Item;
  mode: Mode;
  isEvent: boolean;
  vendors: { id: string; name: string }[];
  outlets: { id: string; label: string }[];
  ampChoices: number[];
  typeLabel: string;
  onChange: (patch: Partial<FloorplanElement> & Partial<FloorplanFixture>) => void;
  tColors: (color: FloorplanColor) => string;
};

// Panneau des propriétés : la voie du clavier, du lecteur d'écran et du téléphone. Chaque champ
// s'applique à sa sortie (ou à son changement pour une liste), et s'annule comme un geste.
function Properties({ item, mode, isEvent, vendors, outlets, ampChoices, typeLabel, onChange, tColors }: PropertiesProps) {
  const meters = metersFormat(useLocale());
  const t = useTranslations("Floorplans.editor");
  const tKinds = useTranslations("Floorplans.fixtureKinds");
  const base = useId();
  const number = (key: "xCm" | "yCm" | "widthCm" | "depthCm", label: string, min: number, max: number) => (
    <DraftField
      id={`${base}-${key}`}
      label={label}
      value={meters(item[key])}
      inputMode="decimal"
      step="0.1"
      apply={(text) => {
        const value = toCm(text);
        if (Number.isFinite(value) && value >= min && value <= max && value !== item[key]) onChange(item.shape === "circle" && (key === "widthCm" || key === "depthCm") ? { widthCm: value, depthCm: value } : { [key]: value });
      }}
    />
  );
  const integer = (key: string, label: string, value: number | null, min: number, max: number, apply: (value: number | null) => void, optional = false) => (
    <DraftField
      id={`${base}-${key}`}
      label={label}
      value={value === null ? "" : String(value)}
      inputMode="numeric"
      step="1"
      apply={(text) => {
        if (text.trim() === "") {
          if (optional && value !== null) apply(null);
          return;
        }
        const parsed = Number.parseInt(text, 10);
        if (Number.isInteger(parsed) && parsed >= min && parsed <= max && parsed !== value) apply(parsed);
      }}
    />
  );
  const fixture = "kind" in item ? item : null;
  const element = "kind" in item ? null : item;
  return (
    <div className="plan-properties">
      <p className="meta">{typeLabel}</p>
      <DraftField
        id={`${base}-name`}
        label={fixture ? t("fixtureLabel") : t("name")}
        value={(fixture ? fixture.label : element!.name) ?? ""}
        maxLength={60}
        apply={(text) => {
          const value = text.trim() || null;
          if (fixture ? value !== fixture.label : value !== element!.name) onChange(fixture ? { label: value } : { name: value });
        }}
      />
      <div className="plan-fields">
        {number("xCm", t("x"), -100000, 200000)}
        {number("yCm", t("y"), -100000, 200000)}
        {number("widthCm", item.shape === "circle" ? t("diameter") : t("width"), fixture ? 5 : 10, 10000)}
        {item.shape === "circle" ? null : number("depthCm", t("depth"), fixture ? 5 : 10, 10000)}
        {integer("rotation", t("angle"), item.rotationDeg, 0, 359, (value) => onChange({ rotationDeg: value ?? 0 }))}
        {element && element.category === "table" ? integer("seats", t("seatsLabel"), element.seats, 0, 500, (value) => onChange({ seats: value ?? 0 })) : null}
      </div>
      {element ? (
        <>
          <div className="plan-field">
            <label htmlFor={`${base}-color`}>{t("color")}</label>
            <select id={`${base}-color`} value={element.color ?? ""} onChange={(event) => onChange({ color: (event.target.value || null) as FloorplanColor | null })}>
              <option value="">{t("colorDefault")}</option>
              {FLOORPLAN_COLORS.map((color) => (
                <option key={color} value={color}>
                  {tColors(color)}
                </option>
              ))}
            </select>
          </div>
          {isEvent ? (
            <div className="plan-field">
              <label htmlFor={`${base}-vendor`}>{t("vendor")}</label>
              <select id={`${base}-vendor`} value={element.vendorCandidateId ?? ""} onChange={(event) => onChange({ vendorCandidateId: event.target.value || null })}>
                <option value="">{t("noVendor")}</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <fieldset className="plan-needs">
            <legend>{t("needsTitle")}</legend>
            <div className="plan-fields">
              {integer("outlets", t("needOutlets"), element.powerOutlets, 0, 20, (value) => onChange({ powerOutlets: value ?? 0, ...(value ? {} : { fixtureId: null }) }))}
              {element.powerOutlets > 0 ? (
                <div className="plan-field">
                  <label htmlFor={`${base}-amps`}>{t("needAmps")}</label>
                  <select id={`${base}-amps`} value={element.powerAmps ?? ""} onChange={(event) => onChange({ powerAmps: event.target.value ? Number(event.target.value) : null })}>
                    <option value="">{t("ampsUnknown")}</option>
                    {ampChoices.map((amps) => (
                      <option key={amps} value={amps}>
                        {t("amps", { amps })}
                      </option>
                    ))}
                  </select>
                </div>
              ) : null}
              {element.powerOutlets > 0 ? integer("cable", t("maxCable"), element.maxCableM, 1, 500, (value) => onChange({ maxCableM: value }), true) : null}
            </div>
            <label className="checkbox">
              <input type="checkbox" checked={element.needsWater} onChange={(event) => onChange({ needsWater: event.target.checked })} />
              {t("needWater")}
            </label>
            {element.powerOutlets > 0 ? (
              <div className="plan-field">
                <label htmlFor={`${base}-outlet`}>{t("outlet")}</label>
                <select id={`${base}-outlet`} value={element.fixtureId ?? ""} onChange={(event) => onChange({ fixtureId: event.target.value || null })}>
                  <option value="">{outlets.length === 0 ? t("noOutlets") : t("noOutlet")}</option>
                  {outlets.map((outlet) => (
                    <option key={outlet.id} value={outlet.id}>
                      {outlet.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}
          </fieldset>
        </>
      ) : null}
      {fixture ? (
        <>
          <div className="plan-field">
            <label htmlFor={`${base}-kind`}>{t("fixtureKind")}</label>
            <select
              id={`${base}-kind`}
              value={fixture.kind}
              onChange={(event) => {
                const kind = event.target.value as FloorplanFixtureKind;
                onChange(kind === "outlet" ? { kind, outletCount: fixture.outletCount ?? 1, amps: fixture.amps ?? ampChoices[0] ?? 16 } : { kind, outletCount: null, amps: null, threePhase: false });
              }}
            >
              {FLOORPLAN_FIXTURE_KINDS.map((kind) => (
                <option key={kind} value={kind}>
                  {tKinds(kind)}
                </option>
              ))}
            </select>
          </div>
          {fixture.kind === "outlet" ? (
            <div className="plan-fields">
              {integer("count", t("outletCount"), fixture.outletCount, 1, 50, (value) => onChange({ outletCount: value ?? 1 }))}
              <div className="plan-field">
                <label htmlFor={`${base}-fixture-amps`}>{t("outletAmps")}</label>
                <select id={`${base}-fixture-amps`} value={fixture.amps ?? ""} onChange={(event) => onChange({ amps: Number(event.target.value) })}>
                  {ampChoices.map((amps) => (
                    <option key={amps} value={amps}>
                      {t("amps", { amps })}
                    </option>
                  ))}
                </select>
              </div>
              <label className="checkbox">
                <input type="checkbox" checked={fixture.threePhase} onChange={(event) => onChange({ threePhase: event.target.checked })} />
                {t("threePhase")}
              </label>
            </div>
          ) : null}
        </>
      ) : null}
      <div className="plan-field">
        <label htmlFor={`${base}-note`}>{t("note")}</label>
        <NoteField id={`${base}-note`} value={item.note ?? ""} apply={(text) => {
          const value = text.trim() || null;
          if (value !== item.note) onChange({ note: value });
        }} />
        <p className="meta">{mode === "elements" ? t("noteInternal") : t("noteFixture")}</p>
      </div>
    </div>
  );
}

// Champ qui garde sa saisie tant qu'il a le focus, puis l'applique à sa sortie (ou à Entrée) ; il
// reprend la valeur de l'élément quand celui-ci change ailleurs (dessin, clavier, annuler).
function DraftField({ id, label, value, apply, inputMode, step, maxLength }: { id: string; label: string; value: string; apply: (text: string) => void; inputMode?: "decimal" | "numeric"; step?: string; maxLength?: number }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  return (
    <div className="plan-field">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        {...(inputMode ? { type: "text", inputMode } : {})}
        {...(step ? { "data-step": step } : {})}
        {...(maxLength ? { maxLength } : {})}
        value={draft}
        onFocus={() => setEditing(true)}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            apply(draft);
          }
        }}
        onBlur={() => {
          setEditing(false);
          apply(draft);
        }}
      />
    </div>
  );
}

function NoteField({ id, value, apply }: { id: string; value: string; apply: (text: string) => void }) {
  const [draft, setDraft] = useState(value);
  const [editing, setEditing] = useState(false);
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);
  return (
    <>
      <textarea
      id={id}
      name="note"
      maxLength={500}
      rows={2}
      value={draft}
      onFocus={() => setEditing(true)}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={() => {
        setEditing(false);
          apply(draft);
        }}
      />
      <FreeTextNotice />
    </>
  );
}
