// Lot 73a (PRE-02, BUD-01, BUD-02, UX-07 ; spécification du lot 73, § 5.1, critères 8 à 10 ; P5, P12) —
// « Ajouter à un mariage… » côté service, contre un vrai PostgreSQL (RLS) : en comparaison, retenu,
// remplacer, retenir aussi, « Annuler » ; la date de rétention ; « Annuler » une relance ; tests d'abus
// (autre organisation, évènement annulé, Planner hors de l'équipe, autre personne).
import { randomUUID } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { domainEvents } from "@symbola/db/schema/core";
import { eventTeamMembers, events } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { EVT_VENDOR_RETENTION_RELEASED, EVT_VENDOR_SLOT_BOOKED, type VendorRetentionReleasedPayload, type VendorSlotBookedPayload } from "@symbola/contracts";
import {
  addDefaultVendorSlots,
  addVendorToEventSlot,
  changeRetainedVendor,
  createProspect,
  createProspectSource,
  EventNotFoundError,
  exportEventsData,
  listEventsForVendorAddition,
  listEventVendorSlots,
  listUncontractedVendors,
  listVendorCandidates,
  recordVendorReminder,
  setEventWantedBudget,
  undoVendorAddition,
  undoVendorReminder,
  updateVendorCandidate,
} from "@/modules/events/service";
import { applyVendorRetentionReleasedToBudget, applyVendorSlotBookedToBudget, listBudgetLines } from "@/modules/budget/service";
import { createVendor, VendorNotFoundError } from "@/modules/vendors/service";
import { addVendorsToEvent } from "./event-addition";

const plannerId = randomUUID();

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function wedding(eventDate = "2027-06-12") {
  const organizationId = (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
  await addDefaultVendorSlots(organizationId, ["Traiteur", "Fleuriste"]);
  const source = await createProspectSource(organizationId, "Salon");
  const { id: eventId } = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }], eventDate });
  const slots = await listEventVendorSlots(organizationId, eventId);
  const caterer = slots.find((slot) => slot.label === "Traiteur")!;
  const vendor = async (name: string) => (await createVendor(organizationId, { name })).vendor;
  return { organizationId, eventId, caterer, vendor };
}

const add = (context: { organizationId: string; eventId: string }, extra: { slotId?: string; newSlotLabel?: string; vendorIds: string[]; mode: "compare" | "retain" | "replace" | "retain_also"; confirmed?: boolean; userId?: string }) =>
  addVendorsToEvent({ organizationId: context.organizationId, userId: extra.userId ?? plannerId, eventId: context.eventId, budgetEnabled: true, ...extra });

async function published<T>(organizationId: string, name: string): Promise<T[]> {
  return withDb((db) =>
    withOrganization(db, organizationId, async (tx) =>
      (await tx.select().from(domainEvents).where(and(eq(domainEvents.organizationId, organizationId), eq(domainEvents.name, name))).orderBy(asc(domainEvents.occurredAt))).map((row) => row.payload as T),
    ),
  );
}

// Le module Budget consomme les événements comme le ferait le worker.
async function consume(organizationId: string) {
  for (const payload of await published<VendorSlotBookedPayload>(organizationId, EVT_VENDOR_SLOT_BOOKED)) await applyVendorSlotBookedToBudget(organizationId, payload);
  for (const payload of await published<VendorRetentionReleasedPayload>(organizationId, EVT_VENDOR_RETENTION_RELEASED)) await applyVendorRetentionReleasedToBudget(organizationId, payload);
}

async function setEventStatus(organizationId: string, eventId: string, status: "cancelled" | "closed") {
  await withDb((db) => withOrganization(db, organizationId, (tx) => tx.update(events).set({ status }).where(eq(events.id, eventId))));
}

