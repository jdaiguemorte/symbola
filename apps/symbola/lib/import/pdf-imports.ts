// Lot 71e (HUB-14, PRE-01, PRE-02, CHR-06, CHR-08, UX-17 ; spécification du lot 71, § 5.5 ; maquettes 10
// et 11) — les PDF des prestataires retenus et du programme dans l'assistant commun. Le hub garde le
// brouillon (ce qui a été lu) et le journal ; chaque module écrit par son service.ts (ARC-01). Étapes :
// Fichier (le couple, R10), Questions (les contrats, I1), Postes, Vérifier, pour les prestataires ;
// Fichier, Interlocuteurs, Vérifier, pour le programme. « Vérifier » et le bilan disent les mêmes nombres
// (importFigures). Rien n'est écrit avant « Importer » ; si le journal ne s'écrit pas, ce qui a été
// écrit est retiré.
import type { CoupleCheck, EventVendorsImportFigures, ImportAnswers, ImportedItem, ProgramImportFigures, ProgramImportRow, ProgramImportSpeaker } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { starterVendorTypeSynonymGroups } from "@symbola/starter-templates";
import { ENGAGED_CANDIDATE_STATUSES } from "@symbola/contracts";
import {
  getEvent,
  importVendorSlotsForBudget,
  listEventVendorSlots,
  listVendorCandidates,
  previewEventProgramDocument,
  writeEventProgramDocument,
  type ImportedProgramPreview,
} from "@/modules/events/service";
import { discardImportLeftovers, getImportAnswers, getImportLeftovers, getPdfImportDraft, recordAppliedImport, type ImportResult, type PdfImportDraft } from "@/modules/hub/service";
import { addVendorPhones, importNamedVendors, listVendorDirectoryCandidates, listVendorImportCandidates, listVendorTypes } from "@/modules/vendors/service";
import { matchImportVendorType } from "@/lib/vendors/event-vendors-import-rules";
import { undoImportedItems, writtenFields } from "./apply";
import { budgetRankingData } from "./slot-ranking";
import { coupleCheck, programDays, programDirectory, programFigures, programFileCouple, vendorsFigures, vendorsFileCouple, vendorsPreviewRows, type PdfSlotOption, type ProgramPreviewDay, type VendorsPreviewRow } from "./pdf-import-rules";
import { speakerKind } from "@/modules/events/program-import-rules";
import { planningSoftwareProfile } from "@symbola/starter-templates";

const db = () => appDatabase();

export type PdfImportEvent = { id: string; names: { firstName: string; lastName: string | null }[]; eventDate: string | null };

type Base = {
  draft: PdfImportDraft;
  event: PdfImportEvent;
  // Le couple du fichier, tel qu'écrit (« Clémence MARTIN, Bastien LEROY ») ; « different » arrête l'étape
  // Fichier tant que la planner n'a pas dit « C'est bien ce mariage ».
  fileCouple: string[];
  fileDate: string | null;
  couple: CoupleCheck;
  coupleStop: boolean;
};

export type VendorsImportView = Base & {
  kind: "event_vendors";
  answers: ImportAnswers | null;
  rows: VendorsPreviewRow[];
  slots: PdfSlotOption[];
  carnet: { id: string; name: string; city: string | null }[];
  figures: EventVendorsImportFigures;
  toVerify: number;
  // La question des contrats attend sa réponse.
  contractsPending: boolean;
};

export type ProgramImportView = Base & {
  kind: "program";
  preview: ImportedProgramPreview;
  days: ProgramPreviewDay[];
  speakers: ProgramImportSpeaker[];
  figures: ProgramImportFigures;
};

async function baseOf(organizationId: string, importId: string, now: Date): Promise<{ draft: PdfImportDraft; event: PdfImportEvent } | null> {
  const draft = await getPdfImportDraft(db(), organizationId, importId, now);
  if (!draft?.targetEventId) return null;
  // Un mariage d'une autre organisation, ou disparu : l'import n'existe pas (SEC-13).
  const event = await getEvent(organizationId, draft.targetEventId).catch(() => null);
  if (!event || event.isDemo) return null;
  return { draft, event: { id: event.id, names: event.clients.map((client) => ({ firstName: client.firstName, lastName: client.lastName })), eventDate: event.eventDate } };
}

