// Lot 37b (CHR-07, DAT-14 ; D8, D9, D10, D11 ; ADR 0071) — programme diffusé par destinataire,
// contre un vrai PostgreSQL (RLS), par la porte d'entrée du module. Horloge simulée pour les dates
// de diffusion. Tests d'abus (CLAUDE.md § 2.11) : une autre organisation ne diffuse ni ne lit ; le
// lien d'un autre évènement ne voit rien de ce programme.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import type { EventLinkRights } from "@symbola/contracts";
import {
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  createEventLink,
  createProspect,
  createProspectSource,
  EventNotFoundError,
  getEventProgramPublication,
  getEventProgramVersion,
  getLinkEventView,
  getVendorLinkView,
  markLinkProgramSeen,
  ProgramPublishError,
  publishEventProgram,
  removeProgramItem,
  updateProgramItem,
  updateVendorCandidate,
} from "./service";
import { eventsPrivacy } from "./privacy";

const plannerId = randomUUID();
const rules = { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 };
const COUPLE: EventLinkRights = { rubrics: ["tasks", "program"], budgetScope: "all", sharedSlotIds: [] };

async function organization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Org ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

// Mariage de Léa et Maxime : le traiteur Karim et le photographe Studio Lumière ; trois séquences,
// dont une note interne chiffrée et un montant au devis du photographe.
async function wedding(organizationId: string) {
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Maxime", lastName: "Durand" }], eventDate: "2027-06-12" });
  const caterer = await addEventVendorSlot(organizationId, event.id, "Traiteur");
  const photographer = await addEventVendorSlot(organizationId, event.id, "Photographe");
  const karim = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: caterer.id, vendorName: "Traiteur Karim" });
  const studio = await addVendorCandidate({ organizationId, eventId: event.id, vendorSlotId: photographer.id, vendorName: "Studio Lumière" });
  await updateVendorCandidate({ organizationId, candidateId: studio.id, quoteAmountCents: 240000 });
  const ceremony = await addProgramItem(organizationId, event.id, { startTime: "15:00", endTime: "16:30", label: "Cérémonie", location: "Jardin des Tilleuls", responsible: "Camille", internalNote: "Alliances chez le témoin", vendorSlotIds: [photographer.id], freeParticipants: ["Officiant"] });
  const cocktail = await addProgramItem(organizationId, event.id, { startTime: "17:00", endTime: "19:00", label: "Vin d'honneur", location: "Terrasse", internalNote: "Marge de 1 800 € sur le traiteur", vendorSlotIds: [caterer.id, photographer.id], freeParticipants: [] });
  const dinner = await addProgramItem(organizationId, event.id, { startTime: "20:00", label: "Dîner", location: "Orangerie", vendorSlotIds: [caterer.id], freeParticipants: [] });
  const vendorLink = async (vendorCandidateId: string) =>
    (await createEventLink({ organizationId, eventId: event.id, createdByUserId: plannerId, audience: "vendor", vendorCandidateId, locale: "fr", link: { personName: "Karim", email: `${randomUUID()}@example.test`, rights: COUPLE } })).link.id;
  const clientLink = async () =>
    (await createEventLink({ organizationId, eventId: event.id, createdByUserId: plannerId, audience: "client", locale: "fr", link: { personName: "Léa Martin", email: `${randomUUID()}@example.test`, rights: COUPLE } })).link.id;
  return { eventId: event.id, caterer: caterer.id, photographer: photographer.id, karim: karim.id, studio: studio.id, ceremony: ceremony.id, cocktail: cocktail.id, dinner: dinner.id, vendorLink, clientLink };
}

const at = (iso: string) => new Date(iso);