describe("PRE-02 — Ajouter un prestataire du carnet à un mariage (lot 73a)", () => {
  it("critère 8 — « En comparaison » crée une ligne par fiche, sans doublon, et ne pourvoit pas le poste", async () => {
    const context = await wedding();
    const [a, b] = [await context.vendor("Maison Haddad"), await context.vendor("Belle Époque Traiteur")];
    const result = await add(context, { slotId: context.caterer.id, vendorIds: [a.id, b.id], mode: "compare" });
    expect(result).toMatchObject({ status: "added", slotLabel: "Traiteur", comparingCount: 2, replaced: null, slotCreated: false });
    await add(context, { slotId: context.caterer.id, vendorIds: [a.id], mode: "compare" });
    const candidates = await listVendorCandidates(context.organizationId, context.eventId);
    expect(candidates.map((candidate) => [candidate.vendorName, candidate.status])).toEqual([
      ["Maison Haddad", "shortlisted"],
      ["Belle Époque Traiteur", "shortlisted"],
    ]);
    expect((await listEventVendorSlots(context.organizationId, context.eventId)).find((slot) => slot.id === context.caterer.id)!.retainedVendors).toEqual([]);
  });

  it("critère 8 — « Retenu » engage la ligne au montant du devis ; l'événement part dans la transaction", async () => {
    const context = await wedding();
    const haddad = await context.vendor("Maison Haddad");
    const [candidateId] = ((await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "compare" })) as { candidateIds: string[] }).candidateIds;
    await updateVendorCandidate({ organizationId: context.organizationId, candidateId: candidateId!, quoteAmountCents: 390000 });
    const result = await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "retain" });
    expect(result).toMatchObject({ status: "added", candidateIds: [candidateId] });
    const booked = await published<VendorSlotBookedPayload>(context.organizationId, EVT_VENDOR_SLOT_BOOKED);
    expect(booked).toEqual([expect.objectContaining({ candidateId, vendorSlotId: context.caterer.id, amountCents: 390000, bookedByUserId: plannerId })]);
    await consume(context.organizationId);
    const line = (await listBudgetLines(context.organizationId, context.eventId)).lines.find((entry) => entry.eventVendorSlotId === context.caterer.id)!;
    expect(line.committedAmountCents).toBe(390000);
  });

  it("critère 8 — au-delà du seuil d'alerte, « Retenir quand même ? » ; rien n'est écrit avant la réponse", async () => {
    const context = await wedding();
    const haddad = await context.vendor("Maison Haddad");
    const [candidateId] = ((await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "compare" })) as { candidateIds: string[] }).candidateIds;
    await updateVendorCandidate({ organizationId: context.organizationId, candidateId: candidateId!, quoteAmountCents: 390000 });
    await setEventWantedBudget(context.organizationId, context.eventId, 300000);
    const asked = await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "retain" });
    expect(asked).toMatchObject({ status: "confirm_budget", committedAfterCents: 390000, thresholdPercent: 90 });
    expect((await listVendorCandidates(context.organizationId, context.eventId))[0]!.status).toBe("quote_received");
    expect(await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "retain", confirmed: true })).toMatchObject({ status: "added" });
    expect((await listVendorCandidates(context.organizationId, context.eventId))[0]!.status).toBe("retained");
  });

  it("critère 8 (P12) — poste déjà pourvu : « retain » demande le choix sans rien écrire ; « replace » fait repasser l'ancien en comparaison ; « retain_also » garde les deux", async () => {
    const context = await wedding();
    const [haddad, epoque, verdier] = [await context.vendor("Maison Haddad"), await context.vendor("Belle Époque"), await context.vendor("Maison Verdier")];
    await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "retain" });
    const haddadCandidate = (await listVendorCandidates(context.organizationId, context.eventId))[0]!;
    const asked = await add(context, { slotId: context.caterer.id, vendorIds: [epoque.id], mode: "retain" });
    expect(asked).toEqual({ status: "choice_required", retained: [{ candidateId: haddadCandidate.id, vendorName: "Maison Haddad" }] });
    expect(await listVendorCandidates(context.organizationId, context.eventId)).toHaveLength(1);

    const replaced = await add(context, { slotId: context.caterer.id, vendorIds: [epoque.id], mode: "replace" });
    expect(replaced).toMatchObject({ status: "added", replaced: { candidateId: haddadCandidate.id, vendorName: "Maison Haddad" } });
    expect((await listVendorCandidates(context.organizationId, context.eventId)).map((candidate) => [candidate.vendorName, candidate.status])).toEqual([
      ["Maison Haddad", "shortlisted"],
      ["Belle Époque", "retained"],
    ]);
    expect(await published(context.organizationId, EVT_VENDOR_RETENTION_RELEASED)).toEqual([expect.objectContaining({ candidateId: haddadCandidate.id })]);

    await add(context, { slotId: context.caterer.id, vendorIds: [verdier.id], mode: "retain_also" });
    const retained = (await listEventVendorSlots(context.organizationId, context.eventId)).find((slot) => slot.id === context.caterer.id)!.retainedVendors.map((vendor) => vendor.vendorName);
    expect(retained).toEqual(["Belle Époque", "Maison Verdier"]);
  });

  it("« Nouveau poste » crée le poste et y ajoute le prestataire dans la même opération", async () => {
    const context = await wedding();
    const caleche = await context.vendor("Calèches du Marais");
    const result = await add(context, { newSlotLabel: "Calèche", vendorIds: [caleche.id], mode: "compare" });
    expect(result).toMatchObject({ status: "added", slotCreated: true, slotLabel: "Calèche" });
    const slot = (await listEventVendorSlots(context.organizationId, context.eventId)).find((entry) => entry.label === "Calèche");
    expect(slot).toBeDefined();
    expect((await listVendorCandidates(context.organizationId, context.eventId)).map((candidate) => [candidate.vendorSlotId, candidate.vendorName])).toEqual([[slot!.id, "Calèches du Marais"]]);
  });

  it("plusieurs fiches ne se retiennent pas d'un coup : seulement en comparaison", async () => {
    const context = await wedding();
    const [a, b] = [await context.vendor("A"), await context.vendor("B")];
    await expect(add(context, { slotId: context.caterer.id, vendorIds: [a.id, b.id], mode: "retain" })).rejects.toBeInstanceOf(RangeError);
    expect(await listVendorCandidates(context.organizationId, context.eventId)).toEqual([]);
  });
});

