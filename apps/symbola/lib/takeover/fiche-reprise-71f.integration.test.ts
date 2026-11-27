// Lot 71f (EVT-02, EVT-07, HUB-08, HUB-14, UX-01, UX-06, BUD-01 ; spécification du lot 71, § 5.6 ;
// maquette 09) — la fiche d'un mariage repris et ses reflets, contre un vrai PostgreSQL : les points
// d'« À compléter » lus dans les modules par leurs services (contrats non signés compris), le même calcul
// pour la page de reprise, la liste et « Aujourd'hui », le filtre « Origine » en SQL, la provenance d'une
// valeur reprise. Tests d'abus : l'organisation B ne lit ni la reprise, ni les points, ni la marque d'un
// mariage de A ; le filtre ne révèle rien d'une autre organisation ; une Planner restreinte ne voit pas
// la reprise d'un mariage hors de son équipe.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { eventVendorCandidates } from "@symbola/db/schema/events";
import { importItems, imports } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { setUnallocatedTotals, updateBudgetLine } from "@/modules/budget/service";
import {
  addEventTask,
  addEventVendorSlot,
  addProgramItem,
  addVendorCandidate,
  createProspect,
  getEventSignedOn,
  listEvents,
  setEventIdentity,
  updateVendorCandidate,
} from "@/modules/events/service";
import { getEventTakeover, markTakeoverStepImported, settleTakeoverStep } from "@/modules/hub/service";
import { loadEventChecklist, listTakeoversInProgress, remainingTakeoverPoints } from "./checklist";
import { loadTakeoverPage, enterTakeoverEvent, type TakeoverActor } from "./flow";
import { loadEventProvenance } from "./provenance";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function createPlanner(role: "owner" | "member" = "owner", organizationId?: string): Promise<TakeoverActor> {
  const orgId = organizationId ?? (await createOrganization(db, `Org ${randomUUID()}`)).id;
  const user = await createUser(db, { organizationId: orgId, email: `p-${randomUUID()}@symbola.test`, password: "mot-de-passe", role });
  return { organizationId: orgId, userId: user.id, viewer: { userId: user.id, role, allPlannersSeeAll: true } };
}

