// RGPD-03 — preuve horodatée d'un oubli : comptes par sort, données
// conservées avec motif et date de fin, accusés, modèle de réponse rempli ;
// rendu en vrai PDF A4.
import { createElement, type ReactElement } from "react";
import { renderToBuffer, type DocumentProps } from "@react-pdf/renderer";
import { describe, expect, it } from "vitest";
import type { PrivacyErasureView } from "@/modules/hub/service";
import { buildErasureProofModel, fillTemplate, type ProofLabels } from "./proof-model";
import { ProofPdfDocument } from "./proof-pdf";

const erasure: PrivacyErasureView = {
  id: "e1",
  status: "completed",
  items: [
    { module: "events", kind: "event_client", recordId: "a", fate: "anonymized", legalBasis: null, keptUntil: null },
    { module: "events", kind: "task", recordId: "b", fate: "deleted", legalBasis: null, keptUntil: null },
    { module: "events", kind: "task", recordId: "c", fate: "deleted", legalBasis: null, keptUntil: null },
    { module: "quotes", kind: "invoice", recordId: "d", fate: "kept", legalBasis: "accounting", keptUntil: "2036-03-11" },
  ],
  acks: [
    { module: "events", status: "ok", at: "2026-11-02T14:00:00.000Z", count: 3 },
    { module: "quotes", status: "ok", at: "2026-11-02T14:00:01.000Z", count: 1 },
  ],
  createdAt: new Date("2026-11-02T14:00:00Z"),
  completedAt: new Date("2026-11-02T14:00:01Z"),
  request: { id: "r1", personLabel: "Élodie Durand", receivedOn: "2026-11-01", dueOn: "2026-12-01", status: "closed" },
};

const labels: ProofLabels = {
  title: "Preuve",
  person: "Personne concernée : Élodie Durand",
  request: "Demande reçue le 1 nov.",
  validatedAt: "Validé",
  completion: "Terminé",
  acksTitle: "Accusés",
  itemsTitle: "Sort",
  keptTitle: "Conservées",
  keptNone: "Aucune",
  responseTitle: "Réponse",
  columns: { module: "Module", kind: "Nature", fate: "Sort", count: "Nombre" },
  module: (module) => module,
  kind: (kind) => kind,
  fate: (fate) => fate,
  ack: (ack) => `${ack.module}:${ack.status}:${ack.count}`,
  keptLine: (kind, until, basis) => `${kind} jusqu'au ${until} (${basis})`,
  basis: (basis) => basis,
  date: (date) => date,
  page: (current, total) => `${current}/${total}`,
};

describe("RGPD-03 — Preuve horodatée et modèle de réponse", () => {
  it("compte les fiches par sort, liste les données conservées avec motif et date de fin, et chaque accusé", () => {
    const model = buildErasureProofModel({ erasure, organizationName: "Atelier", language: "fr", labels, response: { subject: "Objet", body: "Corps" } });
    expect(model.rows).toEqual([
      { module: "events", kind: "event_client", fate: "anonymized", count: "1" },
      { module: "events", kind: "task", fate: "deleted", count: "2" },
      { module: "quotes", kind: "invoice", fate: "kept", count: "1" },
    ]);
    expect(model.kept).toEqual(["invoice jusqu'au 2036-03-11 (accounting)"]);
    expect(model.acks).toEqual(["events:ok:3", "quotes:ok:1"]);
  });

  it("un module sans accusé apparaît comme n'ayant pas répondu", () => {
    const model = buildErasureProofModel({ erasure: { ...erasure, acks: erasure.acks.slice(0, 1), status: "partial" }, organizationName: "Atelier", language: "fr", labels, response: { subject: "", body: "" } });
    expect(model.acks).toEqual(["events:ok:3", "quotes:failed:0"]);
  });

  it("remplit les variables du modèle de réponse, sans toucher aux inconnues", () => {
    expect(fillTemplate("Bonjour {person}, {inconnue}", { person: "Élodie" })).toBe("Bonjour Élodie, {inconnue}");
  });

  it("produit un PDF A4", async () => {
    const model = buildErasureProofModel({ erasure, organizationName: "Atelier", language: "fr", labels, response: { subject: "Objet", body: "Bonjour,\n\nVotre demande a été traitée." } });
    const pdf = await renderToBuffer(createElement(ProofPdfDocument, { model }) as unknown as ReactElement<DocumentProps>);
    expect(pdf.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(pdf.toString("latin1")).toMatch(/\/MediaBox \[0 0 595\.28\d* 841\.89\d*\]/);
  });
});
