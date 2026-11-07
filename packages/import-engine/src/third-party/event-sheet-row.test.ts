import { describe, expect, it } from "vitest";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { planningSoftwareProfile } from "@symbola/starter-templates";
import { readPdfText } from "../pdf";
import { parseEventSheet } from "./event-sheet";
import { assignPhones, eventSheetRejectionRow, eventSheetRow, eventSheetStatus, parsePlacesCell, placesCell } from "./event-sheet-row";

async function sheet(name: string) {
  const read = await readPdfText(readImportCorpusFile(`logiciel-tiers/${name}`));
  if (!read.ok) throw new Error(read.reason);
  const result = parseEventSheet(read.pages[0]!, planningSoftwareProfile().eventSheet);
  if (!result.ok) throw new Error(result.reason);
  return result.sheet;
}

describe("IMP-08 — Une fiche PDF devient une ligne d'import (lot 14c)", () => {
  it("mariés, coordonnées, date, lieux, budget souhaité ; payé, solde, total et note à part", async () => {
    const row = eventSheetRow("fiche.pdf", await sheet("fiche-evenement-complete.pdf"), "2026-11-07");
    expect(row).toMatchObject({
      source: "fiche.pdf",
      rejection: "",
      client1FirstName: "Léa",
      client1Email: "lea.martin@example.org",
      client1Phone: "06 39 98 01 01",
      client2FirstName: "Hugo",
      client2Phone: "",
      eventDate: "2027-06-12",
      venueName: "Domaine des Tilleuls",
      places: "14:30 — Domaine des Tilleuls\n16:00 — Église Saint-Exemple de Villefictive",
      status: "confirmed",
      wantedBudget: "25000,00",
      note: "Cérémonie laïque",
      paid: "3200,00 €",
    });
  });

  it("une fiche sans budget laisse le budget souhaité vide", async () => {
    expect(eventSheetRow("m.pdf", await sheet("fiche-evenement-minimale.pdf"), "2026-11-07").wantedBudget).toBe("");
  });

  it("décision J : confirmé si la date est à venir et un lieu connu, réalisé si elle est passée, prospect sinon", () => {
    expect(eventSheetStatus({ eventDate: "2027-06-12", places: [{ label: "A", date: null, time: null }] }, "2026-11-07")).toBe("confirmed");
    expect(eventSheetStatus({ eventDate: "2027-06-12", places: [] }, "2026-11-07")).toBe("prospect");
    expect(eventSheetStatus({ eventDate: "2026-11-06", places: [] }, "2026-11-07")).toBe("done");
    expect(eventSheetStatus({ eventDate: "2026-11-07", places: [{ label: "A", date: null, time: null }] }, "2026-11-07")).toBe("confirmed");
    expect(eventSheetStatus({ eventDate: null, places: [{ label: "A", date: null, time: null }] }, "2026-11-07")).toBe("prospect");
  });

  it("un téléphone marqué d'un prénom va à ce client, les autres dans l'ordre", () => {
    const people = [{ firstName: "Léa" }, { firstName: "Hugo" }];
    expect(assignPhones(people, [{ number: "1", label: "Hugo" }, { number: "2", label: null }])).toEqual(["2", "1"]);
    expect(assignPhones(people, [{ number: "1", label: null }])).toEqual(["1", null]);
    expect(assignPhones(people, [{ number: "1", label: null }, { number: "2", label: null }, { number: "3", label: null }])).toEqual(["1", "2"]);
  });

  it("les lieux s'écrivent un par ligne et se relisent, avec ou sans heure", () => {
    const places = [
      { label: "Mairie", date: null, time: "11:00" },
      { label: "Salle — des fêtes", date: null, time: null },
    ];
    expect(parsePlacesCell(placesCell(places))).toEqual([
      { label: "Mairie", time: "11:00" },
      { label: "Salle — des fêtes", time: null },
    ]);
  });

  it("une fiche refusée garde son nom de fichier et son motif", () => {
    expect(eventSheetRejectionRow("x.pdf", "encrypted")).toMatchObject({ source: "x.pdf", rejection: "encrypted", client1FirstName: "" });
  });
});
