// Lot 71e (HUB-14, PRE-01, PRE-02, CHR-08 ; spécification du lot 71, § 5.5 ; maquettes 10 et 11) — les
// règles pures de l'aperçu d'un PDF de prestataires retenus et d'un PDF de programme. Rien n'est écrit
// ici. Prestataires : la fiche du carnet (trouvée telle quelle, doublon possible, ou nouvelle fiche), le
// poste du budget par le rangement unique du lot 71d (même nom, synonymes, préfixe, ressemblance, sinon
// un nouveau poste aux mots de l'agence), le contrat selon la réponse (I1) ; seules les lignes
// incertaines sont « À vérifier », avec leur raison. Programme : chaque moment dans sa journée, sa
// forme, et les nombres de « Vérifier » ; aucune heure de fin n'est déduite.
import { importFigures, personFromFullName, sameCouple, takeoverContractFor, type CoupleCheck, type CouplePerson, type EventVendorsImportFigures, type ImportAnswers, type ProgramImportFigures, type ProgramImportRow, type TakeoverContract } from "@symbola/contracts";
import type { EventVendorsExportRow, ProgramExport } from "@symbola/import-engine";
import type { ImportPdfDecisions } from "@symbola/db/schema/hub";
import { foldLabel, rankBudgetRows, type RankingData } from "./slot-ranking";
import { findCarnetVendor } from "./vendor-compare";
import { matchImportVendorType, proposeImportSlot } from "@/lib/vendors/event-vendors-import-rules";

// —— Le couple (R10) ——————————————————————————————————————————————————————————————————

export function vendorsFileCouple(clients: readonly string[]): CouplePerson[] {
  return clients.map(personFromFullName);
}

// Le programme ne nomme les mariés que par leur prénom : le titre (« Mariage Clémence & Bastien ») et
// les interlocuteurs de rôle « marié » (« Mariée - Clémence »).
export function programFileCouple(program: Pick<ProgramExport, "title" | "rows">): CouplePerson[] {
  const people: CouplePerson[] = [];
  const add = (name: string | null | undefined) => {
    const first = name?.trim().split(/\s+/)[0];
    if (first && !people.some((person) => foldLabel(person.firstName ?? "") === foldLabel(first))) people.push({ firstName: first, lastName: null });
  };
  const title = program.title ?? "";
  const parts = title.split(/\s+(?:&|et|and)\s+/i);
  if (parts.length === 2) {
    add(parts[0]!.trim().split(/\s+/).at(-1));
    add(parts[1]);
  }
  for (const row of program.rows) for (const contact of row.contacts) if (contact.kind === "client") add(contact.name);
  return people;
}

export function coupleCheck(file: readonly CouplePerson[], event: readonly { firstName: string; lastName: string | null }[]): CoupleCheck {
  return sameCouple(file, event);
}

// —— Les prestataires retenus (maquette 10) ——————————————————————————————————————————————

export type PdfSlotOption = { id: string; label: string; vendorNames: string[] };
export type PdfCarnetVendor = { id: string; name: string; city: string | null };

// « no_slot » : aucun poste proche, un poste sera créé ; « split » : un poste combiné du mariage, d'après
// le détail ; « similar » : un poste au nom seulement ressemblant ; « possible_vendor » : une fiche du
// carnet ressemble, sans être la même.
export type VendorVerifyReason = "no_slot" | "split" | "similar" | "possible_vendor";

export type VendorsPreviewRow = EventVendorsExportRow & {
  vendor: PdfCarnetVendor | null;
  // « found » : trouvée dans le carnet ; « possible » : un doublon possible, proposé ; « new » : nouvelle fiche.
  vendorMatch: "found" | "possible" | "new";
  slot: { kind: "existing"; id: string; label: string } | { kind: "new"; label: string };
  verify: VendorVerifyReason | null;
  // Déjà retenu sur ce poste : rien ne sera écrit pour lui.
  alreadyRetained: boolean;
  contract: TakeoverContract;
  skip: boolean;
};

export type VendorsPreviewContext = {
  slots: readonly PdfSlotOption[];
  carnet: readonly PdfCarnetVendor[];
  types: readonly { id: string; label: string }[];
  // Les prestataires déjà retenus (ou contrat signé) de ce mariage : leur poste et leur fiche.
  engaged: readonly { slotId: string; vendorId: string | null; vendorName: string }[];
  ranking: RankingData;
  synonymGroups: readonly (readonly string[])[];
};