describe("UX-07 — « Annuler » un ajout à un mariage (lot 73a, critère 9)", () => {
  it("dans les dix secondes, l'état d'avant revient, retenu compris : la ligne de budget n'est plus engagée", async () => {
    const context = await wedding();
    const haddad = await context.vendor("Maison Haddad");
    const [candidateId] = ((await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "compare" })) as { candidateIds: string[] }).candidateIds;
    await updateVendorCandidate({ organizationId: context.organizationId, candidateId: candidateId!, quoteAmountCents: 250000 });
    const result = (await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "retain" })) as { undoId: string };
    await consume(context.organizationId);
    expect((await listBudgetLines(context.organizationId, context.eventId)).lines.find((line) => line.eventVendorSlotId === context.caterer.id)!.committedAmountCents).toBe(250000);

    expect(await undoVendorAddition({ organizationId: context.organizationId, userId: plannerId, undoId: result.undoId })).toBe(true);
    expect((await listVendorCandidates(context.organizationId, context.eventId)).map((candidate) => [candidate.id, candidate.status, candidate.retainedAt])).toEqual([[candidateId, "quote_received", null]]);
    await consume(context.organizationId);
    expect((await listBudgetLines(context.organizationId, context.eventId)).lines.find((line) => line.eventVendorSlotId === context.caterer.id)!.committedAmountCents).toBeNull();
    // Une seule fois.
    expect(await undoVendorAddition({ organizationId: context.organizationId, userId: plannerId, undoId: result.undoId })).toBe(false);
  });

  it("« Remplacer » annulé : l'ancien retenu l'est de nouveau, avec sa date ; le nouveau disparaît ; un poste créé aussi", async () => {
    const context = await wedding();
    const [haddad, epoque] = [await context.vendor("Maison Haddad"), await context.vendor("Belle Époque")];
    await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "retain" });
    const before = (await listVendorCandidates(context.organizationId, context.eventId))[0]!;
    const replaced = (await add(context, { slotId: context.caterer.id, vendorIds: [epoque.id], mode: "replace" })) as { undoId: string };
    expect(await undoVendorAddition({ organizationId: context.organizationId, userId: plannerId, undoId: replaced.undoId })).toBe(true);
    expect((await listVendorCandidates(context.organizationId, context.eventId)).map((candidate) => [candidate.vendorName, candidate.status, candidate.retainedAt])).toEqual([["Maison Haddad", "retained", before.retainedAt]]);

    const created = (await add(context, { newSlotLabel: "Calèche", vendorIds: [epoque.id], mode: "compare" })) as { undoId: string };
    expect(await undoVendorAddition({ organizationId: context.organizationId, userId: plannerId, undoId: created.undoId })).toBe(true);
    expect((await listEventVendorSlots(context.organizationId, context.eventId)).some((slot) => slot.label === "Calèche")).toBe(false);
  });

  it("refusé après le délai, par une autre personne ou depuis une autre organisation ; rien ne change", async () => {
    const context = await wedding();
    const other = await wedding();
    const haddad = await context.vendor("Maison Haddad");
    const result = (await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "compare" })) as { undoId: string };
    expect(await undoVendorAddition({ organizationId: context.organizationId, userId: randomUUID(), undoId: result.undoId })).toBe(false);
    expect(await undoVendorAddition({ organizationId: other.organizationId, userId: plannerId, undoId: result.undoId })).toBe(false);
    expect(await undoVendorAddition({ organizationId: context.organizationId, userId: plannerId, undoId: result.undoId, now: new Date(Date.now() + 60_000) })).toBe(false);
    expect(await listVendorCandidates(context.organizationId, context.eventId)).toHaveLength(1);
  });
});

