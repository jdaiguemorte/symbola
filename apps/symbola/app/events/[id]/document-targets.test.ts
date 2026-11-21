import { describe, expect, it } from "vitest";
import { canMoveTo, moveTargets, type FolderTarget } from "./document-targets";

const targets: FolderTarget[] = [
  { key: "quotes", name: "Devis des prestataires", folderId: "f-quotes", budgetKind: "quote", virtual: false },
  { key: "invoices", name: "Factures des prestataires", folderId: null, budgetKind: "invoice", virtual: true },
  { key: "contracts", name: "Contrats", folderId: "f-contracts", budgetKind: "contract", virtual: false },
  { key: "mine", name: "Plans", folderId: "f-plans", budgetKind: null, virtual: false },
  { key: "misc", name: "Divers", folderId: null, budgetKind: null, virtual: false },
];

describe("DOC-01, BUD-04 — « Déplacer vers… » chaque pièce (lot 63c, M8)", () => {
  it("une pièce de l'équipe va dans tout dossier de l'équipe ou dans « Divers », pas là où elle est", () => {
    const piece = { type: "team" as const, id: "d", label: "devis-dj.pdf", folderId: null };
    expect(moveTargets(piece, targets).map((target) => target.key)).toEqual(["quotes", "contracts", "mine"]);
    expect(moveTargets({ ...piece, folderId: "f-quotes" }, targets).map((target) => target.key)).toEqual(["contracts", "mine", "misc"]);
  });

  it("une pièce de ligne du budget ne change que de dossier typé (sa nature), même sans dossier de l'équipe", () => {
    const piece = { type: "budget" as const, id: "a", label: "Traiteur", kind: "quote" as const };
    expect(moveTargets(piece, targets).map((target) => target.key)).toEqual(["invoices", "contracts"]);
    expect(canMoveTo(piece, targets[3]!)).toBe(false);
  });
});