// « Léa & Hugo », repris le 24 nov. : saisi sur la page, quatre lignes réglées par des fichiers ou « pas de
// fichier », deux postes retenus (un contrat non signé, un non renseigné), un poste signé, un total « à
// répartir », un moment du programme sans fin, un ponctuel, aucune tâche, aucun lien, invités inconnus.
async function leaHugo(actor: TakeoverActor, options: { settleAll?: boolean } = {}) {
  const { takeoverId, eventId } = await enterTakeoverEvent(actor, { takeoverId: null, name: "", eventDate: "2027-06-12", clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Hugo", lastName: "Bernard" }] });
  const base = { organizationId: actor.organizationId, userId: actor.userId, takeoverId, viewer: actor.viewer };
  const retain = async (label: string, vendorName: string, contract: "signed" | "unsigned" | "unknown") => {
    const slot = await addEventVendorSlot(actor.organizationId, eventId, label);
    const candidate = await addVendorCandidate({ organizationId: actor.organizationId, eventId, vendorSlotId: slot.id, vendorName });
    await updateVendorCandidate({ organizationId: actor.organizationId, candidateId: candidate.id, status: contract === "signed" ? "contract_signed" : "retained", changedByUserId: actor.userId });
    await withOrganization(db, actor.organizationId, (tx) => tx.update(eventVendorCandidates).set({ takeoverContract: contract }).where(eq(eventVendorCandidates.id, candidate.id)));
    return { slot, candidate };
  };
  const venue = await retain("Lieu de réception", "Domaine des Tilleuls", "signed");
  await retain("Baby-sitting", "Les P'tits Loups", "unsigned");
  await retain("Voiture", "Belles Carrosseries", "unknown");
  await setUnallocatedTotals(actor.organizationId, { eventId, committedCents: 2_165_050, paidCents: 320_000 });
  await addProgramItem(actor.organizationId, eventId, { startTime: "15:30", label: "Cérémonie laïque", vendorSlotIds: [], freeParticipants: [] });
  await addProgramItem(actor.organizationId, eventId, { startTime: "19:00", endTime: "02:00", label: "Soirée", vendorSlotIds: [], freeParticipants: [] });
  if (options.settleAll !== false) {
    await settleTakeoverStep(db, { ...base, kind: "vendor_book", state: "no_file" });
    await settleTakeoverStep(db, { ...base, kind: "budget", state: "no_file" });
    await markTakeoverStepImported(db, { ...base, kind: "event_vendors", eventId });
    await settleTakeoverStep(db, { ...base, kind: "tasks", state: "no_file" });
    await markTakeoverStepImported(db, { ...base, kind: "program", eventId });
  }
  return { takeoverId, eventId, venue };
}

const NOV_25 = { today: "2026-11-25", now: new Date("2026-11-25T08:00:00Z") };

describe("EVT-02 — La Synthèse d'un mariage repris (lot 71f, critère 1)", () => {
  it("le lendemain de la reprise : six points, contrats non signés compris, aucun compté fait", async () => {
    const planner = await createPlanner();
    const { eventId } = await leaHugo(planner);
    const checklist = await loadEventChecklist(planner.organizationId, eventId, { viewer: planner.viewer, ...NOV_25 });
    expect(checklist).not.toBeNull();
    expect(checklist!.block.kind).toBe("open");
    // Les trois postes retenus (le signé compris) n'ont pas de prévu : « Montants de 3 prestataires ».
    expect(checklist!.points.map((point) => [point.key, point.count, point.done])).toEqual([
      ["amounts", 3, false],
      ["contracts", 2, false],
      ["tasks", 1, false],
      ["endTimes", 1, false],
      ["clientLink", 1, false],
      ["guests", 1, false],
    ]);
    expect(checklist!.points[0]!.remainingCents).toBe(2_165_050);
    expect(checklist!.points[1]!.names.sort()).toEqual(["Belles Carrosseries", "Les P'tits Loups"]);
    // « de 2 fichiers » : les prestataires retenus et le programme ; le mariage saisi n'en est pas un.
    expect(checklist!.fileCount).toBe(2);
    expect(checklist!.takeover.completedAt).toBeNull();
  });

  it("le mariage saisi sur la page est Confirmé, date de signature non renseignée (C-64)", async () => {
    const planner = await createPlanner();
    const { eventId } = await leaHugo(planner);
    expect(await getEventSignedOn(planner.organizationId, eventId)).toEqual({ known: false });
  });
});

describe("EVT-02 — Faire un point, puis « Reprise complétée le … » (critère 2)", () => {
  it("un point fait passe en bas ; les six faits datent la fin de la reprise", async () => {
    const planner = await createPlanner();
    const { eventId, venue } = await leaHugo(planner);
    await setEventIdentity(planner.organizationId, eventId, { guestsEstimated: 120, guestsConfirmed: null, style: null, notes: null });
    let checklist = await loadEventChecklist(planner.organizationId, eventId, NOV_25);
    expect(checklist!.points.at(-1)).toMatchObject({ key: "guests", done: true });
    expect(checklist!.block).toMatchObject({ kind: "open", done: 1, total: 6 });

    // Les autres points : prévus et réels saisis, contrats signés, une tâche, la fin du moment, un lien.
    const { listEventVendorSlots, getEventProgram, updateProgramItem } = await import("@/modules/events/service");
    for (const slot of await listEventVendorSlots(planner.organizationId, eventId)) {
      await updateBudgetLine({ organizationId: planner.organizationId, eventId, eventVendorSlotId: slot.id, field: "estimated", amountCents: 1_000_000, changedByUserId: planner.userId });
      await updateBudgetLine({ organizationId: planner.organizationId, eventId, eventVendorSlotId: slot.id, field: "committed", amountCents: slot.id === venue.slot.id ? 2_165_050 : 0, changedByUserId: planner.userId });
      for (const vendor of slot.retainedVendors) await updateVendorCandidate({ organizationId: planner.organizationId, candidateId: vendor.candidateId, status: "contract_signed", changedByUserId: planner.userId });
    }
    await addEventTask(planner.organizationId, eventId, { label: "Envoyer la feuille de route au traiteur", dueDate: "2026-12-04", responsible: "planner" });
    const ceremony = (await getEventProgram(planner.organizationId, eventId)).items.find((item) => item.label === "Cérémonie laïque")!;
    await updateProgramItem(planner.organizationId, ceremony.id, { startTime: "15:30", endTime: "16:15", label: "Cérémonie laïque", vendorSlotIds: [], freeParticipants: [] });
    checklist = await loadEventChecklist(planner.organizationId, eventId, NOV_25);
    expect(checklist!.points.filter((point) => !point.done).map((point) => point.key)).toEqual(["clientLink"]);

    // Le lien des mariés : un lien actif (écrit ici sans l'e-mail, qui n'entre pas dans la règle).
    const { eventLinks } = await import("@symbola/db/schema/events");
    await withOrganization(db, planner.organizationId, (tx) =>
      tx.insert(eventLinks).values({ organizationId: planner.organizationId, eventId, audience: "client", personName: "Léa Martin", email: `lea-${randomUUID()}@symbola.test`, tokenHash: randomUUID(), expiresAt: new Date("2027-07-01T00:00:00Z"), createdByUserId: planner.userId } as never),
    );
    const done = await loadEventChecklist(planner.organizationId, eventId, { today: "2026-12-02", now: new Date("2026-12-02T10:00:00Z") });
    expect(done!.block).toMatchObject({ kind: "completed", completedOn: "2026-12-02" });
    expect((await getEventTakeover(db, planner.organizationId, eventId))!.completedAt?.toISOString()).toBe("2026-12-02T10:00:00.000Z");

    // R9, horloge simulée : 6e et 7e jour, la ligne reste ; 8e jour, « Prochaine action » revient.
    expect((await loadEventChecklist(planner.organizationId, eventId, { today: "2026-12-08" }))!.block.kind).toBe("completed");
    expect((await loadEventChecklist(planner.organizationId, eventId, { today: "2026-12-09" }))!.block.kind).toBe("completed");
    expect((await loadEventChecklist(planner.organizationId, eventId, { today: "2026-12-10" }))!.block.kind).toBe("hidden");
  });
});

describe("BUD-01 — Le reste à répartir baisse quand un montant est saisi (critère 4)", () => {
  it("un réel saisi sur un poste fait baisser le reste ; à zéro, il ne reste que les prévus", async () => {
    const planner = await createPlanner();
    const { eventId, venue } = await leaHugo(planner);
    await updateBudgetLine({ organizationId: planner.organizationId, eventId, eventVendorSlotId: venue.slot.id, field: "committed", amountCents: 1_500_000, changedByUserId: planner.userId });
    let [amounts] = (await loadEventChecklist(planner.organizationId, eventId, NOV_25))!.points;
    expect(amounts).toMatchObject({ key: "amounts", remainingCents: 665_050 });
    await updateBudgetLine({ organizationId: planner.organizationId, eventId, eventVendorSlotId: venue.slot.id, field: "committed", amountCents: 2_165_050, changedByUserId: planner.userId });
    [amounts] = (await loadEventChecklist(planner.organizationId, eventId, NOV_25))!.points;
    expect(amounts).toMatchObject({ key: "amounts", remainingCents: null, done: false, count: 3 });
  });
});

describe("HUB-14 — La page de reprise compte les mêmes points que la fiche (contrats non signés compris)", () => {
  it("la page terminée reprend les points restants de la fiche, dans le même ordre", async () => {
    const planner = await createPlanner();
    const { takeoverId, eventId } = await leaHugo(planner);
    const page = await loadTakeoverPage(planner, takeoverId);
    expect(page!.state).toBe("done");
    const fiche = (await loadEventChecklist(planner.organizationId, eventId, NOV_25))!.points.filter((point) => !point.done);
    expect(page!.toComplete.map((point) => [point.key, point.count])).toEqual(fiche.map((point) => [point.key, point.count]));
    expect(page!.toComplete.some((point) => point.key === "contracts")).toBe(true);
    expect((await remainingTakeoverPoints(planner.organizationId, eventId)).length).toBe(6);
  });
});

describe("EVT-07 — La liste des évènements : la marque et le filtre « Origine » (critère 5)", () => {
  it("le filtre lit l'origine en SQL ; un mariage créé dans Symbola n'est pas « repris »", async () => {
    const planner = await createPlanner();
    const { eventId } = await leaHugo(planner);
    const { id: createdId } = await createProspect({ organizationId: planner.organizationId, createdByUserId: planner.userId, clients: [{ firstName: "Léa", lastName: "Dubois" }], prospectSourceId: null, eventDate: "2027-01-30" });
    expect((await listEvents({ organizationId: planner.organizationId, origin: "takeover" })).map((event) => event.id)).toEqual([eventId]);
    expect((await listEvents({ organizationId: planner.organizationId, origin: "created" })).map((event) => event.id)).toEqual([createdId]);
    expect((await listEvents({ organizationId: planner.organizationId })).find((event) => event.id === createdId)?.origin).toBe("created");
  });

  it("« Repris · 3 fichiers sur 6 », puis « Repris · 6 points à compléter » ; la marque quitte la ligne une fois complétée", async () => {
    const planner = await createPlanner();
    const open = await leaHugo(planner, { settleAll: false });
    await settleTakeoverStep(db, { organizationId: planner.organizationId, userId: planner.userId, takeoverId: open.takeoverId, kind: "vendor_book", state: "no_file" });
    const finished = await leaHugo(planner);
    const marks = new Map((await listTakeoversInProgress(planner.organizationId, planner.viewer)).map((entry) => [entry.eventId, entry.mark]));
    expect(marks.get(open.eventId)).toEqual({ kind: "files", settled: 2, total: 6 });
    expect(marks.get(finished.eventId)).toEqual({ kind: "points", count: 6 });

    const { markTakeoverCompleted } = await import("@/modules/hub/service");
    await markTakeoverCompleted(db, { organizationId: planner.organizationId, takeoverId: finished.takeoverId });
    expect((await listTakeoversInProgress(planner.organizationId, planner.viewer)).map((entry) => entry.eventId)).toEqual([open.eventId]);
  });

  it("abus : l'organisation B ne voit ni la reprise, ni la marque, ni le mariage de A par le filtre", async () => {
    const planner = await createPlanner();
    const { eventId } = await leaHugo(planner);
    const other = await createPlanner();
    expect(await loadEventChecklist(other.organizationId, eventId, NOV_25)).toBeNull();
    expect(await listTakeoversInProgress(other.organizationId, other.viewer)).toEqual([]);
    expect(await listEvents({ organizationId: other.organizationId, origin: "takeover" })).toEqual([]);
    expect(await remainingTakeoverPoints(other.organizationId, eventId)).toEqual([]);
    expect(await loadEventProvenance(other.organizationId, eventId, { steps: [] })).toEqual({});
  });

  it("abus : une Planner limitée à son équipe ne voit pas la reprise d'un mariage hors de son équipe", async () => {
    const owner = await createPlanner();
    const { eventId } = await leaHugo(owner);
    const member = await createPlanner("member", owner.organizationId);
    const restricted = { ...member.viewer, allPlannersSeeAll: false };
    expect(await loadEventChecklist(owner.organizationId, eventId, { viewer: restricted, ...NOV_25 })).toBeNull();
    expect(await listTakeoversInProgress(owner.organizationId, restricted)).toEqual([]);
  });
});

describe("HUB-08 — « Aujourd'hui » au lendemain d'une reprise (critère 6)", () => {
  it("aucune ligne née de la reprise ; la reprise est dans « Reprises en cours »", async () => {
    const planner = await createPlanner();
    const { eventId } = await leaHugo(planner);
    const { loadTodayItems } = await import("@/lib/today/load");
    const words = new Proxy({}, { get: () => () => "x" }) as never;
    const { items } = await loadTodayItems(planner.organizationId, { events: true, quotes: false, budget: true, vendors: true }, words, "fr");
    expect(items.filter((item) => item.eventId === eventId)).toEqual([]);
    const inProgress = await listTakeoversInProgress(planner.organizationId, planner.viewer);
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0]).toMatchObject({ eventId, mark: { kind: "points", count: 6 }, running: null });
  });
});