describe("PRE-02 — « Retenu le … » daté du jour où il a été retenu (lot 73a, critère 10 ; P5)", () => {
  it("posée quand il devient retenu, gardée quand on le modifie ensuite, effacée quand il ne l'est plus", async () => {
    const context = await wedding("2099-06-12");
    const haddad = await context.vendor("Maison Haddad");
    await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "retain" });
    const retained = (await listVendorCandidates(context.organizationId, context.eventId))[0]!;
    expect(retained.retainedAt).not.toBeNull();
    await new Promise((resolve) => setTimeout(resolve, 20));
    await updateVendorCandidate({ organizationId: context.organizationId, candidateId: retained.id, contactedOn: "2026-11-20", shownToClients: true });
    await updateVendorCandidate({ organizationId: context.organizationId, candidateId: retained.id, status: "contract_signed", changedByUserId: plannerId });
    expect((await listVendorCandidates(context.organizationId, context.eventId))[0]!.retainedAt).toBe(retained.retainedAt);
    await updateVendorCandidate({ organizationId: context.organizationId, candidateId: retained.id, status: "retained", changedByUserId: plannerId });

    const uncontracted = (await listUncontractedVendors(context.organizationId, "2026-11-27")).find((vendor) => vendor.candidateId === retained.id);
    const day = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date(retained.retainedAt!));
    expect(uncontracted?.since).toBe(day);

    await changeRetainedVendor({ organizationId: context.organizationId, userId: plannerId, eventId: context.eventId, vendorSlotId: context.caterer.id, candidateId: null });
    expect((await listVendorCandidates(context.organizationId, context.eventId))[0]!.retainedAt).toBeNull();
  });
});

describe("RGP-05, HUB-13 — La date de rétention suit la ligne du prestataire (lot 73a)", () => {
  it("l'export complet porte la date de rétention (retainedAt) ; l'état d'avant d'un ajout (« Annuler ») n'est pas exporté", async () => {
    const context = await wedding("2099-06-12");
    const haddad = await context.vendor("Maison Haddad");
    await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "retain" });
    const candidate = (await listVendorCandidates(context.organizationId, context.eventId))[0]!;
    const exported = JSON.stringify(await exportEventsData(context.organizationId, { excludedEventIds: new Set() }));
    expect(exported).toContain(`"retainedAt":"${new Date(candidate.retainedAt!).toISOString()}"`.slice(0, 26));
    expect(exported).toContain(candidate.id);
    expect(exported).not.toContain("vendor_addition");
  });
});

describe("PRE-02 — « Annuler » une relance notée (lot 73a)", () => {
  it("la relance, sa note et son activité disparaissent, pour la personne qui l'a notée seulement", async () => {
    const context = await wedding("2099-06-12");
    const haddad = await context.vendor("Maison Haddad");
    await add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "retain" });
    const candidate = (await listVendorCandidates(context.organizationId, context.eventId))[0]!;
    const { reminderId } = await recordVendorReminder({ organizationId: context.organizationId, eventId: context.eventId, candidateId: candidate.id, userId: plannerId, channel: "phone", note: "Rappeler jeudi" });
    expect(await undoVendorReminder({ organizationId: context.organizationId, userId: randomUUID(), reminderId })).toBe(false);
    const other = await wedding();
    expect(await undoVendorReminder({ organizationId: other.organizationId, userId: plannerId, reminderId })).toBe(false);
    expect((await listVendorCandidates(context.organizationId, context.eventId))[0]!.notes).toHaveLength(1);
    expect(await undoVendorReminder({ organizationId: context.organizationId, userId: plannerId, reminderId })).toBe(true);
    expect((await listVendorCandidates(context.organizationId, context.eventId))[0]!.notes).toEqual([]);
    expect(await undoVendorReminder({ organizationId: context.organizationId, userId: plannerId, reminderId })).toBe(false);
  });
});

