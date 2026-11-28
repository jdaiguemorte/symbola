// Lot 63b (CHR-08, CHR-07 ; Q44, migration 0201) — une séquence cachée des mariés, contre un vrai
// PostgreSQL (RLS) : absente de leur lien (espace, programme diffusé), présente pour l'équipe et pour
// le prestataire qu'elle concerne, absente du déroulé des autres prestataires ; la cacher ou la
// montrer est un changement à diffuser ; l'import du PDF la reprend cachée. Isolation entre
// organisations.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import type { EventLinkRights } from "@symbola/contracts";
import { readImportCorpusFile } from "@symbola/testing/import-corpus";
import { DEFAULT_PDF_LIMITS, parseProgramExport, readPdfText } from "@symbola/import-engine";
import { planningSoftwareProfile } from "@symbola/starter-templates";
import {
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  createEventLink,
  createProspect,
  createProspectSource,
  getEventProgram,
  getEventProgramPublication,
  getLinkEventView,
  getVendorLinkView,
  programForVariant,
  publishEventProgram,
  ProgramItemNotFoundError,
  updateProgramItem,
  previewEventProgramDocument,
  writeEventProgramDocument,
} from "./service";

const plannerId = randomUUID();
const RIGHTS: EventLinkRights = { rubrics: ["tasks", "program"], budgetScope: "all", sharedSlotIds: [] };

async function organization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Org ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

async function wedding(organizationId: string) {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Clémence", lastName: null }], eventDate: "2027-06-12" });
  const dj = await addEventVendorSlot(organizationId, event.id, "DJ");
  const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
  const djCandidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: dj.id, vendorName: "Ondes Sonores" });
  const catererCandidate = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: "Maison Verdier" });
  const dinner = await addProgramItem(organizationId, event.id, { startTime: "20:00", label: "Dîner", vendorSlotIds: [caterer.id], freeParticipants: [] });
  const surprise = await addProgramItem(organizationId, event.id, { startTime: "21:30", label: "Animation surprise", vendorSlotIds: [dj.id], freeParticipants: [], hiddenFromClients: true });
  const link = async (audience: "client" | "vendor", vendorCandidateId?: string) =>
    (await createEventLink({ organizationId, eventId: event.id, createdByUserId: plannerId, audience, ...(vendorCandidateId ? { vendorCandidateId } : {}), locale: "fr", link: { personName: "Camille", email: `${randomUUID()}@example.test`, rights: RIGHTS } })).link.id;
  return { eventId: event.id, dj: dj.id, dinner, surprise, djCandidate: djCandidate.id, catererCandidate: catererCandidate.id, link };
}

describe("CHR-08 — Séquence cachée des mariés (lot 63b, Q44)", () => {
  it("par défaut une séquence est visible des mariés ; cochée, elle le reste pour l'équipe", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    expect(w.dinner.hiddenFromClients).toBe(false);
    expect(w.surprise.hiddenFromClients).toBe(true);
    const program = await getEventProgram(organizationId, w.eventId);
    expect(program.items.map((item) => [item.label, item.hiddenFromClients])).toEqual([
      ["Dîner", false],
      ["Animation surprise", true],
    ]);
    // Le PDF « mariés » ne la porte pas ; le PDF « équipe » si.
    expect(programForVariant(program.items, "couple").map((item) => item.label)).toEqual(["Dîner"]);
    expect(programForVariant(program.items, "vendors").map((item) => item.label)).toEqual(["Dîner", "Animation surprise"]);
  });

  it("le programme diffusé : absente du lien des mariés, présente pour le prestataire concerné, absente du déroulé des autres", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const [client, dj, caterer] = [await w.link("client"), await w.link("vendor", w.djCandidate), await w.link("vendor", w.catererCandidate)];
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId });
    const couple = (await getLinkEventView(organizationId, client)).program!;
    expect(couple.items.map((item) => item.label)).toEqual(["Dîner"]);
    const djView = (await getVendorLinkView(organizationId, dj)).program;
    expect(djView.ownItems.map((item) => item.label)).toEqual(["Animation surprise"]);
    const catererView = (await getVendorLinkView(organizationId, caterer)).program;
    expect(catererView.outline.map((item) => item.label)).toEqual(["Dîner"]);
  });

  it("cacher ou montrer une séquence est un changement à diffuser ; montrée, les mariés la voient à la diffusion suivante", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const client = await w.link("client");
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId });
    await updateProgramItem(organizationId, w.surprise.id, { startTime: "21:30", label: "Animation surprise", vendorSlotIds: [w.dj], freeParticipants: [], hiddenFromClients: false });
    expect((await getEventProgramPublication(organizationId, w.eventId)).changes.changed).toEqual(["Animation surprise"]);
    expect((await getLinkEventView(organizationId, client)).program!.items.map((item) => item.label)).toEqual(["Dîner"]);
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId });
    expect((await getLinkEventView(organizationId, client)).program!.items.map((item) => item.label)).toEqual(["Dîner", "Animation surprise"]);
    // Une modification sans le réglage le garde tel quel.
    await updateProgramItem(organizationId, w.dinner.id, { startTime: "20:15", label: "Dîner", vendorSlotIds: [], freeParticipants: [] });
    expect((await getEventProgram(organizationId, w.eventId)).items.find((item) => item.id === w.dinner.id)!.hiddenFromClients).toBe(false);
  });

  it("l'import du PDF reprend « Caché des mariés » : la séquence s'importe cachée, pas écartée", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    // Lot 71e : le PDF passe par l'assistant commun ; le module reçoit ce qui a été lu.
    const profile = planningSoftwareProfile();
    const read = await readPdfText(readImportCorpusFile("logiciel-tiers/programme-jour-j.pdf"), { ...DEFAULT_PDF_LIMITS, maxPages: profile.programExport.maxPages });
    if (!read.ok) throw new Error(read.reason);
    const parsed = parseProgramExport(read.pages, profile.programExport, { weekdays: profile.eventSheet.weekdays, months: profile.eventSheet.months });
    if (!parsed.ok) throw new Error(parsed.reason);
    const preview = await previewEventProgramDocument({ organizationId, eventId: w.eventId, program: parsed.program, speakerSlots: {}, catalogVendors: [] });
    const result = await writeEventProgramDocument({ organizationId, eventId: w.eventId, rows: preview.rows });
    expect(result).toMatchObject({ count: 12 });
    const imported = (await getEventProgram(organizationId, w.eventId)).items.filter((item) => item.label === "Animation surprise");
    expect(imported.map((item) => item.hiddenFromClients)).toEqual([true, true]);
  });

  it("une autre organisation ne change pas le réglage d'une séquence qui n'est pas la sienne (abus)", async () => {
    const mine = await organization();
    const other = await organization();
    const w = await wedding(mine);
    await expect(updateProgramItem(other, w.surprise.id, { startTime: "21:30", label: "Animation surprise", vendorSlotIds: [], freeParticipants: [], hiddenFromClients: false })).rejects.toBeInstanceOf(ProgramItemNotFoundError);
    expect((await getEventProgram(mine, w.eventId)).items.find((item) => item.id === w.surprise.id)!.hiddenFromClients).toBe(true);
  });
});