export async function getVendorsImportView(organizationId: string, importId: string, now: Date = new Date()): Promise<VendorsImportView | null> {
  const base = await baseOf(organizationId, importId, now);
  if (!base || base.draft.document.kind !== "event_vendors") return null;
  const exported = base.draft.document.export;
  const [slotRows, candidates, carnet, types, answers] = await Promise.all([
    listEventVendorSlots(organizationId, base.event.id),
    listVendorCandidates(organizationId, base.event.id),
    listVendorImportCandidates(organizationId),
    listVendorTypes(organizationId),
    getImportAnswers(db(), organizationId, importId),
  ]);
  const onSlots = candidates.filter((candidate) => candidate.status !== "dismissed");
  const slots: PdfSlotOption[] = slotRows.filter((slot) => !slot.notRequired).map((slot) => ({ id: slot.id, label: slot.label, vendorNames: onSlots.filter((candidate) => candidate.vendorSlotId === slot.id).map((candidate) => candidate.vendorName) }));
  const engaged = candidates.filter((candidate) => ENGAGED_CANDIDATE_STATUSES.includes(candidate.status)).map((candidate) => ({ slotId: candidate.vendorSlotId, vendorId: candidate.vendorId, vendorName: candidate.vendorName }));
  const rows = vendorsPreviewRows(exported.rows, { slots, carnet, types: types.map(({ id, label }) => ({ id, label })), engaged, ranking: budgetRankingData(), synonymGroups: starterVendorTypeSynonymGroups() }, base.draft.decisions, answers);
  const couple = coupleCheck(vendorsFileCouple(exported.clients), base.event.names);
  return {
    kind: "event_vendors",
    ...base,
    fileCouple: exported.clients,
    fileDate: exported.eventDate,
    couple,
    coupleStop: couple === "different" && base.draft.decisions.coupleConfirmed !== true,
    answers,
    rows,
    slots,
    carnet,
    figures: vendorsFigures(rows),
    toVerify: rows.filter((row) => !row.skip && row.verify !== null).length,
    contractsPending: !answers?.contracts,
  };
}

export async function getProgramImportView(organizationId: string, importId: string, now: Date = new Date()): Promise<ProgramImportView | null> {
  const base = await baseOf(organizationId, importId, now);
  if (!base || base.draft.document.kind !== "program") return null;
  const program = base.draft.document.program;
  const speakerSlots = Object.fromEntries((base.draft.decisions.speakerSlots ?? []).map((entry) => [entry.index, entry.slotId] as const));
  const preview = await previewEventProgramDocument({ organizationId, eventId: base.event.id, program, speakerSlots, catalogVendors: await listVendorImportCandidates(organizationId) });
  const couple = coupleCheck(programFileCouple(program), base.event.names);
  const fileCouple = programFileCouple(program).map((person) => person.firstName ?? "").filter(Boolean);
  return {
    kind: "program",
    ...base,
    fileCouple,
    fileDate: program.eventDate,
    couple,
    coupleStop: couple === "different" && base.draft.decisions.coupleConfirmed !== true,
    preview,
    days: programDays(preview.rows, preview.eventDate),
    speakers: preview.speakers,
    figures: programFigures(preview.rows, program.speakers.length),
  };
}

export type PdfConfirmResult =
  | { status: "applied"; result: ImportResult }
  | { status: "not_found" }
  | { status: "blocked"; reason: "couple" | "contracts" | "nothing" };

async function record(organizationId: string, userId: string, importId: string, items: ImportedItem[], result: ImportResult, leftovers?: { directory: ReturnType<typeof programDirectory> }): Promise<boolean> {
  let recorded = false;
  try {
    recorded = await recordAppliedImport(db(), {
      organizationId,
      importId,
      items: items.map(({ module, kind, elementId, action, previous, written }) => ({ module, kind, elementId, action, previous, written, fields: writtenFields(written) })),
      result,
      ...(leftovers && leftovers.directory.length > 0 ? { leftovers } : {}),
    });
  } finally {
    if (!recorded) await undoImportedItems(organizationId, userId, items);
  }
  return recorded;
}

