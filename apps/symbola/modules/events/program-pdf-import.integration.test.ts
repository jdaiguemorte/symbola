// Lot 63b (CHR-08) — le programme du jour J s'importe depuis le PDF de l'ancien logiciel, contre un
// vrai PostgreSQL (RLS), par la porte d'entrée du module : aperçu sans rien écrire, intervenants
// rattachés aux postes de l'évènement, séquences écrites avec leurs interlocuteurs, jours de la veille
// et du lendemain, lignes « Caché des mariés » écartées d'office ; abus d'une autre organisation.
// PDF fabriqués aux noms inventés (packages/testing/import-corpus/generate_programme.py).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import {
  addEventVendorSlot,
  addVendorCandidate,
  createProspect,
  createProspectSource,
  EventNotFoundError,
  getEventProgram,
  importEventProgram,
  listKeyMoments,
} from "./service";

const plannerId = randomUUID();
const pdf = (name: string) => readImportCorpusFile(`logiciel-tiers/${name}`);

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
    const result = await importEventProgram({ organizationId, eventId, bytes: pdf("programme-jour-j.pdf"), apply: null });
    if (result.status !== "preview") throw new Error(result.status);
    const { preview } = result;
    expect(preview.source).toBe("program_pdf");
    expect(preview.rows).toHaveLength(12);
    const speakers = new Map(preview.speakers!.map((speaker) => [speaker.role, speaker]));
    // Le nom du prestataire désigne le poste ; seul poste de son métier sinon.
    expect(speakers.get("DJ")).toMatchObject({ kind: "vendor", proposedSlotId: djSlotId, slotId: djSlotId });
    expect(speakers.get("Traiteur")).toMatchObject({ kind: "vendor", proposedSlotId: catererSlotId });
    expect(speakers.get("Photographe")).toMatchObject({ slotId: null });
    expect(speakers.get("WeddingPlanner")?.kind).toBe("planner");
    expect(speakers.get("Mariée")?.kind).toBe("client");
    // Veille et lendemain reçoivent un temps fort.
    expect(preview.newMoments.map((moment) => moment.date)).toEqual(["2027-06-11", "2027-06-13"]);
    expect((await getEventProgram(organizationId, eventId)).items).toHaveLength(0);
  });

  it("à l'import, chaque séquence garde son jour, ses heures, sa description en note et ses interlocuteurs ; la planner n'est jamais intervenante", async () => {
    const { organizationId, eventId, djSlotId, catererSlotId } = await wedding();
    const hidden = (await importEventProgram({ organizationId, eventId, bytes: pdf("programme-jour-j.pdf"), apply: null })) as Extract<Awaited<ReturnType<typeof importEventProgram>>, { status: "preview" }>;
    const skipLines = hidden.preview.rows.filter((row) => row.hiddenFromClients).map((row) => row.line);
    expect(skipLines).toEqual([10]);

    const applied = await importEventProgram({ organizationId, eventId, bytes: pdf("programme-jour-j.pdf"), apply: { skipLines } });
    expect(applied).toMatchObject({ status: "applied", items: 11, moments: 2, skipped: 1 });
    const program = await getEventProgram(organizationId, eventId);
    const byLabel = new Map(program.items.map((item) => [item.label, item]));
    expect(byLabel.has("Animation surprise")).toBe(false);
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
    const preview = await importEventProgram({ organizationId, eventId, bytes: pdf("programme-jour-j.pdf"), apply: null });
    if (preview.status !== "preview") throw new Error(preview.status);
    const dj = preview.preview.speakers!.find((speaker) => speaker.role === "DJ")!;
    const photographer = preview.preview.speakers!.find((speaker) => speaker.role === "Photographe")!;
    const speakerSlots = { [dj.index]: null, [photographer.index]: catererSlotId };
    const again = await importEventProgram({ organizationId, eventId, bytes: pdf("programme-jour-j.pdf"), apply: null, speakerSlots });
    if (again.status !== "preview") throw new Error(again.status);
    expect(again.preview.speakers!.find((speaker) => speaker.role === "DJ")).toMatchObject({ slotId: null, chosen: true });
    const arrival = again.preview.rows.find((row) => row.label === "Arrivée du DJ")!;
    expect(arrival.participants).toEqual([{ vendorSlotId: null, label: "DJ - ROUSSEL" }]);
  });

  it("un poste d'un autre évènement ou d'une autre organisation n'est jamais rattaché (abus)", async () => {
    const mine = await wedding();
    const other = await wedding();
    const preview = await importEventProgram({ organizationId: mine.organizationId, eventId: mine.eventId, bytes: pdf("programme-jour-j.pdf"), apply: null });
    if (preview.status !== "preview") throw new Error(preview.status);
    const dj = preview.preview.speakers!.find((speaker) => speaker.role === "DJ")!;
    await importEventProgram({ organizationId: mine.organizationId, eventId: mine.eventId, bytes: pdf("programme-jour-j.pdf"), apply: { skipLines: [] }, speakerSlots: { [dj.index]: other.djSlotId } });
    const program = await getEventProgram(mine.organizationId, mine.eventId);
    expect(JSON.stringify(program.items)).not.toContain(other.djSlotId);
    expect(program.items.find((item) => item.label === "Arrivée du DJ")!.participants).toEqual([expect.objectContaining({ vendorSlotId: null, label: "DJ - ROUSSEL" })]);
    // L'évènement d'une autre organisation n'existe pas pour elle.
    await expect(importEventProgram({ organizationId: mine.organizationId, eventId: other.eventId, bytes: pdf("programme-jour-j.pdf"), apply: null })).rejects.toBeInstanceOf(EventNotFoundError);
    expect((await getEventProgram(other.organizationId, other.eventId)).items).toHaveLength(0);
  });

  it("un PDF qui n'est pas un programme est refusé avec un motif, sans rien écrire", async () => {
    const { organizationId, eventId } = await wedding();
    const result = await importEventProgram({ organizationId, eventId, bytes: pdf("fiche-evenement-complete.pdf"), apply: { skipLines: [] } });
    expect(result).toEqual({ status: "rejected", reason: "not_program_pdf" });
    expect((await getEventProgram(organizationId, eventId)).items).toHaveLength(0);
  });
});
