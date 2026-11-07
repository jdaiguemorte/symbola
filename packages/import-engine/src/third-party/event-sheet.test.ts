import { describe, expect, it } from "vitest";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { planningSoftwareProfile } from "@symbola/starter-templates";
import { readPdfText, type PdfPage } from "../pdf";
import { parseEventSheet, splitPersonName, toRuns } from "./event-sheet";

const profile = planningSoftwareProfile().eventSheet;

async function sheet(name: string) {
  const read = await readPdfText(readImportCorpusFile(`logiciel-tiers/${name}`));
  if (!read.ok) throw new Error(read.reason);
  const result = parseEventSheet(read.pages[0]!, profile);
  if (!result.ok) throw new Error(result.reason);
  return result.sheet;
}

describe("IMP-08 — Importer ses événements depuis les fiches PDF (lecture, lot 14a)", () => {
  it("étant donné une fiche complète, les deux mariés sont séparés par colonne avec leurs coordonnées", async () => {
    const { people, phones, eventDate } = await sheet("fiche-evenement-complete.pdf");
    expect(eventDate).toBe("2027-06-12");
    expect(people).toEqual([
      { firstName: "Léa", lastName: "MARTIN", email: "lea.martin@example.org", addressLine: "12 rue des Lilas", postalCode: "86000", city: "POITIERS" },
      { firstName: "Hugo", lastName: "BERNARD", email: "hugo.bernard@example.org", addressLine: "12 rue des Lilas", postalCode: "86000", city: "POITIERS" },
    ]);
    expect(phones).toEqual([{ number: "06 39 98 01 01", label: null }]);
  });

  it("les lieux côte à côte sont lus dans l'ordre, un lieu qui passe à la ligne est recollé, la note est gardée", async () => {
    const { places, note } = await sheet("fiche-evenement-complete.pdf");
    expect(places).toEqual([
      { label: "Domaine des Tilleuls", date: "2027-06-12", time: "14:30" },
      { label: "Église Saint-Exemple de Villefictive", date: "2027-06-12", time: "16:00" },
    ]);
    expect(note).toBe("Cérémonie laïque");
  });

  it("le budget souhaité et les montants d'information sont lus en centimes ; le pied de page de l'entreprise est ignoré", async () => {
    const result = await sheet("fiche-evenement-complete.pdf");
    expect(result.budget).toEqual({ wantedCents: 2_500_000, paidCents: 320_000, balanceCents: 1_845_050, totalCents: 2_165_050 });
    expect(JSON.stringify(result)).not.toMatch(/Atelier Exemple|Siret|RCS/);
  });

  it("étant donné une fiche minimale (un marié sans coordonnées, un lieu, pas de budget), les champs absents restent vides", async () => {
    const result = await sheet("fiche-evenement-minimale.pdf");
    expect(result.eventDate).toBe("2027-09-03");
    expect(result.people).toEqual([
      { firstName: "Inès", lastName: "DUPONT-MOREAU", email: "ines.dupont@example.org", addressLine: null, postalCode: null, city: null },
      { firstName: "Malik", lastName: "AMRANI", email: null, addressLine: null, postalCode: null, city: null },
    ]);
    expect(result.places).toEqual([{ label: "Château de la Roche Fictive", date: "2027-09-03", time: "17:00" }]);
    expect(result.phones).toEqual([]);
    expect(result.note).toBeNull();
    expect(result.budget.wantedCents).toBe(0);
  });

  it("trois lieux (deux rangées) et deux téléphones", async () => {
    const result = await sheet("fiche-evenement-trois-lieux.pdf");
    expect(result.eventDate).toBe("2028-12-09");
    expect(result.places.map((place) => `${place.label} ${place.time}`)).toEqual([
      "Mairie de Villefictive 11:00",
      "Moulin de Beauregard 15:00",
      "Salle des Fêtes Exemple 19:30",
    ]);
    expect(result.phones.map((phone) => phone.number)).toEqual(["06 39 98 01 02", "06 39 98 01 03"]);
  });

  it("des morceaux de texte séparés sur une même ligne (comme dans l'export réel) sont recollés", () => {
    const item = (text: string, x: number, y: number, width: number) => ({ text, x, y, width, size: 10 });
    const runs = toRuns([
      item("Lieu de la fête", 44.8, 271.9, 74),
      item(" ", 118.8, 271.9, 2.8),
      item("- samedi 12 juin 2027 à 14:30", 121.6, 271.8, 160),
      item("Autre lieu", 299.1, 271.9, 100),
    ]);
    expect(runs.map((run) => run.text)).toEqual(["Lieu de la fête - samedi 12 juin 2027 à 14:30", "Autre lieu"]);
  });

  it("une page qui n'est pas une fiche événement est rejetée avec un motif", () => {
    const page: PdfPage = { width: 595, height: 842, items: [{ text: "Facture n° 12", x: 40, y: 80, width: 80, size: 12 }] };
    expect(parseEventSheet(page, profile)).toEqual({ ok: false, reason: "not_event_sheet" });
  });

  it("le nom de famille en capitales est séparé du prénom, composé ou non", () => {
    expect(splitPersonName("Léa MARTIN")).toEqual({ firstName: "Léa", lastName: "MARTIN" });
    expect(splitPersonName("Marie-Claire DE LA FONTAINE")).toEqual({ firstName: "Marie-Claire", lastName: "DE LA FONTAINE" });
    expect(splitPersonName("Camille")).toEqual({ firstName: "Camille", lastName: null });
  });
});
