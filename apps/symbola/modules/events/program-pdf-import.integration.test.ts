// Lot 63b (CHR-08) — le programme du jour J s'importe depuis le PDF de l'ancien logiciel, contre un
// vrai PostgreSQL (RLS), par la porte d'entrée du module : aperçu sans rien écrire, intervenants
// rattachés aux postes de l'évènement, séquences écrites avec leurs interlocuteurs, jours de la veille
// et du lendemain, lignes « Caché des mariés » importées cachées (Q44) ; abus d'une autre organisation.
// Lot 71e : le PDF passe par l'assistant commun ; le module reçoit ce qui a été lu (le hub garde le
// brouillon) et rend au journal chaque élément écrit. PDF fabriqués aux noms inventés
// (packages/testing/import-corpus/generate_programme.py).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { DEFAULT_PDF_LIMITS, parseProgramExport, readPdfText, type ProgramExport } from "@symbola/import-engine";
import { planningSoftwareProfile } from "@symbola/starter-templates";
import {
  addEventVendorSlot,
  addVendorCandidate,
  createProspect,
  createProspectSource,
  EventNotFoundError,
  getEventProgram,
  importEventProgram,
  listKeyMoments,
  previewEventProgramDocument,
  writeEventProgramDocument,
} from "./service";

const plannerId = randomUUID();
const pdf = (name: string) => readImportCorpusFile(`logiciel-tiers/${name}`);
const profile = planningSoftwareProfile();

async function programOf(name: string): Promise<ProgramExport> {
  const read = await readPdfText(pdf(name), { ...DEFAULT_PDF_LIMITS, maxPages: profile.programExport.maxPages });
  if (!read.ok) throw new Error(read.reason);
  const parsed = parseProgramExport(read.pages, profile.programExport, { weekdays: profile.eventSheet.weekdays, months: profile.eventSheet.months });
  if (!parsed.ok) throw new Error(parsed.reason);
  return parsed.program;
}

async function previewOf(organizationId: string, eventId: string, speakerSlots: Record<number, string | null> = {}) {
  return previewEventProgramDocument({ organizationId, eventId, program: await programOf("programme-jour-j.pdf"), speakerSlots, catalogVendors: [] });
}

async function importOf(organizationId: string, eventId: string, speakerSlots: Record<number, string | null> = {}) {
  const preview = await previewOf(organizationId, eventId, speakerSlots);
  return writeEventProgramDocument({ organizationId, eventId, rows: preview.rows });
}

async function wedding(organizationId = randomUUID()) {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Clémence", lastName: null }], eventDate: "2027-06-12" });
  const dj = await addEventVendorSlot(organizationId, event.id, "DJ");
  await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: dj.id, vendorName: "Ondes Sonores" });
  const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
  return { organizationId, eventId: event.id, djSlotId: dj.id, catererSlotId: caterer.id };
}

