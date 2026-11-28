// Lot 71d (HUB-14, BUD-01, PRE-01 ; spécification du lot 71, § 5.4, critère 1 ; maquette 08, « Doublons »)
// — une seule fonction de rangement des postes : même nom, synonymes du métier, préfixe, poste combiné
// réparti d'après le détail de chaque ligne, ressemblance, sinon un nouveau poste aux mots du fichier.
// Chaque ligne reste une ligne : le rangement ne fond jamais deux lignes.
import { describe, expect, it } from "vitest";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { budgetRankingData, rankBudgetRows, type RankingRow } from "./slot-ranking";

// Les postes de départ de l'agence (données de départ, français), copiés dans le mariage.
const SLOTS = [
  "Lieu de réception",
  "Traiteur",
  "Photographe",
  "Vidéaste",
  "DJ / musiciens",
  "Fleuriste",
  "Décoration",
  "Officiant de cérémonie laïque",
  "Pièce montée / gâteau",
  "Coiffure et maquillage",
  "Papeterie",
  "Transport des invités",
].map((label, index) => ({ id: `slot-${index}`, label }));
const slotId = (label: string) => SLOTS.find((slot) => slot.label === label)!.id;

// budget.csv lu comme le fait l'assistant : la colonne « Poste » vide reprend celle du dessus (lot 67a).
function budgetCsvRows(): RankingRow[] {
  const text = new TextDecoder().decode(readImportCorpusFile("tableur-planner/budget.csv"));
  const [, ...lines] = text.trim().split("\n");
  let slot: string | null = null;
  return lines.map((line, rowIndex) => {
    const [poste, detail] = line.split(";");
    slot = poste?.trim() ? poste.trim() : slot;
    return { rowIndex, slotLabel: slot, lineLabel: detail?.trim() || null };
  });
}

describe("HUB-14 — Le rangement des postes (lot 71d)", () => {
  const data = budgetRankingData();

  it("critère 1 : les 14 lignes de budget.csv restent 14 lignes, chacune rangée sous un poste", () => {
    const rows = budgetCsvRows();
    expect(rows).toHaveLength(14);
    const placements = rankBudgetRows(rows, SLOTS, data);
    expect(placements).toHaveLength(14);
    expect(new Set(placements.map((placement) => placement.rowIndex)).size).toBe(14);
  });

  it("critère 1 : « Lieu » est rangé sous « Lieu de réception », nom proche", () => {
    const placements = rankBudgetRows(budgetCsvRows(), SLOTS, data);
    const venue = placements.filter((placement) => placement.fileSlot === "Lieu");
    expect(venue).toHaveLength(2);
    for (const placement of venue) expect(placement).toMatchObject({ slotId: slotId("Lieu de réception"), reason: "close" });
  });

  it("critère 1 : « Photo et vidéo » est réparti d'après le détail : « Reportage photo » → Photographe, « Film » → Vidéaste, « À vérifier »", () => {
    const placements = rankBudgetRows(budgetCsvRows(), SLOTS, data);
    const split = placements.filter((placement) => placement.fileSlot === "Photo et vidéo");
    expect(split.map((placement) => [placement.slotId, placement.reason])).toEqual([
      [slotId("Photographe"), "split"],
      [slotId("Vidéaste"), "split"],
    ]);
  });

  it("trois lignes « Traiteur » restent trois lignes sous le même poste, avec leur détail", () => {
    const rows = budgetCsvRows();
    const placements = rankBudgetRows(rows, SLOTS, data).filter((placement) => placement.fileSlot === "Traiteur");
    expect(placements).toHaveLength(3);
    expect(new Set(placements.map((placement) => placement.slotId))).toEqual(new Set([slotId("Traiteur")]));
    expect(placements.every((placement) => placement.reason === "same")).toBe(true);
  });

  it("synonymes du métier (« Fleurs » → Fleuriste, « Musique » → DJ / musiciens) et préfixe (« Transport » → Transport des invités)", () => {
    const placements = rankBudgetRows(budgetCsvRows(), SLOTS, data);
    const first = (fileSlot: string) => placements.find((placement) => placement.fileSlot === fileSlot)!;
    expect(first("Fleurs")).toMatchObject({ slotId: slotId("Fleuriste"), reason: "close" });
    expect(first("Musique")).toMatchObject({ slotId: slotId("DJ / musiciens"), reason: "close" });
    expect(first("Transport")).toMatchObject({ slotId: slotId("Transport des invités"), reason: "close" });
    expect(first("Papeterie")).toMatchObject({ slotId: slotId("Papeterie"), reason: "same" });
  });

  it("aucun poste proche : un nouveau poste aux mots du fichier", () => {
    const placements = rankBudgetRows([{ rowIndex: 0, slotLabel: "Tenues", lineLabel: "Robe" }], SLOTS, data);
    expect(placements).toEqual([{ rowIndex: 0, fileSlot: "Tenues", slotId: null, reason: "new" }]);
  });

  it("un poste combiné dont l'un des métiers manque au mariage n'est pas réparti", () => {
    const withoutVideo = SLOTS.filter((slot) => slot.label !== "Vidéaste");
    const placements = rankBudgetRows([{ rowIndex: 0, slotLabel: "Photo et vidéo", lineLabel: "Film" }], withoutVideo, data);
    expect(placements[0]!.reason).not.toBe("split");
  });

  it("deux postes du mariage aussi proches l'un que l'autre : aucun n'est choisi d'office", () => {
    const slots = [
      { id: "a", label: "Lieu de cérémonie" },
      { id: "b", label: "Lieu de réception" },
    ];
    const placements = rankBudgetRows([{ rowIndex: 0, slotLabel: "Lieu de", lineLabel: null }], slots, { synonyms: [], combined: [], details: [] });
    expect(placements[0]).toMatchObject({ slotId: null, reason: "new" });
  });
});
