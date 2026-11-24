// Lot 67e (HUB-14, PRE-02, BUD-04 ; recette du 24/11/2026, R07) — reprendre d'un PDF les prestataires
// retenus d'un évènement, pour ne pas les ressaisir. Même modèle que l'import du programme (lot 63b) :
// le fichier est contrôlé comme tout envoi (taille, antivirus, SEC-21), lu en mémoire et jamais
// gardé ; l'aperçu se recalcule du même fichier au moment d'écrire, si bien que rien n'est écrit
// avant « Reprendre ». L'écriture passe par les gestes existants : la fiche du carnet (retrouvée ou
// créée) est retenue sur la ligne du budget, comme par « Retenir » (ADR 0111). Les montants ne
// changent pas, et un prestataire déjà retenu sur la ligne le reste. L'app passe par le service.ts
// de chaque module (ARC-01).
import { recordAudit } from "@symbola/db/audit";
import { appDatabase } from "@symbola/db/client";
import { parseEnv } from "@symbola/env";
import { scanBuffer } from "@symbola/files";
import { DEFAULT_PDF_LIMITS, looksLikePdf, parseEventVendorsExport, readPdfText, type EventVendorsExportRow } from "@symbola/import-engine";
import { ENGAGED_CANDIDATE_STATUSES } from "@symbola/contracts";
import { planningSoftwareProfile, starterVendorTypeSynonymGroups } from "@symbola/starter-templates";
import { addEventVendorSlot, EventNotFoundError, getEvent, listEventVendorSlots, listVendorCandidates } from "@/modules/events/service";
import { getImportLimits } from "@/modules/hub/service";
import { createVendor, listVendorImportCandidates, listVendorTypes } from "@/modules/vendors/service";
import {
  importHeaderCheck,
  importedVendorInput,
  matchCarnetVendor,
  matchImportVendorType,
  proposeImportSlot,
  resolveImportChoice,
  type EventVendorsImportChoice,
  type ImportCarnetVendor,
  type ImportSlotOption,
} from "./event-vendors-import-rules";
import { retainVendorForSlot } from "./slot-retention";

export type EventVendorsImportRow = EventVendorsExportRow & {
  // Fiche du carnet proposée (null : une fiche sera créée) et son métier pour une création.
  vendor: ImportCarnetVendor | null;
  typeLabel: string | null;
  // Ligne du budget proposée (null : une ligne au nom du métier sera créée).
  slotId: string | null;
  // Déjà retenu sur cette ligne : rien ne sera écrit pour lui.
  alreadyRetained: boolean;
  choice: EventVendorsImportChoice;
};

export type EventVendorsImportPreview = {
  header: { eventDate: string | null; clients: string[]; check: "same" | "different" | "unknown" };
  rows: EventVendorsImportRow[];
  slots: ImportSlotOption[];
  carnet: ImportCarnetVendor[];
};

export type EventVendorsImportRejection = "empty" | "too_large" | "infected" | "too_many_pages" | "not_event_vendors_pdf" | "header_unconfirmed";

export type EventVendorsImportResult =
  | { status: "rejected"; reason: EventVendorsImportRejection }
  | { status: "preview"; preview: EventVendorsImportPreview }
  | { status: "applied"; retained: number; createdVendors: number; createdSlots: number; alreadyRetained: number; skipped: number };