// Le mot d'un nouveau poste : le métier de l'agence qui lui correspond (« Baby-Sitter » → le métier du
// carnet), sinon les mots du fichier.
export function newSlotLabel(type: string, types: VendorsPreviewContext["types"], synonymGroups: VendorsPreviewContext["synonymGroups"]): string {
  const typeId = matchImportVendorType(type, types, synonymGroups);
  return (typeId ? types.find((entry) => entry.id === typeId)?.label : null) ?? type.trim();
}

// Un métier du fichier sous un poste du mariage, quand le rangement unique n'en trouve pas : un poste
// combiné qui porte le même nom (« Coiffeur(se) - Maquilleur(se) » et « Coiffure et maquillage »), ou un
// poste dont le nom est (ou commence par) un mot du métier (« DJ » → « Musique et animation »). Un seul
// poste convient, ou aucun n'est choisi.
export function slotByTrade(type: string, slots: readonly PdfSlotOption[], ranking: RankingData): PdfSlotOption | null {
  const folded = foldLabel(type);
  const combined = ranking.combined.find((item) => item.labels.some((label) => foldLabel(label) === folded));
  if (combined) {
    const found = slots.filter((slot) => combined.labels.some((label) => foldLabel(label) === foldLabel(slot.label)));
    if (found.length === 1) return found[0]!;
  }
  const words = ranking.synonyms.filter((group) => group.words.some((word) => foldLabel(word) === folded)).flatMap((group) => group.words.map(foldLabel));
  const found = slots.filter((slot) => words.some((word) => word !== "" && (foldLabel(slot.label) === word || foldLabel(slot.label).startsWith(`${word} `))));
  return found.length === 1 ? found[0]! : null;
}

export function vendorsPreviewRows(rows: readonly EventVendorsExportRow[], context: VendorsPreviewContext, decisions: ImportPdfDecisions, answers: ImportAnswers | null): VendorsPreviewRow[] {
  const placements = new Map(rankBudgetRows(rows.map((row) => ({ rowIndex: row.line, slotLabel: row.type, lineLabel: row.name })), context.slots, context.ranking).map((entry) => [entry.rowIndex, entry] as const));
  const chosen = new Map((decisions.vendorRows ?? []).map((entry) => [entry.line, entry] as const));
  const slotById = new Map(context.slots.map((slot) => [slot.id, slot] as const));
  const vendorById = new Map(context.carnet.map((vendor) => [vendor.id, vendor] as const));
  return rows.map((row) => {
    const decision = chosen.get(row.line);
    // La fiche : le choix de la planner (une fiche de l'organisation, ou « new »), sinon la proposition.
    const match = findCarnetVendor(row.name, context.carnet);
    const proposedVendor = match.kind === "none" ? null : (vendorById.get(match.vendorId) ?? null);
    const decidedVendor = decision?.vendor === "new" ? "new" : decision?.vendor && vendorById.has(decision.vendor) ? vendorById.get(decision.vendor)! : null;
    const vendor = decidedVendor === "new" ? null : (decidedVendor ?? proposedVendor);
    const vendorMatch: VendorsPreviewRow["vendorMatch"] = vendor === null ? "new" : decidedVendor || match.kind === "found" ? "found" : "possible";
    // Le poste : celui où ce prestataire est déjà, puis le rangement unique.
    const already = context.slots.filter((slot) => slot.vendorNames.some((name) => foldLabel(name) === foldLabel(row.name)));
    const placement = placements.get(row.line);
    const decidedSlot = decision?.slot === "new" ? "new" : decision?.slot && slotById.has(decision.slot) ? slotById.get(decision.slot)! : null;
    // Le rangement unique d'abord ; sinon les groupes de métiers du carnet (« Coiffeur(se) - Maquilleur(se) »
    // sous « Coiffure et maquillage », lot 67e).
    const tradeId = placement?.slotId ? null : proposeImportSlot({ type: row.type, name: row.name }, context.slots, context.synonymGroups);
    const byTrade = placement?.slotId ? null : (tradeId ?? slotByTrade(row.type, context.slots, context.ranking)?.id ?? null);
    const proposedSlot = already.length === 1 ? already[0]! : placement?.slotId ? (slotById.get(placement.slotId) ?? null) : byTrade ? (slotById.get(byTrade) ?? null) : null;
    const slotChoice = decidedSlot === "new" ? null : (decidedSlot ?? proposedSlot);
    const slot: VendorsPreviewRow["slot"] = slotChoice ? { kind: "existing", id: slotChoice.id, label: slotChoice.label } : { kind: "new", label: newSlotLabel(row.type, context.types, context.synonymGroups) };
    const reviewed = decision !== undefined && (decision.vendor !== undefined || decision.slot !== undefined || decision.reviewed === true);
    const slotReason: VendorVerifyReason | null = decidedSlot || already.length === 1 || byTrade ? null : !proposedSlot ? "no_slot" : placement?.reason === "split" ? "split" : null;
    const verify = reviewed || row.planner ? null : vendorMatch === "possible" ? "possible_vendor" : slotReason;
    const alreadyRetained = vendor !== null && slot.kind === "existing" && context.engaged.some((entry) => entry.slotId === slot.id && (entry.vendorId === vendor.id || foldLabel(entry.vendorName) === foldLabel(vendor.name)));
    return {
      ...row,
      vendor,
      vendorMatch,
      slot,
      verify,
      alreadyRetained,
      contract: takeoverContractFor(answers, row.line),
      // La ligne de la planner elle-même n'est jamais reprise.
      skip: row.planner || decision?.skip === true,
    };
  });
}

