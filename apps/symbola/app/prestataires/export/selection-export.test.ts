// Lot 11 (L11-PRE-11) — export d'une sélection : colonnes, trajet estimé et
// cellules neutralisées contre les formules (CLAUDE.md § 5).
import { describe, expect, it } from "vitest";
import { toCsv } from "@symbola/privacy";
import { exportRows, exportTable, type ExportLabels } from "./selection-export";

const labels: ExportLabels = {
  name: "Nom",
  type: "Type",
  contact: "Contact",
  phone: "Téléphone",
  email: "E-mail",
  address: "Adresse",
  city: "Ville",
  distance: "Trajet estimé",
  travel: (km, minutes) => `${km} km, ${minutes} min`,
  tags: "Étiquettes",
};

describe("L11-PRE-11 — Exporter une sélection", () => {
  it("une ligne par prestataire, trajet estimé et étiquettes ; une cellule « = » est neutralisée", () => {
    const rows = exportRows(
      [{ id: "v1", name: "=HYPERLINK(\"x\")", typeIds: ["t1"], primaryTypeId: "t1", typeId: "t1", postalCode: "59000", city: "Lille", location: null, tagIds: ["g1"], archived: false, isDemo: false, rating: null, travel: { distanceKm: 5.2, minutes: 6 } }],
      [{ id: "v1", name: "", typeIds: ["t1"], primaryTypeId: "t1", typeId: "t1", postalCode: "59000", city: "Lille", location: null, tagIds: ["g1"], archived: false, isDemo: false, rating: null, contactName: "Claire", email: "c@example.test", phone: "+33 3 20 00 00 00", addressLine: "1 rue X", country: "FR", internalNote: null, internalNoteConfidential: null, bank: { ibanMasked: null, hasBic: false, pendingCheck: null }, indicativePrices: null, website: null, socialLinks: [], siret: null, importedFields: null, fieldValues: {}, files: [] }],
      [{ id: "t1", label: "Traiteur", color: "#000000", position: 0, familyId: null, starterKey: null, fields: [] }],
      [{ id: "g1", label: "bio", groupId: null, familyIds: [], position: 0 }],
      labels,
    );
    expect(rows).toEqual([
      { name: "=HYPERLINK(\"x\")", type: "Traiteur", contact: "Claire", phone: "+33 3 20 00 00 00", email: "c@example.test", address: "1 rue X 59000", city: "Lille", travel: "5.2 km, 6 min", tags: "bio" },
    ]);
    const csv = toCsv(exportTable(rows, labels));
    expect(csv.split("\r\n")[1]).toMatch(/^"?'=HYPERLINK/);
    expect(csv).toContain("+33 3 20 00 00 00");
  });

  it("PRE-01, PRE-11 (lot 63e) — l'export porte la liste des métiers de la fiche, le principal en premier", () => {
    const item = { id: "v2", name: "Studio Lumière", typeIds: ["t3", "t2"], primaryTypeId: "t3", typeId: "t3", postalCode: null, city: "Lyon", location: null, tagIds: [], archived: false, isDemo: false, rating: null, travel: null };
    const rows = exportRows(
      [item],
      [],
      [
        { id: "t2", label: "Vidéaste", color: "#000000", position: 0, familyId: null, starterKey: null, fields: [] },
        { id: "t3", label: "Photographe", color: "#000000", position: 1, familyId: null, starterKey: null, fields: [] },
      ],
      [],
      labels,
    );
    expect(rows[0]!.type).toBe("Photographe, Vidéaste");
  });
});
