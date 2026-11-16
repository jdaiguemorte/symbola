// Lot 37b (DOC-12, D12) — règles pures du relevé de stockage : le mois du relevé (heure de Paris,
// passage à l'heure d'été compris) et la somme par nature, évènements d'essai écartés.
import { describe, expect, it } from "vitest";
import { snapshotMonth, sumStorage } from "./storage-snapshots";

describe("DOC-12 — Compteur de stockage par organisation et par nature", () => {
  it("le relevé porte sur le mois civil de Paris : la veille au soir, le jour même, le passage à l'heure d'été", () => {
    expect(snapshotMonth(new Date("2026-11-30T22:59:59Z"))).toBe("2026-11-01");
    expect(snapshotMonth(new Date("2026-11-30T23:00:00Z"))).toBe("2026-12-01");
    expect(snapshotMonth(new Date("2027-03-31T21:59:59Z"))).toBe("2027-03-01");
    expect(snapshotMonth(new Date("2027-03-31T22:00:00Z"))).toBe("2027-04-01");
  });

  it("additionne par nature, les quatre natures toujours présentes, sans les évènements d'essai", () => {
    const totals = sumStorage(
      [
        { nature: "uploads", eventId: "evt-1", files: 2, bytes: 2500 },
        { nature: "uploads", eventId: null, files: 1, bytes: 100 },
        { nature: "images", eventId: "evt-demo", files: 4, bytes: 9999 },
        { nature: "legal_originals", eventId: null, files: 1, bytes: 4000 },
      ],
      new Set(["evt-demo"]),
    );
    expect(totals).toEqual({
      legal_originals: { files: 1, bytes: 4000 },
      signed_documents: { files: 0, bytes: 0 },
      uploads: { files: 3, bytes: 2600 },
      images: { files: 0, bytes: 0 },
    });
  });
});
