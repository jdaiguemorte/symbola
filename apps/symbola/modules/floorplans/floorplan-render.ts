// Lot 60 (L60-PLA-05) — le plan de salle mis en PDF à l'échelle, à la demande, pour la planner (plan
// en cours) ou pour un lien (version diffusée). Textes dans la langue demandée ; le fichier part vers
// le navigateur et n'est rangé nulle part. Exposé seulement par service.ts (ADR 0011).
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { createTranslator } from "next-intl";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import type { FloorplanBackground, FloorplanCalibration, FloorplanFixture, FloorplanPowerRow, FloorplanShape, FloorplanCategory } from "@symbola/contracts";
import { starterFloorplanElementLabel } from "@symbola/starter-templates";
import { pdfSafe } from "@/lib/pdf-text";
import { backgroundSize, pdfScale } from "./geometry";
import { FloorplanPdf, PDF_AREA_MM, type FloorplanPdfData, type FloorplanPdfLabels, type PdfItem } from "./floorplan-pdf";

export type FloorplanPdfElement = {
  id: string;
  typeStarterKey: string | null;
  typeLabel: string | null;
  category: FloorplanCategory;
  shape: FloorplanShape;
  name: string | null;
  xCm: number;
  yCm: number;
  widthCm: number;
  depthCm: number;
  rotationDeg: number;
  seats: number;
  vendorName: string | null;
  mine: boolean;
  powerOutlets: number;
  powerAmps: number | null;
  needsWater: boolean;
  fixtureId: string | null;
};

export type FloorplanPdfInput = {
  locale: "fr" | "en";
  venueName: string | null;
  spaceName: string;
  layoutName: string;
  version: number | null;
  date: string;
  space: { widthCm: number; depthCm: number; background: FloorplanBackground | null; calibration: FloorplanCalibration | null };
  backgroundData: Uint8Array | null;
  fixtures: Omit<FloorplanFixture, "note">[];
  elements: FloorplanPdfElement[];
  power: FloorplanPowerRow[];
};

export type FloorplanPdfFile = { body: Uint8Array; contentType: string; filename: string };

function translator(locale: "fr" | "en") {
  return createTranslator({ locale, messages: locale === "en" ? enMessages : frMessages, namespace: "Floorplans" });
}

const meters = (cm: number) => (cm / 100).toLocaleString("fr-FR", { maximumFractionDigits: 2 });

function stem(value: string): string {
  return (
    value
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^A-Za-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase()
      .slice(0, 40) || "plan"
  );
}