describe("CHR-08 — Programme du jour J depuis le PDF de l'ancien logiciel (import, lot 63b)", () => {
  it("l'aperçu lit les séquences et propose un poste à chaque intervenant ; rien n'est écrit avant « Importer »", async () => {
    const { organizationId, eventId, djSlotId, catererSlotId } = await wedding();
    const preview = await previewOf(organizationId, eventId);
    expect(preview.rows).toHaveLength(12);
    const speakers = new Map(preview.speakers!.map((speaker) => [speaker.role, speaker]));
    // Le nom du prestataire désigne le poste ; seul poste de son métier sinon.
    expect(speakers.get("DJ")).toMatchObject({ kind: "vendor", proposedSlotId: djSlotId, slotId: djSlotId });
    expect(speakers.get("Traiteur")).toMatchObject({ kind: "vendor", proposedSlotId: catererSlotId });
    expect(speakers.get("Photographe")).toMatchObject({ slotId: null });
    expect(speakers.get("WeddingPlanner")?.kind).toBe("planner");
    expect(speakers.get("Mariée")?.kind).toBe("client");
    // Lot 71e : chaque journée sans temps fort en reçoit un, à son nom (le jour J compris, écrit au journal).
    expect(preview.newMoments.map((moment) => [moment.date, moment.name])).toEqual([
      ["2027-06-11", "Veille"],
      ["2027-06-12", "Jour J"],
      ["2027-06-13", "Lendemain"],
    ]);
    expect((await getEventProgram(organizationId, eventId)).items).toHaveLength(0);
  });

  it("à l'import, chaque séquence garde son jour, ses heures, sa description en note et ses interlocuteurs ; la planner n'est jamais intervenante ; « Caché des mariés » s'importe cachée (Q44)", async () => {
    const { organizationId, eventId, djSlotId, catererSlotId } = await wedding();
    const applied = await importOf(organizationId, eventId);
    expect(applied).toMatchObject({ count: 12, moments: 3 });
    // Lot 71e : chaque journée et chaque moment écrits sont rendus au journal (la journée avant ses moments).
    expect(applied.items.filter((item) => item.kind === "key_moment")).toHaveLength(3);
    expect(applied.items.filter((item) => item.kind === "program_item")).toHaveLength(12);
    // Lot 67d (EVT-04 ; décision du 24/11/2026) : la veille et le lendemain portent leur nom, plus « Jour J ».
    expect((await listKeyMoments(organizationId, eventId)).map((moment) => [moment.date, moment.name])).toEqual([
      ["2027-06-11", "Veille"],
      ["2027-06-12", "Jour J"],
      ["2027-06-13", "Lendemain"],
    ]);
    const program = await getEventProgram(organizationId, eventId);
    const byLabel = new Map(program.items.map((item) => [item.label, item]));
    expect(byLabel.get("Animation surprise")!.hiddenFromClients).toBe(true);
    expect(byLabel.get("Dîner") ?? byLabel.get("Brunch")!).toMatchObject({ hiddenFromClients: false });
    const evening = byLabel.get("Soirée de la veille")!;
    expect(evening).toMatchObject({ startTime: "19:00", endTime: "02:00", internalNote: "Apéritif servi à partir de 20h" });
    expect(evening.participants.map((participant) => participant.vendorSlotId)).toEqual([catererSlotId]);
    const dj = byLabel.get("Arrivée du DJ")!;
    expect(dj.participants).toEqual([expect.objectContaining({ vendorSlotId: djSlotId, label: "DJ" })]);
    // Un témoin reste en texte ; la planner n'apparaît nulle part.
    expect(byLabel.get("Habillage du marié")!.participants.map((participant) => participant.label)).toEqual(["Gaspard", "Photographe - Léa"]);
    expect(JSON.stringify(program.items)).not.toContain("WeddingPlanner");
    // Un repère : une séquence sans interlocuteur.
    expect(byLabel.get("Coucher du soleil")!.participants).toEqual([]);
    const moments = await listKeyMoments(organizationId, eventId);
    expect(moments.map((moment) => moment.date).sort()).toEqual(["2027-06-11", "2027-06-12", "2027-06-13"]);
  });

  it("la planner choisit un autre poste, ou « Garder en texte » : l'import suit ses choix", async () => {
    const { organizationId, eventId, catererSlotId } = await wedding();
    const preview = await previewOf(organizationId, eventId);
    const dj = preview.speakers.find((speaker) => speaker.role === "DJ")!;
    const photographer = preview.speakers.find((speaker) => speaker.role === "Photographe")!;
    const speakerSlots = { [dj.index]: null, [photographer.index]: catererSlotId };
    const again = await previewOf(organizationId, eventId, speakerSlots);
    expect(again.speakers.find((speaker) => speaker.role === "DJ")).toMatchObject({ slotId: null, chosen: true });
    const arrival = again.rows.find((row) => row.label === "Arrivée du DJ")!;
    expect(arrival.participants).toEqual([{ vendorSlotId: null, label: "DJ - ROUSSEL" }]);
  });

  it("un poste d'un autre évènement ou d'une autre organisation n'est jamais rattaché (abus)", async () => {
    const mine = await wedding();
    const other = await wedding();
    const preview = await previewOf(mine.organizationId, mine.eventId);
    const dj = preview.speakers.find((speaker) => speaker.role === "DJ")!;
    await importOf(mine.organizationId, mine.eventId, { [dj.index]: other.djSlotId });
    const program = await getEventProgram(mine.organizationId, mine.eventId);
    expect(JSON.stringify(program.items)).not.toContain(other.djSlotId);
    expect(program.items.find((item) => item.label === "Arrivée du DJ")!.participants).toEqual([expect.objectContaining({ vendorSlotId: null, label: "DJ - ROUSSEL" })]);
    // L'évènement d'une autre organisation n'existe pas pour elle.
    await expect(previewOf(mine.organizationId, other.eventId)).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(writeEventProgramDocument({ organizationId: mine.organizationId, eventId: other.eventId, rows: preview.rows })).rejects.toBeInstanceOf(EventNotFoundError);
    expect((await getEventProgram(other.organizationId, other.eventId)).items).toHaveLength(0);
  });

  it("un PDF déposé dans l'import d'un chrono (tableur) est renvoyé vers l'assistant commun, sans rien écrire (lot 71e)", async () => {
    const { organizationId, eventId } = await wedding();
    const result = await importEventProgram({ organizationId, eventId, bytes: pdf("programme-jour-j.pdf"), apply: { skipLines: [] } });
    expect(result).toEqual({ status: "rejected", reason: "pdf_wizard" });
    expect((await getEventProgram(organizationId, eventId)).items).toHaveLength(0);
  });

  it("aucune fin n'est déduite ; la soirée de la veille finit le lendemain ; un repère n'a pas de durée (lot 71e, critère 5)", async () => {
    const { organizationId, eventId } = await wedding();
    await importOf(organizationId, eventId);
    const items = new Map((await getEventProgram(organizationId, eventId)).items.map((item) => [item.label, item]));
    expect(items.get("Soirée de la veille")).toMatchObject({ startTime: "19:00", endTime: "02:00", timing: "span" });
    expect(items.get("Repas à la charge des mariés")).toMatchObject({ endTime: null, timing: "span" });
    expect(items.get("Coucher du soleil")).toMatchObject({ endTime: null, timing: "marker" });
  });
});