describe("CHR-07 — Diffusion du chrono par destinataire, par lien et en PDF ; versions numérotées", () => {
  it("« Diffuser » fige une version numérotée, datée et signée ; une modification ne se voit chez le prestataire et le client qu'à la diffusion suivante (D8, D10)", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const karim = await w.vendorLink(w.karim);
    const lea = await w.clientLink();

    const v1 = await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId, now: at("2027-06-10T18:00:00Z") });
    expect(v1).toEqual({ number: 1, publishedAt: "2027-06-10T18:00:00.000Z", publishedByUserId: plannerId, notifiedAt: null, notifiedCount: null });

    await updateProgramItem(organizationId, w.dinner, { startTime: "20:30", label: "Dîner", location: "Orangerie", vendorSlotIds: [w.caterer], freeParticipants: [] });
    const vendorBefore = await getVendorLinkView(organizationId, karim);
    expect(vendorBefore.program.version).toEqual({ number: 1, publishedAt: "2027-06-10T18:00:00.000Z" });
    expect(vendorBefore.program.ownItems.find((item) => item.id === w.dinner)!.startTime).toBe("20:00");
    expect((await getLinkEventView(organizationId, lea)).program!.items.find((item) => item.id === w.dinner)!.startTime).toBe("20:00");

    const v2 = await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId, now: at("2027-06-11T09:30:00Z") });
    expect(v2.number).toBe(2);
    expect((await getVendorLinkView(organizationId, karim)).program.ownItems.find((item) => item.id === w.dinner)!.startTime).toBe("20:30");
    const client = (await getLinkEventView(organizationId, lea)).program!;
    expect(client.version).toEqual({ number: 2, publishedAt: "2027-06-11T09:30:00.000Z" });
    expect(client.items.find((item) => item.id === w.dinner)!.startTime).toBe("20:30");
  });

  it("un prestataire ne voit ni note interne, ni montant, ni séquence détaillée d'un autre ; il voit ses séquences en entier et le déroulé du jour (D9)", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const karim = await w.vendorLink(w.karim);
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId });

    const { program } = await getVendorLinkView(organizationId, karim);
    expect(program.ownItems.map((item) => [item.label, item.location])).toEqual([
      ["Vin d'honneur", "Terrasse"],
      ["Dîner", "Orangerie"],
    ]);
    expect(program.outline).toEqual([
      { id: w.ceremony, startTime: "15:00", endTime: "16:30", label: "Cérémonie", own: false },
      { id: w.cocktail, startTime: "17:00", endTime: "19:00", label: "Vin d'honneur", own: true },
      { id: w.dinner, startTime: "20:00", endTime: null, label: "Dîner", own: true },
    ]);
    const text = JSON.stringify(program);
    for (const hidden of ["Alliances", "Marge", "1 800", "2400", "240000", "Studio Lumière", "Photographe", "Officiant", "Jardin des Tilleuls", "Camille"]) expect(text).not.toContain(hidden);

    // Le client lit la version diffusée entière, toujours sans note interne.
    const client = (await getLinkEventView(organizationId, await w.clientLink())).program!;
    expect(client.items.map((item) => item.label)).toEqual(["Cérémonie", "Vin d'honneur", "Dîner"]);
    expect(JSON.stringify(client)).not.toMatch(/Alliances|Marge/);
  });

  it("diffuser un programme vide, ou déjà diffusé tel quel, est refusé ; une note interne seule ne fait pas de nouvelle version", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId });
    await expect(publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId })).rejects.toMatchObject({ reason: "unchanged" });
    await updateProgramItem(organizationId, w.dinner, { startTime: "20:00", label: "Dîner", location: "Orangerie", internalNote: "Allergies : table 4", vendorSlotIds: [w.caterer], freeParticipants: [] });
    await expect(publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId })).rejects.toBeInstanceOf(ProgramPublishError);
    expect((await getEventProgramPublication(organizationId, w.eventId)).canPublish).toBe(false);

    for (const id of [w.ceremony, w.cocktail, w.dinner]) await removeProgramItem(organizationId, id);
    await expect(publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId })).rejects.toMatchObject({ reason: "empty" });
  });

  it("deux diffusions au même instant (double clic) ne font qu'une version", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const results = await Promise.allSettled([1, 2, 3].map(() => publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId })));
    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect((await getEventProgramPublication(organizationId, w.eventId)).versions.map((version) => version.number)).toEqual([1]);
  });

  it("la fiche dit ce qui a changé depuis la dernière diffusion", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const before = await getEventProgramPublication(organizationId, w.eventId);
    expect(before).toMatchObject({ latest: null, versions: [], canPublish: true, changes: { added: ["Cérémonie", "Vin d'honneur", "Dîner"], changed: [], removed: [] } });

    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId });
    expect((await getEventProgramPublication(organizationId, w.eventId)).changes).toEqual({ added: [], changed: [], removed: [] });
    await updateProgramItem(organizationId, w.ceremony, { startTime: "15:20", endTime: "16:50", label: "Cérémonie", location: "Jardin des Tilleuls", vendorSlotIds: [w.photographer], freeParticipants: ["Officiant"] });
    await removeProgramItem(organizationId, w.dinner);
    await addProgramItem(organizationId, w.eventId, { startTime: "23:00", label: "Pièce montée", vendorSlotIds: [w.caterer], freeParticipants: [] });
    const after = await getEventProgramPublication(organizationId, w.eventId);
    expect(after).toMatchObject({ latest: { number: 1 }, canPublish: true, changes: { added: ["Pièce montée"], changed: ["Cérémonie"], removed: ["Dîner"] } });
  });

  it("D11 — la page d'un lien signale une nouvelle version une seule fois ; jamais à la première visite", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    const karim = await w.vendorLink(w.karim);
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId });
    expect((await getVendorLinkView(organizationId, karim)).program.isNew).toBe(false);
    await markLinkProgramSeen(organizationId, karim, 1);

    await updateProgramItem(organizationId, w.dinner, { startTime: "20:15", label: "Dîner", location: "Orangerie", vendorSlotIds: [w.caterer], freeParticipants: [] });
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId });
    expect((await getVendorLinkView(organizationId, karim)).program).toMatchObject({ version: { number: 2 }, isNew: true });
    await markLinkProgramSeen(organizationId, karim, 2);
    expect((await getVendorLinkView(organizationId, karim)).program.isNew).toBe(false);
    // Une page ouverte en retard ne fait pas reculer la version vue.
    await markLinkProgramSeen(organizationId, karim, 1);
    expect((await getVendorLinkView(organizationId, karim)).program.isNew).toBe(false);
  });

  it("abus : une autre organisation ne diffuse ni ne lit ce programme ; le lien d'un autre évènement n'en voit rien", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId });
    const intruder = await organization();
    await expect(publishEventProgram({ organizationId: intruder, eventId: w.eventId, userId: plannerId })).rejects.toBeInstanceOf(EventNotFoundError);
    expect(await getEventProgramVersion(intruder, w.eventId, 1)).toBeNull();
    await expect(getEventProgramPublication(intruder, w.eventId)).rejects.toBeInstanceOf(EventNotFoundError);

    const other = await wedding(organizationId);
    const elsewhere = await other.vendorLink(other.karim);
    const view = await getVendorLinkView(organizationId, elsewhere);
    expect(view.program).toEqual({ version: null, ownItems: [], outline: [], isNew: false });
  });
});

