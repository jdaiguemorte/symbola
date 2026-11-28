// Lot 71d (HUB-14, BUD-01, PRE-01, UX-07 ; spécification du lot 71, § 5.4 ; maquette 08, C-57, C-61,
// P-16) — l'étape « Doublons » d'un budget, côté serveur. Deux parties : les postes (chaque ligne du
// fichier rangée sous un poste du mariage, et pourquoi ; un poste du fichier réparti d'après le détail,
// « À vérifier » ; les postes « à trouver » sans ligne, à garder ou retirer) et les prestataires (ceux
// du carnet retrouvés tels quels, les doublons possibles comparés colonne par colonne). Aucun choix
// n'est fait à la place de la planner ; chaque décision est contrôlée contre ce que l'import a lui-même
// proposé, dans son organisation (SEC-13). Orchestration : le hub (import), les modules par leur service.
import { appDatabase } from "@symbola/db/client";
import type { ImportValue } from "@symbola/import-engine";
import { decideImportDoublons, getImportWorkingSet } from "@/modules/hub/service";
import { listDefaultVendorSlots } from "@/modules/events/service";
import { getVendorContacts, getVendorsByIds, listVendorTypes } from "@/modules/vendors/service";
import { pendingDoublonsChoices, type DoublonsChoice } from "./doublons-rules";
import { addManualMatch, decideMatches, getImportMatchesView } from "./matching";
import { vendorLikeness, type VendorLikeness } from "./vendor-compare";
import { foldLabel } from "./slot-ranking";

export type PlacementReason = "same" | "close" | "split" | "new" | "manual";

export type DoublonsRow = { rowIndex: number; lineNumber: number; lineLabel: string | null; plannedCents: number | null; slotId: string | null; decided: boolean };

export type DoublonsGroup = {
  fileSlot: string;
  reason: PlacementReason;
  rows: DoublonsRow[];
  plannedCents: number;
  // Le poste qui reçoit toutes les lignes du groupe (null : réparti, ou nouveau poste).
  slotId: string | null;
  pending: boolean;
};

export type DoublonsVendorDoubt = {
  index: number;
  name: string;
  lineNumber: number | null;
  fileSlot: string | null;
  plannedCents: number;
  carnet: { id: string; name: string; typeLabel: string | null; city: string | null };
  likeness: VendorLikeness;
  decision: "proposed" | "same" | "create";
};

export type BudgetDoublonsView = {
  importId: string;
  fileName: string;
  fileSlotCount: number;
  eventSlotCount: number;
  groups: DoublonsGroup[];
  slotOptions: { id: string; label: string }[];
  unusedSlots: { slotId: string; label: string; starter: boolean; decision: "keep" | "remove" | null }[];
  vendors: { total: number; found: number; absent: number; doubts: DoublonsVendorDoubt[] };
  choices: DoublonsChoice[];
};

const text = (value: ImportValue | undefined): string | null => (typeof value === "string" && value.trim() !== "" ? value.trim() : null);
const cents = (value: ImportValue | undefined): number | null => (typeof value === "number" && Number.isSafeInteger(value) ? value : null);