export async function renderFloorplanPdf(input: FloorplanPdfInput): Promise<FloorplanPdfFile> {
  const t = translator(input.locale);
  const typeOf = (element: FloorplanPdfElement) => (element.typeStarterKey ? (starterFloorplanElementLabel(element.typeStarterKey, input.locale) ?? element.typeStarterKey) : (element.typeLabel ?? ""));
  const fixtureName = (fixture: Pick<FloorplanFixture, "kind" | "label">) => fixture.label ?? t(`fixtureKinds.${fixture.kind}`);
  const items: PdfItem[] = input.elements.map((element) => ({
    id: element.id,
    label: element.name ?? typeOf(element),
    detail: [element.name ? typeOf(element) : null, element.vendorName].filter(Boolean).join(" · "),
    shape: element.shape,
    xCm: element.xCm,
    yCm: element.yCm,
    widthCm: element.widthCm,
    depthCm: element.depthCm,
    rotationDeg: element.rotationDeg,
    highlighted: element.mine,
    fixtureId: element.fixtureId,
  }));
  const byId = new Map(input.elements.map((element) => [element.id, element]));
  const fixtureById = new Map(input.fixtures.map((fixture) => [fixture.id, fixture]));
  const scale = pdfScale(input.space.widthCm, input.space.depthCm, PDF_AREA_MM.width, PDF_AREA_MM.height);
  const background = input.space.background;
  const format = background?.mime === "image/png" ? "png" : background?.mime === "image/jpeg" ? "jpg" : null;
  const size = background ? backgroundSize(background, input.space.calibration, input.space.widthCm) : null;
  const data: FloorplanPdfData = {
    widthCm: input.space.widthCm,
    depthCm: input.space.depthCm,
    scale,
    background: input.backgroundData && format && size ? { data: Buffer.from(input.backgroundData), format, widthCm: size.widthCm, heightCm: size.heightCm } : null,
    elements: items,
    fixtures: input.fixtures.map((fixture) => ({ id: fixture.id, kind: fixture.kind, label: fixtureName(fixture), xCm: fixture.xCm, yCm: fixture.yCm, widthCm: fixture.widthCm, depthCm: fixture.depthCm, rotationDeg: fixture.rotationDeg })),
    power: input.power.map((row) => ({
      ...row,
      labelText: row.label ?? t("fixtureKinds.outlet"),
      plugged: row.elementIds.map((id) => items.find((item) => item.id === id)?.label ?? "").filter(Boolean).join(", "),
    })),
  };
  const labels: FloorplanPdfLabels = {
    title: t("pdf.title"),
    cartouche: {
      venue: input.venueName ?? t("pdf.noVenue"),
      space: input.spaceName,
      layout: input.layoutName,
      scale: t("pdf.scale", { scale }),
      date: formatCalendarDate(input.date, input.locale as Locale),
      version: input.version ? t("pdf.version", { version: input.version }) : t("pdf.draft"),
    },
    scaleBar: t("pdf.scaleBar", { m: "{m}" }),
    backgroundOmitted: background && !format ? t("pdf.backgroundOmitted") : null,
    elementsTitle: t("pdf.elementsTitle"),
    columns: { element: t("pdf.columns.element"), detail: t("pdf.columns.detail"), position: t("pdf.columns.position"), size: t("pdf.columns.size"), seats: t("pdf.columns.seats"), power: t("pdf.columns.power") },
    row: {
      position: (item) => t("pdf.position", { x: meters(item.xCm), y: meters(item.yCm), angle: item.rotationDeg }),
      size: (item) => (item.shape === "circle" ? t("pdf.diameter", { d: meters(item.widthCm) }) : t("pdf.size", { w: meters(item.widthCm), d: meters(item.depthCm) })),
      seats: (item) => {
        const element = byId.get(item.id)!;
        return element.category === "table" ? String(element.seats) : "";
      },
      power: (item) => {
        const element = byId.get(item.id)!;
        const parts: string[] = [];
        if (element.powerOutlets > 0) parts.push(t("pdf.powerNeed", { count: element.powerOutlets, amps: element.powerAmps ?? 0 }));
        if (element.needsWater) parts.push(t("pdf.water"));
        const fixture = element.fixtureId ? fixtureById.get(element.fixtureId) : undefined;
        if (fixture) parts.push(t("pdf.pluggedTo", { outlet: fixtureName(fixture) }));
        return parts.join(" · ");
      },
    },
    powerTitle: t("power.title"),
    powerColumns: { outlet: t("power.outlet"), capacity: t("power.capacity"), used: t("power.used"), plugged: t("power.plugged") },
    powerCapacity: (row) => t(row.threePhase ? "power.capacityThreePhase" : "power.capacityValue", { count: row.outletCount, amps: row.amps }),
    powerUsed: (row) => t(row.overloaded ? "power.usedOverloaded" : "power.usedValue", { used: row.used, count: row.outletCount }),
    noPower: t("power.none"),
    disclaimer: t("power.disclaimer"),
    footer: t("pdf.footer"),
    page: (page, total) => t("pdf.page", { page, total }),
  };
  const document = createElement(FloorplanPdf, { data: { ...pdfSafe({ ...data, background: null }), background: data.background }, labels: pdfSafe(labels) }) as unknown as ReactElement<DocumentProps>;
  const body = new Uint8Array(await renderToBuffer(document));
  return { body, contentType: "application/pdf", filename: `${stem(t("pdf.filePrefix"))}-${stem(input.spaceName)}-${stem(input.layoutName)}.pdf` };
}