// Prestataires retenus : les fiches à créer (avec contact, e-mail, téléphone), puis chaque prestataire
// retenu sur son poste (créé une fois par mot), son contrat tel que la planner l'a dit ; jamais une
// relance « à faire signer » (I2).
export async function confirmVendorsImport(input: { organizationId: string; userId: string; importId: string; now?: Date }): Promise<PdfConfirmResult> {
  const view = await getVendorsImportView(input.organizationId, input.importId, input.now);
  if (!view) return { status: "not_found" };
  if (view.coupleStop) return { status: "blocked", reason: "couple" };
  if (view.contractsPending) return { status: "blocked", reason: "contracts" };
  const written = view.rows.filter((row) => !row.skip && !row.alreadyRetained);
  if (written.length === 0) return { status: "blocked", reason: "nothing" };
  const types = await listVendorTypes(input.organizationId);
  const synonyms = starterVendorTypeSynonymGroups();
  const toCreate = written.filter((row) => row.vendor === null);
  const created = await importNamedVendors(
    input.organizationId,
    toCreate.map((row) => ({ name: row.name, typeId: matchImportVendorType(row.type, types, synonyms), contactName: row.contact, email: row.email, phone: row.phone?.replace(/[.\s]+$/, "") ?? null })),
  );
  const items: ImportedItem[] = [...created.items];
  try {
    const links = written.flatMap((row) => {
      const vendorId = row.vendor?.id ?? created.idByName.get(row.name.trim());
      return vendorId ? [{ name: row.name, vendorId, vendorName: row.vendor?.name ?? row.name.trim() }] : [];
    });
    const contracts: ImportAnswers["contracts"] = view.answers!.contracts!.answer === "per_line" ? { answer: "per_line", signedRows: view.answers!.contracts!.signedRows ?? [] } : view.answers!.contracts!;
    const slots = await importVendorSlotsForBudget({
      organizationId: input.organizationId,
      rows: written.map((row) => ({
        rowIndex: row.line,
        values: { slotLabel: row.slot.label, vendorName: row.name },
        importedFields: {},
        matchId: row.slot.kind === "existing" ? row.slot.id : null,
        eventId: view.event.id,
      })),
      answers: { contracts },
      takeover: true,
      vendorLinks: links,
    });
    items.push(...slots.items);
  } catch (error) {
    await undoImportedItems(input.organizationId, input.userId, items);
    throw error;
  }
  const result: ImportResult = {
    created: written.length,
    updated: 0,
    unchanged: view.rows.filter((row) => row.alreadyRetained && !row.skip).length,
    rejected: view.rows.filter((row) => row.skip).length,
    figures: view.figures,
    ...(view.couple === "different" ? { coupleConfirmed: true } : {}),
  };
  if (!(await record(input.organizationId, input.userId, input.importId, items, result))) return { status: "not_found" };
  return { status: "applied", result };
}

// Programme : les journées qui manquent, puis les moments ; l'annuaire de l'en-tête est gardé à part,
// le temps décidé en I4, pour être proposé au carnet depuis le bilan.
export async function confirmProgramImport(input: { organizationId: string; userId: string; importId: string; now?: Date }): Promise<PdfConfirmResult> {
  const view = await getProgramImportView(input.organizationId, input.importId, input.now);
  if (!view) return { status: "not_found" };
  if (view.coupleStop) return { status: "blocked", reason: "couple" };
  if (view.preview.rows.length === 0) return { status: "blocked", reason: "nothing" };
  const written = await writeEventProgramDocument({ organizationId: input.organizationId, eventId: view.event.id, rows: view.preview.rows as ProgramImportRow[] });
  const result: ImportResult = {
    created: written.count,
    updated: 0,
    unchanged: 0,
    rejected: view.preview.problems.length,
    figures: view.figures,
    ...(view.couple === "different" ? { coupleConfirmed: true } : {}),
  };
  const program = view.draft.document.kind === "program" ? view.draft.document.program : null;
  const directory = program ? programDirectory(program) : [];
  if (!(await record(input.organizationId, input.userId, input.importId, written.items, result, { directory }))) return { status: "not_found" };
  return { status: "applied", result };
}

