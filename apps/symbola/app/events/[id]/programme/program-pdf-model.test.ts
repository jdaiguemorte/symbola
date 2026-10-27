import { describe, expect, it } from "vitest";
import type { EventProgram } from "@/modules/events/service";
import { buildProgramPdfModel } from "./program-pdf-model";

const program: EventProgram = {
  items: [
    {
      id: "a",
      eventId: "e",
      startTime: "15:00",
      endTime: "16:00",
      label: "Cérémonie",
      location: "Mairie",
      internalNote: "Prévoir les alliances",
      participants: [
        { vendorSlotId: "s", label: "Photographe" },
        { vendorSlotId: null, label: "Officiant" },
      ],
    },
    {
      id: "b",
      eventId: "e",
      startTime: "22:45",
      endTime: null,
      label: "Soirée",
      location: null,
      internalNote: null,
      participants: [],
    },
  ],
  overlaps: [],
  updatedAt: "2027-06-01T08:30:00.000Z",
};

const labels = {
  title: "Programme du jour J",
  variant: "Version mariés",
  version: (date: string) => `Version du ${date}`,
  time: "Heure",
  item: "Déroulé",
  location: "Lieu",
  participants: "Intervenants",
  note: "Note interne",
  empty: "Aucune ligne.",
};

describe("EVT-05 — Contenu du PDF du programme", () => {
  it("variante « mariés » : aucune note interne, ni colonne ni contenu", () => {
    const model = buildProgramPdfModel({ program, variant: "couple", labels, locale: "fr", heading: "Inès & Sacha", logo: null, organizationName: "Atelier" });
    expect(model.columns).toEqual(["Heure", "Déroulé", "Lieu", "Intervenants"]);
    expect(JSON.stringify(model)).not.toContain("Prévoir les alliances");
    expect(model.rows[0]).toEqual({ time: "15:00 – 16:00", label: "Cérémonie", location: "Mairie", participants: "Photographe, Officiant", note: null });
  });

  it("variante « prestataires » : les notes internes sont présentes", () => {
    const model = buildProgramPdfModel({ program, variant: "vendors", labels, locale: "fr", heading: "Inès & Sacha", logo: null, organizationName: "Atelier" });
    expect(model.columns).toContain("Note interne");
    expect(model.rows[0]?.note).toBe("Prévoir les alliances");
    expect(model.rows[1]).toMatchObject({ time: "22:45", location: "", participants: "" });
  });

  it("porte la date de version (heure de Paris), le nom de l'organisation et son logo", () => {
    const logo = { data: Buffer.from([0x89]), format: "png" as const };
    const model = buildProgramPdfModel({ program, variant: "couple", labels, locale: "fr", heading: "Inès", logo, organizationName: "Atelier" });
    expect(model.version).toBe("Version du 1 juin 2027 à 10:30");
    expect(model.organizationName).toBe("Atelier");
    expect(model.logo).toBe(logo);
    expect(model.watermark).toBeNull();
  });

  it("AIDE-02 — un événement d'essai porte le filigrane « Document fictif »", () => {
    const model = buildProgramPdfModel({
      program,
      variant: "couple",
      labels,
      locale: "fr",
      heading: "Camille & Sacha",
      logo: null,
      organizationName: "Atelier",
      watermark: "Document fictif",
    });
    expect(model.watermark).toBe("Document fictif");
  });
});
