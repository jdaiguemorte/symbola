import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { ProgramPdfDocument } from "./program-pdf";
import type { ProgramPdfModel } from "./program-pdf-model";

const model: ProgramPdfModel = {
  language: "fr",
  organizationName: "Atelier Lumière",
  logo: null,
  title: "Programme du jour J",
  heading: "Inès & Sacha — 12 juin 2027",
  variant: "Version prestataires",
  version: "Version du 1 juin 2027 à 10:30",
  columns: ["Heure", "Déroulé", "Lieu", "Intervenants", "Note interne"],
  rows: Array.from({ length: 60 }, (_, index) => ({
    time: "15:00 – 16:00",
    label: `Cérémonie ${index} — vin d'honneur, pièce montée`,
    location: "Église Saint-Paul",
    participants: "Photographe, Officiant",
    note: "Prévoir les alliances (€)",
  })),
  showNotes: true,
  empty: "Aucune ligne.",
};

async function render(input: ProgramPdfModel): Promise<Buffer> {
  return renderToBuffer(createElement(ProgramPdfDocument, { model: input }) as unknown as ReactElement<DocumentProps>);
}

describe("EVT-05 — Rendu PDF A4 du programme", () => {
  it("produit un PDF A4 sur plusieurs pages quand le programme est long", async () => {
    const pdf = await render(model);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const text = pdf.toString("latin1");
    // A4 : 595,28 × 841,89 points.
    expect(text).toMatch(/\/MediaBox \[0 0 595\.28\d* 841\.89\d*\]/);
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });

  it("produit aussi la variante sans colonne de notes, et un programme vide", async () => {
    const pdf = await render({ ...model, showNotes: false, columns: model.columns.slice(0, 4), rows: [] });
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });
});