// —— L'annuaire du programme, proposé au carnet (R14) ————————————————————————————————————

export type DirectoryEntry = {
  index: number;
  role: string;
  company: string | null;
  contact: string | null;
  phone: string | null;
  // « add_phone » : la fiche du carnet n'a pas de téléphone ; « up_to_date » : elle en a un ; « create » :
  // absent du carnet, une fiche serait créée ; « couple », « agency » : écartés.
  fate: "add_phone" | "up_to_date" | "create" | "couple" | "agency";
  vendor: { id: string; name: string } | null;
};

export function directoryFates(
  directory: readonly { role: string; company: string | null; contact: string | null; phone: string | null }[],
  carnet: readonly { id: string; name: string; contactName: string | null; phone: string | null }[],
): DirectoryEntry[] {
  const profile = planningSoftwareProfile().programExport;
  const key = (value: string | null | undefined) =>
    (value ?? "")
      .normalize("NFD")
      .replace(/\p{M}/gu, "")
      .toLocaleLowerCase("fr")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .trim();
  return directory.map((speaker, index) => {
    const kind = speakerKind(speaker, profile);
    if (kind === "planner") return { index, ...speaker, fate: "agency" as const, vendor: null };
    if (kind === "client") return { index, ...speaker, fate: "couple" as const, vendor: null };
    // La même fiche, jamais une ressemblance : la raison sociale, sinon le contact.
    const found =
      (speaker.company ? carnet.find((vendor) => key(vendor.name) === key(speaker.company)) : undefined) ??
      (speaker.contact ? carnet.find((vendor) => key(vendor.contactName) !== "" && key(vendor.contactName) === key(speaker.contact)) : undefined);
    if (!found) return { index, ...speaker, fate: "create" as const, vendor: null };
    return { index, ...speaker, fate: found.phone || !speaker.phone ? ("up_to_date" as const) : ("add_phone" as const), vendor: { id: found.id, name: found.name } };
  });
}

// L'annuaire encore gardé d'un programme appliqué, comparé au carnet ; null : aucun (effacé, ajouté,
// écarté, passé 90 jours, ou un autre import).
export async function getImportDirectory(organizationId: string, importId: string): Promise<DirectoryEntry[] | null> {
  const leftovers = await getImportLeftovers(db(), organizationId, importId);
  if (!leftovers?.directory || leftovers.directory.length === 0) return null;
  return directoryFates(leftovers.directory, await listVendorDirectoryCandidates(organizationId));
}

// « Ajouter les N téléphones » : les fiches du carnet reçoivent le téléphone qui leur manque, un
// intervenant absent du carnet y est créé (une seule fois, jamais en double) ; les mariés et l'agence ne
// sont jamais ajoutés. L'annuaire est ensuite effacé (I4) : les fiches suivent la conservation du carnet.
export async function addDirectoryToCarnet(organizationId: string, importId: string): Promise<{ phones: number; created: number } | null> {
  const directory = await getImportDirectory(organizationId, importId);
  if (!directory) return null;
  const phones = await addVendorPhones(
    organizationId,
    directory.flatMap((entry) => (entry.fate === "add_phone" && entry.vendor && entry.phone ? [{ vendorId: entry.vendor.id, phone: entry.phone }] : [])),
  );
  const types = await listVendorTypes(organizationId);
  const synonyms = starterVendorTypeSynonymGroups();
  const toCreate = directory.filter((entry) => entry.fate === "create");
  const created = await importNamedVendors(
    organizationId,
    toCreate.map((entry) => ({ name: (entry.company ?? entry.contact ?? entry.role).trim(), typeId: matchImportVendorType(entry.role, types, synonyms), contactName: entry.company ? entry.contact : null, phone: entry.phone })),
  );
  await discardImportLeftovers(db(), organizationId, importId);
  return { phones, created: created.items.length };
}