describe("EVT-02 — « D'où viennent ces valeurs ? » (critère 3)", () => {
  it("le fichier de chaque valeur reprise ; rien sur une valeur modifiée depuis ; « vous, à la reprise »", async () => {
    const planner = await createPlanner();
    const { eventId, takeoverId } = await leaHugo(planner);
    await setEventIdentity(planner.organizationId, eventId, { guestsEstimated: null, guestsConfirmed: null, style: null, notes: "Cérémonie laïque" });
    // Un import appliqué qui a écrit la note et les lieux (la fiche PDF), au journal.
    await withOrganization(db, planner.organizationId, async (tx) => {
      const [row] = await tx
        .insert(imports)
        .values({ organizationId: planner.organizationId, createdByUserId: planner.userId, entityType: "event_sheets", fileName: "fiche-lea-hugo.pdf", fileFormat: "pdf", fileSizeBytes: 10, headerRowIndex: 0, headers: [], rowCount: 1, status: "applied", expiresAt: new Date("2026-12-24T00:00:00Z"), appliedAt: new Date("2026-11-24T09:00:00Z"), takeoverId })
        .returning({ id: imports.id });
      await tx.insert(importItems).values({ organizationId: planner.organizationId, importId: row!.id, position: 0, module: "events", kind: "event", elementId: eventId, action: "updated", previous: {}, written: { notes: "Cérémonie laïque", venueName: "Domaine des Tilleuls" }, fields: ["notes", "venueName"] });
    });
    const view = (await getEventTakeover(db, planner.organizationId, eventId))!;
    expect(await loadEventProvenance(planner.organizationId, eventId, view)).toEqual({
      clients: { kind: "you" },
      notes: { kind: "file", fileName: "fiche-lea-hugo.pdf" },
    });
    // La note réécrite à la main : sa marque disparaît.
    await setEventIdentity(planner.organizationId, eventId, { guestsEstimated: null, guestsConfirmed: null, style: null, notes: "Cérémonie laïque, puis vin d'honneur" });
    expect((await loadEventProvenance(planner.organizationId, eventId, view)).notes).toBeUndefined();
    // Sans les valeurs écrites (90 jours), les champs restent attribués à leur fichier (I9).
    await withOrganization(db, planner.organizationId, (tx) => tx.update(importItems).set({ written: null }).where(and(eq(importItems.elementId, eventId), eq(importItems.module, "events"))));
    expect((await loadEventProvenance(planner.organizationId, eventId, view)).notes).toEqual({ kind: "file", fileName: "fiche-lea-hugo.pdf" });
  });
});

describe("EVT-02 — Un mariage créé dans Symbola : rien ne change (critère 7)", () => {
  it("ni reprise, ni points, ni marque", async () => {
    const planner = await createPlanner();
    const { id } = await createProspect({ organizationId: planner.organizationId, createdByUserId: planner.userId, clients: [{ firstName: "Inès", lastName: "Petit" }], prospectSourceId: null, eventDate: "2027-09-18" });
    expect(await loadEventChecklist(planner.organizationId, id, NOV_25)).toBeNull();
    expect(await listTakeoversInProgress(planner.organizationId, planner.viewer)).toEqual([]);
  });
});
