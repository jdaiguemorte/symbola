// Lot 71d (HUB-14, UX-07 ; spécification du lot 71, § 5.4 ; maquette 08, C-57, P-16) — l'étape
// « Doublons » d'un budget, en règles pures : les choix qui restent à faire, dans l'ordre de l'écran (un
// poste du fichier réparti entre deux postes, un poste du mariage sans ligne, un doublon possible du
// carnet), chacun avec l'ancre de son bloc. « Continuer » répond toujours : il mène au premier.

export type DoublonsChoicesInput = {
  splitRows: { rowIndex: number; fileSlot: string; decided: boolean }[];
  unusedSlots: { slotId: string; label: string; decision: "keep" | "remove" | null }[];
  vendors: { name: string; decision: string }[];
};

export type DoublonsChoice = { kind: "split" | "slot" | "vendor"; label: string; anchor: string };

export function pendingDoublonsChoices(input: DoublonsChoicesInput): DoublonsChoice[] {
  const choices: DoublonsChoice[] = [];
  const splitGroups = new Map<string, { firstRow: number; pending: boolean }>();
  for (const row of input.splitRows) {
    const group = splitGroups.get(row.fileSlot) ?? { firstRow: row.rowIndex, pending: false };
    group.firstRow = Math.min(group.firstRow, row.rowIndex);
    group.pending ||= !row.decided;
    splitGroups.set(row.fileSlot, group);
  }
  for (const [fileSlot, group] of splitGroups) if (group.pending) choices.push({ kind: "split", label: fileSlot, anchor: `poste-${group.firstRow}` });
  for (const slot of input.unusedSlots) if (slot.decision === null) choices.push({ kind: "slot", label: slot.label, anchor: `poste-vide-${slot.slotId}` });
  input.vendors.forEach((vendor, index) => {
    if (vendor.decision === "proposed") choices.push({ kind: "vendor", label: vendor.name, anchor: `prestataire-${index}` });
  });
  return choices;
}

// Où mène « Continuer » quand des choix restent : l'écran, qui les nomme, ouvert sur le premier.
export function doublonsContinueHref(stepHref: string, choices: readonly DoublonsChoice[]): string | null {
  const first = choices[0];
  return first ? `${stepHref}?reste=1#${first.anchor}` : null;
}
