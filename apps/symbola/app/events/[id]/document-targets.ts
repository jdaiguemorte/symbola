// Lot 63c (DOC-01, BUD-04 ; maquette M8) — où une pièce peut aller. Une pièce de l'équipe va dans
// n'importe quel dossier de l'équipe ou dans « Divers » ; une pièce de ligne du budget (devis, contrat,
// facture d'un prestataire) reste sur sa ligne et ne change que de dossier typé, donc de nature.
import type { BudgetDocumentKind } from "@symbola/contracts";

export type PieceRef = { type: "team"; id: string; label: string; folderId: string | null } | { type: "budget"; id: string; label: string; kind: BudgetDocumentKind };

export type FolderTarget = {
  key: string;
  name: string;
  // Le dossier de l'équipe (null : « Divers », ou un dossier typé pas encore créé).
  folderId: string | null;
  // La nature des pièces de ligne qui s'y rangent (dossiers typés seulement).
  budgetKind: BudgetDocumentKind | null;
  // Dossier typé montré pour ses pièces de ligne, sans dossier de l'équipe derrière.
  virtual: boolean;
};

export function canMoveTo(piece: PieceRef, target: FolderTarget): boolean {
  if (piece.type === "team") return !target.virtual && target.folderId !== piece.folderId;
  return target.budgetKind !== null && target.budgetKind !== piece.kind;
}

export function moveTargets(piece: PieceRef, targets: FolderTarget[]): FolderTarget[] {
  return targets.filter((target) => canMoveTo(piece, target));
}