export function vendorsFigures(rows: readonly VendorsPreviewRow[]): EventVendorsImportFigures {
  const written = rows.filter((row) => !row.skip && !row.alreadyRetained);
  const figures = importFigures(
    {
      kind: "event_vendors",
      vendors: written.map((row) => ({
        slotKey: row.slot.kind === "existing" ? row.slot.id : `new:${foldLabel(row.slot.label)}`,
        newSlot: row.slot.kind === "new",
        vendorKey: row.vendor ? row.vendor.id : `new:${foldLabel(row.name)}`,
        inCarnet: row.vendor !== null,
        contract: row.contract,
      })),
    },
    "",
  );
  if (figures.kind !== "event_vendors") throw new Error(figures.kind);
  return figures;
}

// —— Le programme (maquette 11) ———————————————————————————————————————————————————————————

// Le nom d'une journée par rapport au jour J (règle du lot 67d, R11 = b) : la date complète s'écrit à côté.
export function programDayKind(date: string | null, eventDate: string | null): "eve" | "main" | "nextDay" | "other" {
  if (!date || !eventDate) return "other";
  const days = Math.round((Date.parse(`${date}T00:00:00Z`) - Date.parse(`${eventDate}T00:00:00Z`)) / 86_400_000);
  return days === 0 ? "main" : days === -1 ? "eve" : days === 1 ? "nextDay" : "other";
}

export type ProgramPreviewDay = { date: string | null; kind: ReturnType<typeof programDayKind>; rows: ProgramImportRow[] };

export function programDays(rows: readonly ProgramImportRow[], eventDate: string | null): ProgramPreviewDay[] {
  const days = new Map<string, ProgramPreviewDay>();
  for (const row of rows) {
    const key = row.momentDate ?? "";
    const day = days.get(key) ?? { date: row.momentDate, kind: programDayKind(row.momentDate, eventDate), rows: [] };
    day.rows.push(row);
    days.set(key, day);
  }
  return [...days.values()].sort((a, b) => (a.date ?? "").localeCompare(b.date ?? ""));
}

export function programFigures(rows: readonly ProgramImportRow[], directory: number): ProgramImportFigures {
  const figures = importFigures(
    {
      kind: "program",
      items: rows.map((row) => ({ day: row.momentDate, timing: row.timing ?? "span", endMissing: row.endTime === null, hiddenFromClients: row.hiddenFromClients === true })),
      directory,
    },
    "",
  );
  if (figures.kind !== "program") throw new Error(figures.kind);
  return figures;
}

// L'annuaire non repris (R14, I4) : les intervenants de l'en-tête, tels que lus ; les mariés et l'agence
// en sont écartés au moment de les ajouter au carnet.
export function programDirectory(program: Pick<ProgramExport, "speakers">): { role: string; company: string | null; contact: string | null; phone: string | null }[] {
  return program.speakers.map(({ role, company, contact, phone }) => ({ role, company, contact, phone }));
}
