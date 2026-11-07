import { describe, expect, it } from "vitest";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { planningSoftwareProfile } from "@symbola/starter-templates";
import { readImportFile } from "../read";
import type { ImportTable } from "../types";
import { detectVendorsExport, normalizeVendorsExportRow } from "./vendors-export";

const profile = planningSoftwareProfile().vendors;
const limits = { maxBytes: 10 * 1024 * 1024, maxRows: 5000 };

function table(): ImportTable {
  const result = readImportFile(readImportCorpusFile("logiciel-tiers/prestataires.xlsx"), limits);
  if (!result.ok) throw new Error(result.reason);
  return result.table;
}

function rows() {
  const current = table();
  const detection = detectVendorsExport(current, profile);
  if (!detection.matched) throw new Error("export non reconnu");
  return current.rows.map((row) => normalizeVendorsExportRow(row, detection.columns, profile));
}

describe("IMP-07 — Importer ses prestataires depuis l'export Excel (lecture, lot 14a)", () => {
  it("étant donné l'export des prestataires, le format est reconnu par ses intitulés", () => {
    expect(detectVendorsExport(table(), profile).matched).toBe(true);
    const other = { ...table(), headers: ["Prénom mariée", "Date du mariage", "Lieu"] };
    expect(detectVendorsExport(other, profile).matched).toBe(false);
  });

  it("les colonnes « Site Internet » et « Critères avancés », inversées dans l'export, sont remises en place d'après leur contenu", () => {
    const detection = detectVendorsExport(table(), profile);
    if (!detection.matched) throw new Error("export non reconnu");
    expect(detection.swapped).toEqual([["website", "criteria"]]);
    expect(detection.columns.get(10)).toBe("criteria");
    expect(detection.columns.get(11)).toBe("website");
    const domaine = rows().find((row) => row?.name === "Domaine des Tilleuls")!;
    expect(domaine.website).toBe("https://www.domaine-tilleuls.example.org");
    expect(domaine.criteria).toEqual(["Moins de 50 invités", "50 à 100 invités", "100 à 150 invités", "Hébergement sur place"]);
  });

  it("les entités HTML sont décodées dans les noms et les prestations (22ᵉ colonne sans titre)", () => {
    const all = rows();
    expect(all.map((row) => row?.name)).toContain("Château de la Roche Fictive");
    expect(all.map((row) => row?.name)).toContain("Clic & Déclic");
    const domaine = all.find((row) => row?.name === "Domaine des Tilleuls")!;
    expect(domaine.services).toBe("Salle de réception 180 m²\nParc arboré\nHébergement 24 couchages\nLocation week-end : 4 500 €");
  });

  it("un code postal enregistré comme nombre retrouve ses 5 chiffres", () => {
    const sono = rows().find((row) => row?.name === "Sono Événements")!;
    expect(sono.postalCode).toBe("05000");
    expect(rows().find((row) => row?.name === "Fleurs de Saison")!.postalCode).toBe("06000");
  });

  it("le premier téléphone devient celui du prestataire, les autres sont gardés avec leur prénom ; tous les formats sont reconnus", () => {
    const dj = rows().find((row) => row?.name === "DJ Nova")!;
    expect(dj.phone).toBe("06 39 98 00 07");
    expect(dj.otherPhones).toEqual([{ number: "06 39 98 00 08", label: "Julie" }]);
    expect(rows().find((row) => row?.name === "Maison Verdier Traiteur")!.phone).toBe("06 39 98 00 03");
    expect(rows().find((row) => row?.name === "Studio Lumière")!.phone).toBe("06 39 98 00 05");
  });

  it("le contact, les réseaux, le SIRET et l'identité légale sont lus ; une valeur absente reste vide", () => {
    const studio = rows().find((row) => row?.name === "Studio Lumière")!;
    expect(studio.contactName).toBe("Léa Marchand");
    expect(studio.socialLinks.map((link) => link.network)).toEqual(["instagram", "facebook"]);
    const domaine = rows().find((row) => row?.name === "Domaine des Tilleuls")!;
    expect(domaine).toMatchObject({ siret: "12345678900011", vatNumber: "FR00123456789", apeCode: "5510Z", legalStatus: "SAS" });
    const brunch = rows().find((row) => row?.name === "Le Grand Brunch")!;
    expect(brunch).toMatchObject({ contactName: null, email: null, website: null, criteria: [], services: null });
  });
});
