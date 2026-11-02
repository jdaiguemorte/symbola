// RGPD-02 — rendu du PDF lisible de l'export : un vrai PDF A4, sur plusieurs
// pages quand la personne a beaucoup de données, accents compris.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import { buildExportPdfModel, type ExportLabels } from "@/lib/privacy/export";
import type { SearchRecord } from "@/lib/privacy/search";
import { ExportPdfDocument } from "./export-pdf";

const labels: ExportLabels = {
  title: "Données personnelles",
  intro: "Voici les données que nous détenons à votre sujet.",
  generatedAt: "Export du 2 novembre 2026 à 15:00",
  person: "Personne concernée : Élodie Durand",
  organizationName: "Atelier Lumière",
  module: (module) => ({ events: "Événements", quotes: "Devis et factures" })[module] ?? module,
  kind: (kind) => ({ event_client: "Client", task: "Tâche", invoice: "Facture" })[kind] ?? kind,
  field: (field) => ({ firstName: "Prénom", lastName: "Nom" })[field] ?? field,
  noFields: "Aucun champ.",
  page: (current, total) => `Page ${current} sur ${total}`,
};

function record(partial: Partial<SearchRecord> & Pick<SearchRecord, "module" | "kind">): SearchRecord {
  return { recordId: crypto.randomUUID(), label: "", fields: {}, eventId: null, direct: true, ...partial };
}

describe("RGPD-02 — PDF lisible de l'export", () => {
  it("groupe les fiches par module, dans l'ordre des modules, avec les libellés traduits", () => {
    const model = buildExportPdfModel(
      [
        record({ module: "quotes", kind: "invoice", label: "F-2027-0001" }),
        record({ module: "events", kind: "event_client", label: "Élodie Durand", fields: { firstName: "Élodie", lastName: "Durand" } }),
      ],
      labels,
      "fr",
    );
    expect(model.sections.map((section) => section.title)).toEqual(["Événements", "Devis et factures"]);
    expect(model.sections[0]!.records[0]).toEqual({
      heading: "Client : Élodie Durand",
      fields: [
        { label: "Prénom", value: "Élodie" },
        { label: "Nom", value: "Durand" },
      ],
    });
  });

  it("produit un PDF A4 sur plusieurs pages quand les fiches sont nombreuses", async () => {
    const records = Array.from({ length: 80 }, (_, index) =>
      record({ module: "events", kind: "task", label: `Tâche ${index} — réserver le traiteur`, fields: { note: "Prévoir l'acompte (€) ; rappeler lundi" } }),
    );
    const model = buildExportPdfModel(records, labels, "fr");
    const pdf = await renderToBuffer(createElement(ExportPdfDocument, { model }) as unknown as ReactElement<DocumentProps>);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    const text = pdf.toString("latin1");
    expect(text).toMatch(/\/MediaBox \[0 0 595\.28\d* 841\.89\d*\]/);
    expect((text.match(/\/Type \/Page\b/g) ?? []).length).toBeGreaterThan(1);
  });
});