export async function importEventVendors(input: {
  organizationId: string;
  userId: string;
  eventId: string;
  bytes: Uint8Array;
  // Choix de la planner par ligne du fichier (rang à partir de 1) ; absent : la proposition.
  choices?: Record<number, Partial<EventVendorsImportChoice>>;
  // null : l'aperçu seulement. confirmHeader : le fichier porte une autre date que l'évènement, et
  // la planner l'a confirmé.
  apply: { confirmHeader: boolean } | null;
}): Promise<EventVendorsImportResult> {
  // Un évènement d'une autre organisation n'existe pas pour celle-ci (SEC-13).
  const event = await getEvent(input.organizationId, input.eventId);
  if (!event) throw new EventNotFoundError();
  const db = appDatabase();
  const limits = await getImportLimits(db);
  if (input.bytes.length === 0) return { status: "rejected", reason: "empty" };
  if (input.bytes.length > limits.maxBytes) return { status: "rejected", reason: "too_large" };
  const env = parseEnv(process.env);
  const scan = await scanBuffer(Buffer.from(input.bytes), { host: env.CLAMAV_HOST, port: env.CLAMAV_PORT });
  if (scan.infected) return { status: "rejected", reason: "infected" };
  if (!looksLikePdf(input.bytes)) return { status: "rejected", reason: "not_event_vendors_pdf" };
  const profile = planningSoftwareProfile();
  const read = await readPdfText(input.bytes, { ...DEFAULT_PDF_LIMITS, maxBytes: limits.maxBytes, maxPages: profile.eventVendorsExport.maxPages });
  if (!read.ok) return { status: "rejected", reason: read.reason === "too_large" ? "too_large" : read.reason === "too_many_pages" ? "too_many_pages" : "not_event_vendors_pdf" };
  const parsed = parseEventVendorsExport(read.pages, profile.eventVendorsExport, {
    calendar: { weekdays: profile.eventSheet.weekdays, months: profile.eventSheet.months },
    footerPrefix: profile.programExport.footerPrefix,
    plannerRoles: profile.programExport.plannerRoles,
  });
  if (!parsed.ok) return { status: "rejected", reason: "not_event_vendors_pdf" };

  const [slotRows, candidates, carnet, types] = await Promise.all([
    listEventVendorSlots(input.organizationId, input.eventId),
    listVendorCandidates(input.organizationId, input.eventId),
    listVendorImportCandidates(input.organizationId),
    listVendorTypes(input.organizationId),
  ]);
  const onSlots = candidates.filter((candidate) => candidate.status !== "dismissed");
  const slots: ImportSlotOption[] = slotRows.map((slot) => ({ id: slot.id, label: slot.label, vendorNames: onSlots.filter((candidate) => candidate.vendorSlotId === slot.id).map((candidate) => candidate.vendorName) }));
  const synonyms = starterVendorTypeSynonymGroups();
  const valid = { vendorIds: new Set(carnet.map((vendor) => vendor.id)), slotIds: new Set(slots.map((slot) => slot.id)) };
  const typeLabels = new Map(types.map((type) => [type.id, type.label]));

  const rows: EventVendorsImportRow[] = parsed.export.rows.map((row) => {
    const vendor = matchCarnetVendor(row, carnet);
    const slotId = proposeImportSlot(row, slots, synonyms);
    const typeId = matchImportVendorType(row.type, types, synonyms);
    const choice = resolveImportChoice({ planner: row.planner, vendorId: vendor?.id ?? null, slotId }, input.choices?.[row.line], valid);
    const alreadyRetained =
      choice.vendor !== "new" &&
      choice.slot !== "new" &&
      candidates.some((candidate) => candidate.vendorSlotId === choice.slot && candidate.vendorId === choice.vendor && ENGAGED_CANDIDATE_STATUSES.includes(candidate.status));
    return { ...row, vendor, typeLabel: typeId ? (typeLabels.get(typeId) ?? null) : null, slotId, alreadyRetained, choice };
  });
  const check = importHeaderCheck(parsed.export, event);
  const preview: EventVendorsImportPreview = { header: { eventDate: parsed.export.eventDate, clients: parsed.export.clients, check }, rows, slots, carnet };
  if (!input.apply) return { status: "preview", preview };
  if (check === "different" && !input.apply.confirmHeader) return { status: "rejected", reason: "header_unconfirmed" };

  // Écriture, ligne par ligne, par les gestes existants. Les lignes « Nouvelle ligne » d'un même
  // métier partagent la ligne créée.
  const createdSlots = new Map<string, string>();
  let retained = 0;
  let createdVendors = 0;
  let alreadyRetained = 0;
  for (const row of rows) {
    if (row.choice.skip) continue;
    if (row.alreadyRetained) {
      alreadyRetained += 1;
      continue;
    }
    let slotId = row.choice.slot;
    if (slotId === "new") {
      const key = row.type.trim().toLocaleLowerCase("fr");
      slotId = createdSlots.get(key) ?? (await addEventVendorSlot(input.organizationId, input.eventId, row.type)).id;
      createdSlots.set(key, slotId);
    }
    let vendorId = row.choice.vendor;
    if (vendorId === "new") {
      vendorId = (await createVendor(input.organizationId, importedVendorInput(row, matchImportVendorType(row.type, types, synonyms)))).vendor.id;
      createdVendors += 1;
    }
    await retainVendorForSlot({ organizationId: input.organizationId, userId: input.userId, eventId: input.eventId, slotId, vendorId });
    retained += 1;
  }
  const result = { retained, createdVendors, createdSlots: createdSlots.size, alreadyRetained, skipped: rows.filter((row) => row.choice.skip).length };
  // Journal d'activité : des nombres, jamais de nom (SEC-20).
  await recordAudit(db, { organizationId: input.organizationId, action: "events.vendors.imported", objectId: input.eventId, details: { retained, createdVendors, createdSlots: createdSlots.size } });
  return { status: "applied", ...result };
}