export async function getBudgetDoublonsView(organizationId: string, importId: string): Promise<BudgetDoublonsView | null> {
  const matches = await getImportMatchesView(organizationId, importId);
  if (!matches || matches.entityType !== "budget_lines") return null;
  const set = await getImportWorkingSet(appDatabase(), organizationId, importId);
  if (!set?.matching) return null;
  const rows = matches.rows.filter((row) => row.errors.length === 0 && (row.event?.eventId || row.event?.pendingNew));
  const slotOptions = (rows[0]?.options ?? []).map((option) => ({ id: option.id, label: option.label ?? "" }));
  const slotLabel = new Map(slotOptions.map((slot) => [slot.id, slot.label]));

  const groups = new Map<string, DoublonsGroup>();
  for (const row of rows) {
    const fileSlot = text(row.values.slotLabel) ?? "";
    const match = row.match && row.match.status !== "refused" ? row.match : null;
    const reason: PlacementReason = !match ? "new" : match.manual ? "manual" : (match.placement ?? "close");
    const group = groups.get(foldLabel(fileSlot)) ?? { fileSlot, reason, rows: [], plannedCents: 0, slotId: null, pending: false };
    const decided = !(match?.status === "proposed");
    group.rows.push({ rowIndex: row.rowIndex, lineNumber: row.lineNumber, lineLabel: text(row.values.lineLabel), plannedCents: cents(row.values.plannedAmount), slotId: match?.candidateId ?? null, decided });
    group.plannedCents += cents(row.values.plannedAmount) ?? 0;
    if (reason === "split") group.reason = "split";
    group.pending ||= !decided;
    groups.set(foldLabel(fileSlot), group);
  }
  for (const group of groups.values()) {
    const targets = new Set(group.rows.map((row) => row.slotId));
    group.slotId = group.reason !== "split" && targets.size === 1 ? [...targets][0]! : null;
  }

  const starterLabels = new Set((await listDefaultVendorSlots(organizationId)).map((slot) => foldLabel(slot.label)));
  const unusedSlots = (set.matching.unusedSlots ?? []).flatMap((entry) => {
    const label = slotLabel.get(entry.slotId);
    return label === undefined ? [] : [{ slotId: entry.slotId, label, starter: starterLabels.has(foldLabel(label)), decision: entry.decision }];
  });

  const links = set.matching.vendorLinks ?? [];
  const doubtLinks = links.map((link, index) => ({ link, index })).filter(({ link }) => link.vendorId !== null && (link.decision === "proposed" || link.decision === "same" || link.decision === "create"));
  const carnetIds = doubtLinks.map(({ link }) => link.vendorId!);
  const [summaries, types] = carnetIds.length > 0 ? await Promise.all([getVendorsByIds(organizationId, carnetIds), listVendorTypes(organizationId)]) : [[], []];
  const contacts = carnetIds.length > 0 ? await getVendorContacts(organizationId, carnetIds) : [];
  const typeLabel = new Map(types.map((type) => [type.id, type.label]));
  const doubts: DoublonsVendorDoubt[] = doubtLinks.flatMap(({ link, index }) => {
    const summary = summaries.find((entry) => entry.id === link.vendorId);
    if (!summary) return [];
    const lines = rows.filter((row) => foldLabel(text(row.values.vendorName) ?? "") === foldLabel(link.name));
    const fileSlot = lines[0] ? (slotLabel.get(lines[0].match?.candidateId ?? "") ?? text(lines[0].values.slotLabel)) : null;
    const carnet = { id: summary.id, name: summary.name, typeLabel: summary.typeId ? (typeLabel.get(summary.typeId) ?? null) : null, city: summary.city };
    const phone = contacts.find((entry) => entry.id === summary.id)?.phone ?? null;
    return [
      {
        index,
        name: link.name,
        lineNumber: lines[0]?.lineNumber ?? null,
        fileSlot,
        plannedCents: lines.reduce((sum, row) => sum + (cents(row.values.plannedAmount) ?? 0), 0),
        carnet,
        likeness: vendorLikeness({ name: link.name, type: fileSlot, city: null, email: null, phone: null }, { name: carnet.name, type: carnet.typeLabel, city: carnet.city, email: null, phone }),
        decision: link.decision as DoublonsVendorDoubt["decision"],
      },
    ];
  });

  const orderedGroups = [...groups.values()];
  const choices = pendingDoublonsChoices({
    splitRows: orderedGroups.filter((group) => group.reason === "split").flatMap((group) => group.rows.map((row) => ({ rowIndex: row.rowIndex, fileSlot: group.fileSlot, decided: row.decided }))),
    unusedSlots: unusedSlots.map(({ slotId, label, decision }) => ({ slotId, label, decision })),
    vendors: links.map((link) => ({ name: link.name, decision: link.decision })),
  });
  return {
    importId,
    fileName: matches.fileName,
    fileSlotCount: orderedGroups.length,
    eventSlotCount: slotOptions.length,
    groups: orderedGroups,
    slotOptions,
    unusedSlots,
    vendors: { total: links.length, found: links.filter((link) => link.decision === "found").length, absent: links.filter((link) => link.decision === "absent").length, doubts },
    choices,
  };
}

// Les choix qui restent à « Doublons » (aucun pour un fichier qui n'est pas un budget).
export async function pendingBudgetDoublons(organizationId: string, importId: string): Promise<DoublonsChoice[]> {
  return (await getBudgetDoublonsView(organizationId, importId))?.choices ?? [];
}

// « Rangé sous le poste » : toutes les lignes d'un poste du fichier sous un poste du mariage proposé
// pour ces lignes, ou sous un nouveau poste aux mots du fichier (`null`).
export async function placeBudgetGroup(organizationId: string, importId: string, input: { rowIndexes: number[]; slotId: string | null }): Promise<boolean> {
  const view = await getImportMatchesView(organizationId, importId);
  if (!view || view.entityType !== "budget_lines") return false;
  const rows = input.rowIndexes.map((rowIndex) => view.rows.find((row) => row.rowIndex === rowIndex));
  if (rows.length === 0 || rows.some((row) => !row)) return false;
  if (input.slotId === null) {
    const matched = rows.filter((row) => row!.match);
    return matched.length === 0 || decideMatches(organizationId, importId, matched.map((row) => ({ rowIndex: row!.rowIndex, decision: "refuse" as const })));
  }
  for (const row of rows) if (!(await addManualMatch(organizationId, importId, row!.rowIndex, input.slotId))) return false;
  return true;
}

// « C'est juste » : le partage proposé d'un poste du fichier est retenu, ligne par ligne.
export async function confirmBudgetSplit(organizationId: string, importId: string, rowIndexes: number[]): Promise<boolean> {
  const view = await getImportMatchesView(organizationId, importId);
  if (!view || view.entityType !== "budget_lines") return false;
  const rows = view.rows.filter((row) => rowIndexes.includes(row.rowIndex) && row.match?.placement === "split");
  if (rows.length === 0 || rows.length !== rowIndexes.length) return false;
  return decideMatches(organizationId, importId, rows.map((row) => ({ rowIndex: row.rowIndex, decision: "accept" as const })));
}

export async function decideBudgetDoublons(
  organizationId: string,
  importId: string,
  input: { slots?: { slotId: string; decision: "keep" | "remove" }[]; vendors?: { name: string; decision: "same" | "create" }[] },
): Promise<boolean> {
  return decideImportDoublons(appDatabase(), { organizationId, importId, ...input });
}