describe("SEC-10 à SEC-13 — Abus de l'ajout à un mariage (lot 73a)", () => {
  it("une fiche d'une autre organisation, même une seule dans le lot, fait tout refuser sans rien écrire", async () => {
    const a = await wedding();
    const b = await wedding();
    const own = await a.vendor("Maison Haddad");
    const foreign = await b.vendor("Ailleurs");
    await expect(add(a, { slotId: a.caterer.id, vendorIds: [own.id, foreign.id], mode: "compare" })).rejects.toBeInstanceOf(VendorNotFoundError);
    expect(await listVendorCandidates(a.organizationId, a.eventId)).toEqual([]);
  });

  it("un mariage ou un poste d'une autre organisation, ou d'un autre mariage, répond « inexistant » ; rien n'est écrit", async () => {
    const a = await wedding();
    const b = await wedding();
    const own = await a.vendor("Maison Haddad");
    await expect(addVendorToEventSlot({ organizationId: a.organizationId, userId: plannerId, eventId: b.eventId, slotId: b.caterer.id, vendors: [{ vendorId: own.id, vendorName: own.name }], mode: "compare" })).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(addVendorToEventSlot({ organizationId: a.organizationId, userId: plannerId, eventId: a.eventId, slotId: b.caterer.id, vendors: [{ vendorId: own.id, vendorName: own.name }], mode: "compare" })).rejects.toBeInstanceOf(EventNotFoundError);
    expect(await listVendorCandidates(a.organizationId, a.eventId)).toEqual([]);
    expect(await listVendorCandidates(b.organizationId, b.eventId)).toEqual([]);
  });

  it("un mariage annulé ou clôturé répond comme inexistant, et n'est pas proposé", async () => {
    const context = await wedding("2099-06-12");
    const haddad = await context.vendor("Maison Haddad");
    expect((await listEventsForVendorAddition(context.organizationId, { today: "2026-11-27" })).map((event) => event.eventId)).toEqual([context.eventId]);
    await setEventStatus(context.organizationId, context.eventId, "cancelled");
    await expect(add(context, { slotId: context.caterer.id, vendorIds: [haddad.id], mode: "compare" })).rejects.toBeInstanceOf(EventNotFoundError);
    expect(await listEventsForVendorAddition(context.organizationId, { today: "2026-11-27" })).toEqual([]);
  });

  it("une Planner qui ne voit que son équipe ne voit pas les autres mariages et ne peut y ajouter", async () => {
    const context = await wedding("2099-06-12");
    const haddad = await context.vendor("Maison Haddad");
    const restricted = { userId: randomUUID(), role: "member" as const, allPlannersSeeAll: false };
    expect(await listEventsForVendorAddition(context.organizationId, { today: "2026-11-27", viewer: restricted })).toEqual([]);
    await expect(addVendorToEventSlot({ organizationId: context.organizationId, userId: restricted.userId, eventId: context.eventId, slotId: context.caterer.id, vendors: [{ vendorId: haddad.id, vendorName: haddad.name }], mode: "compare", viewer: restricted })).rejects.toBeInstanceOf(EventNotFoundError);
    // Dans l'équipe du mariage, elle le voit.
    const lead = { userId: randomUUID(), role: "member" as const, allPlannersSeeAll: false };
    await withDb((db) => withOrganization(db, context.organizationId, (tx) => tx.insert(eventTeamMembers).values({ organizationId: context.organizationId, eventId: context.eventId, userId: lead.userId, role: "lead" })));
    const visible = await listEventsForVendorAddition(context.organizationId, { today: "2026-11-27", viewer: lead });
    expect(visible.map((event) => event.eventId)).toEqual([context.eventId]);
    expect(visible[0]!.slots.map((slot) => slot.label)).toEqual(["Traiteur", "Fleuriste"]);
  });

  it("les évènements proposés : à venir, le plus proche d'abord, avec le nombre en comparaison et les retenus de chaque poste", async () => {
    const context = await wedding("2099-09-12");
    const source = await createProspectSource(context.organizationId, "Bouche à oreille");
    const sooner = await createProspect({ organizationId: context.organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Inès", lastName: null }], eventDate: "2099-05-01" });
    await createProspect({ organizationId: context.organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Passé", lastName: null }], eventDate: "2020-05-01" });
    const [a, b] = [await context.vendor("A"), await context.vendor("B")];
    await add(context, { slotId: context.caterer.id, vendorIds: [a.id], mode: "retain" });
    await add(context, { slotId: context.caterer.id, vendorIds: [b.id], mode: "compare" });
    const list = await listEventsForVendorAddition(context.organizationId, { today: "2026-11-27" });
    expect(list.map((event) => event.eventId)).toEqual([sooner.id, context.eventId]);
    expect(list[1]!.slots.find((slot) => slot.id === context.caterer.id)).toMatchObject({ comparingCount: 1, retained: [{ vendorName: "A", vendorId: a.id }] });
  });
});