describe("DAT-14 — Les documents contractuels gardent leurs versions : devis, contrat, chrono diffusé", () => {
  it("la liste des diffusions reste ; chaque version reste consultable telle qu'elle a été diffusée", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId, now: at("2027-06-01T10:00:00Z") });
    await updateProgramItem(organizationId, w.dinner, { startTime: "21:00", label: "Dîner assis", location: "Orangerie", vendorSlotIds: [w.caterer], freeParticipants: [] });
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId, now: at("2027-06-05T10:00:00Z") });

    const publication = await getEventProgramPublication(organizationId, w.eventId);
    expect(publication.versions).toEqual([
      { number: 2, publishedAt: "2027-06-05T10:00:00.000Z", publishedByUserId: plannerId, notifiedAt: null, notifiedCount: null },
      { number: 1, publishedAt: "2027-06-01T10:00:00.000Z", publishedByUserId: plannerId, notifiedAt: null, notifiedCount: null },
    ]);
    const first = await getEventProgramVersion(organizationId, w.eventId, 1);
    expect(first!.items.find((item) => item.id === w.dinner)).toMatchObject({ startTime: "20:00", label: "Dîner" });
    expect((await getEventProgramVersion(organizationId, w.eventId, 2))!.items.find((item) => item.id === w.dinner)).toMatchObject({ startTime: "21:00", label: "Dîner assis" });
    expect(JSON.stringify(first)).not.toMatch(/Alliances|Marge/);
    expect(await getEventProgramVersion(organizationId, w.eventId, 3)).toBeNull();
    expect(await getEventProgramVersion(organizationId, w.eventId, 0)).toBeNull();
  });
});

describe("RGPD-01, RGPD-03 — Versions diffusées du programme (lot 37b)", () => {
  it("une version est trouvée par le nom d'un responsable ou d'un intervenant libre, listée avec l'évènement, et supprimée à l'oubli", async () => {
    const organizationId = await organization();
    const w = await wedding(organizationId);
    await publishEventProgram({ organizationId, eventId: w.eventId, userId: plannerId });
    const found = await eventsPrivacy.find({ organizationId, terms: { name: "Camille" } });
    const version = found.find((record) => record.kind === "program_version");
    expect(version).toMatchObject({ label: "1", fields: { responsible: "Camille", participants: "Officiant" }, eventId: w.eventId });
    const related = await eventsPrivacy.related!({ organizationId, eventIds: [w.eventId] });
    expect(related.filter((record) => record.kind === "program_version").map((record) => record.recordId)).toEqual([version!.recordId]);

    const records = [{ kind: "program_version", recordId: version!.recordId }];
    expect(await eventsPrivacy.planErasure({ organizationId, records, rules, today: "2026-11-16" })).toEqual([
      { kind: "program_version", recordId: version!.recordId, fate: "deleted", legalBasis: null, keptUntil: null },
    ]);
    await eventsPrivacy.erase({ organizationId, records, rules, today: "2026-11-16" });
    expect((await getEventProgramPublication(organizationId, w.eventId)).versions).toEqual([]);
  });
});
