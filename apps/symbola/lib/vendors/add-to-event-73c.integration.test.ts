// Lot 73c (PRE-02, BUD-01, BUD-02, UX-07, SEC-10 à SEC-13 ; spécification du lot 73, § 5.3, critères 2 à
// 8 ; P12) — « Ajouter à un mariage… » tel que la fenêtre et le panneau du poste l'appellent, contre un vrai
// PostgreSQL (RLS) : les mariages et le poste proposés, l'ajout et son message, « Annuler », le carnet
// ouvert depuis un poste, la recherche du panneau ; tests d'abus (autre organisation, autre mariage,
// mariage annulé, Planner hors de l'équipe) : refusé, rien écrit, la même réponse « inexistant ».
import { randomUUID } from "node:crypto";
import { and, asc, eq, inArray } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import { domainEvents } from "@symbola/db/schema/core";
import { eventTeamMembers, events } from "@symbola/db/schema/events";
import { withOrganization } from "@symbola/db/with-organization";
import { EVT_VENDOR_RETENTION_RELEASED, EVT_VENDOR_SLOT_BOOKED, type VendorRetentionReleasedPayload, type VendorSlotBookedPayload } from "@symbola/contracts";
import { addDefaultVendorSlots, createProspect, createProspectSource, listEventVendorSlots, listVendorCandidates, updateVendorCandidate } from "@/modules/events/service";
import { applyVendorRetentionReleasedToBudget, applyVendorSlotBookedToBudget, listBudgetLines } from "@/modules/budget/service";
import { createVendor, createVendorFamily, createVendorType, listVendorDocumentKinds, requestVendorDocument, setVendorDocumentValidity } from "@/modules/vendors/service";
import { addToEvent, loadAdditionChoices, slotBookQueries, undoAddition, type AdditionAccess } from "./add-to-event";
import { searchSlotVendors } from "./slot-retention";

const plannerId = randomUUID();
const TODAY = "2026-11-28";

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function agency(eventDate = "2027-06-12") {
  const organizationId = (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
  await addDefaultVendorSlots(organizationId, ["Traiteur", "Fleurs et décoration"]);
  const source = await createProspectSource(organizationId, "Salon");
  const { id: eventId } = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }, { firstName: "Maxime", lastName: null }], eventDate });
  const slots = await listEventVendorSlots(organizationId, eventId);
  const caterer = slots.find((slot) => slot.label === "Traiteur")!;
  const flowers = slots.find((slot) => slot.label === "Fleurs et décoration")!;
  const florist = await createVendorType(organizationId, "Fleuriste", "#7c3aed");
  const photographer = await createVendorType(organizationId, "Photographe", "#0369a1");
  const vendor = async (name: string, typeId: string | null = null) => (await createVendor(organizationId, { name, ...(typeId ? { typeIds: [typeId], primaryTypeId: typeId } : {}) })).vendor;
  const access: AdditionAccess = { organizationId, userId: plannerId, viewer: { userId: plannerId, role: "owner", allPlannersSeeAll: true }, budgetEnabled: true };
  return { organizationId, eventId, caterer, flowers, florist, photographer, vendor, access };
}

// Le module Budget consomme les événements comme le ferait le worker : dans l'ordre, une fois chacun.
const consumed = new Set<string>();
async function consume(organizationId: string) {
  const rows = await withDb((db) =>
    withOrganization(db, organizationId, (tx) =>
      tx
        .select()
        .from(domainEvents)
        .where(and(eq(domainEvents.organizationId, organizationId), inArray(domainEvents.name, [EVT_VENDOR_SLOT_BOOKED, EVT_VENDOR_RETENTION_RELEASED])))
        .orderBy(asc(domainEvents.occurredAt)),
    ),
  );
  for (const row of rows) {
    if (consumed.has(row.id)) continue;
    consumed.add(row.id);
    if (row.name === EVT_VENDOR_SLOT_BOOKED) await applyVendorSlotBookedToBudget(organizationId, row.payload as VendorSlotBookedPayload);
    else await applyVendorRetentionReleasedToBudget(organizationId, row.payload as VendorRetentionReleasedPayload);
  }
}

const committed = async (context: { organizationId: string; eventId: string }, slotId: string) => (await listBudgetLines(context.organizationId, context.eventId)).lines.find((line) => line.eventVendorSlotId === slotId)?.committedAmountCents ?? null;
const states = async (context: { organizationId: string; eventId: string }) => (await listVendorCandidates(context.organizationId, context.eventId)).map((candidate) => [candidate.vendorName, candidate.status]);

describe("PRE-02 — Les mariages et le poste proposés dans la fenêtre (lot 73c, critère 2)", () => {
  it("les mariages à venir, nommés par leurs mariés ; le poste du métier principal proposé ; le métier pour « Nouveau poste »", async () => {
    const context = await agency("2099-06-12");
    const fleurs = await context.vendor("Les Fleurs du Causse", context.florist.id);
    const choices = await loadAdditionChoices(context.access, { vendorIds: [fleurs.id], today: TODAY });
    expect(choices).toMatchObject({ vendors: [{ id: fleurs.id, name: "Les Fleurs du Causse" }], tradeLabel: "Fleuriste" });
    expect(choices!.events).toEqual([expect.objectContaining({ eventId: context.eventId, label: "Léa & Maxime", eventDate: "2099-06-12", proposedSlotId: context.flowers.id, documentWarning: null })]);
    expect(choices!.events[0]!.slots.map((slot) => slot.label)).toEqual(["Traiteur", "Fleurs et décoration"]);
  });

  it("sans correspondance, aucun poste n'est proposé ; plusieurs fiches : ni métier ni poste proposé", async () => {
    const context = await agency("2099-06-12");
    const photo = await context.vendor("Atelier Lumière", context.photographer.id);
    const other = await context.vendor("Sans métier");
    expect((await loadAdditionChoices(context.access, { vendorIds: [photo.id], today: TODAY }))!.events[0]!.proposedSlotId).toBeNull();
    const many = await loadAdditionChoices(context.access, { vendorIds: [photo.id, other.id], today: TODAY });
    expect(many).toMatchObject({ tradeLabel: null, events: [expect.objectContaining({ proposedSlotId: null })] });
  });

  it("une pièce qui expire avant le mariage est signalée sous le mariage", async () => {
    const context = await agency("2099-06-12");
    const fleurs = await context.vendor("Les Fleurs du Causse", context.florist.id);
    const kinds = await listVendorDocumentKinds(context.organizationId);
    const insurance = kinds.find((kind) => kind.shortLabel === "Assurance")!;
    const document = await requestVendorDocument({ organizationId: context.organizationId, vendorId: fleurs.id, kindId: insurance.id });
    await setVendorDocumentValidity(context.organizationId, document.id, "2099-05-31");
    const choices = await loadAdditionChoices(context.access, { vendorIds: [fleurs.id], today: TODAY });
    expect(choices!.events[0]!.documentWarning).toEqual({ label: "Assurance", validUntil: "2099-05-31" });
    await setVendorDocumentValidity(context.organizationId, document.id, "2099-12-31");
    expect((await loadAdditionChoices(context.access, { vendorIds: [fleurs.id], today: TODAY }))!.events[0]!.documentWarning).toBeNull();
  });
});

describe("PRE-02, BUD-01 — Ajouter depuis la fenêtre ou le panneau du poste (lot 73c, critères 2 à 6)", () => {
  it("critère 2 — « Nouveau poste » crée le poste et y ajoute la fiche dans la même opération", async () => {
    const context = await agency();
    const caleche = await context.vendor("Calèches du Marais");
    const outcome = await addToEvent(context.access, { eventId: context.eventId, newSlotLabel: "Calèche", vendorIds: [caleche.id], mode: "compare" });
    expect(outcome).toMatchObject({ status: "added", slotLabel: "Calèche", slotCreated: true, mode: "compare" });
    const slot = (await listEventVendorSlots(context.organizationId, context.eventId)).find((entry) => entry.label === "Calèche")!;
    expect((await listVendorCandidates(context.organizationId, context.eventId)).map((candidate) => candidate.vendorSlotId)).toEqual([slot.id]);
  });

  it("critère 3 — « En comparaison » ne pourvoit pas le poste ; « Retenu » le pourvoit et porte le devis au réel (ligne engagée)", async () => {
    const context = await agency();
    const haddad = await context.vendor("Maison Haddad");
    expect(await addToEvent(context.access, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [haddad.id], mode: "compare" })).toMatchObject({ status: "added", comparingCount: 1 });
    expect((await listEventVendorSlots(context.organizationId, context.eventId)).find((slot) => slot.id === context.caterer.id)!.retainedVendors).toEqual([]);
    const candidate = (await listVendorCandidates(context.organizationId, context.eventId))[0]!;
    await updateVendorCandidate({ organizationId: context.organizationId, candidateId: candidate.id, quoteAmountCents: 390000 });
    expect(await addToEvent(context.access, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [haddad.id], mode: "retain" })).toMatchObject({ status: "added", mode: "retain" });
    await consume(context.organizationId);
    expect(await committed(context, context.caterer.id)).toBe(390000);
  });

  it("critère 4 (P12) — poste pourvu : « Retenu » demande le choix en nommant le retenu ; « Remplacer » le fait repasser en comparaison ; « Retenir aussi » garde les deux", async () => {
    const context = await agency();
    const [haddad, epoque, verdier] = [await context.vendor("Maison Haddad"), await context.vendor("Belle Époque"), await context.vendor("Maison Verdier")];
    await addToEvent(context.access, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [haddad.id], mode: "retain" });
    expect(await addToEvent(context.access, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [epoque.id], mode: "retain" })).toEqual({ status: "choice_required", retainedName: "Maison Haddad" });
    expect(await states(context)).toEqual([["Maison Haddad", "retained"]]);
    expect(await addToEvent(context.access, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [epoque.id], mode: "replace" })).toMatchObject({ status: "added", replacedName: "Maison Haddad" });
    // Le remplacé n'est pas supprimé : il repasse en comparaison.
    expect(await states(context)).toEqual([
      ["Maison Haddad", "shortlisted"],
      ["Belle Époque", "retained"],
    ]);
    await addToEvent(context.access, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [verdier.id], mode: "retain_also" });
    expect((await listEventVendorSlots(context.organizationId, context.eventId)).find((slot) => slot.id === context.caterer.id)!.retainedVendors.map((vendor) => vendor.vendorName)).toEqual(["Belle Époque", "Maison Verdier"]);
  });

  it("critère 5 — le message dit où il est allé (poste, mariés, nombre en comparaison) ; « Annuler » rend l'état d'avant, au nouveau comme à l'ancien, budget compris", async () => {
    const context = await agency();
    const [haddad, epoque, other] = [await context.vendor("Maison Haddad"), await context.vendor("Belle Époque"), await context.vendor("Autre")];
    await addToEvent(context.access, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [other.id], mode: "compare" });
    const compared = await addToEvent(context.access, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [haddad.id], mode: "compare" });
    expect(compared).toMatchObject({ status: "added", eventId: context.eventId, slotId: context.caterer.id, slotLabel: "Traiteur", eventLabel: "Léa & Maxime", vendorNames: ["Maison Haddad"], comparingCount: 2, replacedName: null });
    const candidate = (await listVendorCandidates(context.organizationId, context.eventId)).find((entry) => entry.vendorName === "Maison Haddad")!;
    await updateVendorCandidate({ organizationId: context.organizationId, candidateId: candidate.id, quoteAmountCents: 250000 });
    await addToEvent(context.access, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [haddad.id], mode: "retain", confirmed: true });
    await consume(context.organizationId);
    expect(await committed(context, context.caterer.id)).toBe(250000);

    const replaced = await addToEvent(context.access, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [epoque.id], mode: "replace" });
    if (replaced.status !== "added") throw new Error("ajout attendu");
    await consume(context.organizationId);
    expect(await committed(context, context.caterer.id)).toBeNull();
    expect(await undoAddition(context.access, replaced.undoId)).toBe(true);
    // L'ancien retenu l'est de nouveau ; le nouveau a quitté le poste ; le réel revient (« Autre » reste
    // écarté, comme avant « Remplacer » : retenir écarte ceux encore en lice, règle du lot 28a).
    expect(await states(context)).toEqual([
      ["Autre", "dismissed"],
      ["Maison Haddad", "retained"],
    ]);
    await consume(context.organizationId);
    expect(await committed(context, context.caterer.id)).toBe(250000);
    expect(await undoAddition(context.access, replaced.undoId)).toBe(false);
  });

  it("critère 6 — plusieurs fiches vont toutes en comparaison sur un même poste ; « Retenu » pour plusieurs est refusé sans rien écrire", async () => {
    const context = await agency();
    const [a, b, c] = [await context.vendor("A"), await context.vendor("B"), await context.vendor("C")];
    expect(await addToEvent(context.access, { eventId: context.eventId, slotId: context.flowers.id, vendorIds: [a.id, b.id, c.id], mode: "retain" })).toEqual({ status: "not_found" });
    expect(await listVendorCandidates(context.organizationId, context.eventId)).toEqual([]);
    expect(await addToEvent(context.access, { eventId: context.eventId, slotId: context.flowers.id, vendorIds: [a.id, b.id, c.id], mode: "compare" })).toMatchObject({ status: "added", comparingCount: 3, vendorNames: ["A", "B", "C"] });
    expect(await states(context)).toEqual([
      ["A", "shortlisted"],
      ["B", "shortlisted"],
      ["C", "shortlisted"],
    ]);
  });
});

describe("PRE-02 — Le carnet ouvert depuis un poste (lot 73c, critère 8)", () => {
  it("filtré par le métier du poste, ou sa famille ; rien quand aucun métier ne lui correspond", async () => {
    const context = await agency();
    const family = await createVendorFamily(context.organizationId, { label: "Musique", color: "#1d4ed8", icon: "music" });
    await addToEvent(context.access, { eventId: context.eventId, newSlotLabel: "Musique", vendorIds: [(await context.vendor("Orchestre")).id], mode: "compare" });
    const slots = await listEventVendorSlots(context.organizationId, context.eventId);
    const queries = await slotBookQueries(context.organizationId, slots);
    expect(queries[context.flowers.id]).toEqual({ type: context.florist.id, label: "Fleuriste" });
    expect(queries[slots.find((slot) => slot.label === "Musique")!.id]).toEqual({ famille: family.id, label: "Musique" });
    expect(queries[context.caterer.id]).toEqual({});
  });
});

describe("PRE-02, PRE-05 — La recherche du panneau du poste (lot 73c, critère 7)", () => {
  it("les fiches du métier d'abord, avec leurs pièces ; une fiche déjà là dit « Dans la comparaison » ; le nombre de fiches du carnet", async () => {
    const context = await agency("2099-06-12");
    const [fleurs, autre] = [await context.vendor("Les Fleurs du Causse", context.florist.id), await context.vendor("Atelier Lumière", context.photographer.id)];
    await addToEvent(context.access, { eventId: context.eventId, slotId: context.flowers.id, vendorIds: [fleurs.id], mode: "compare" });
    const found = await searchSlotVendors({ organizationId: context.organizationId, eventId: context.eventId, slotId: context.flowers.id, term: "", locale: "fr" });
    expect(found).toMatchObject({ tradeLabel: "Fleuriste", matchingCount: 1, bookCount: 2 });
    expect(found.choices.map((choice) => [choice.name, choice.matchesSlot, choice.onSlot])).toEqual([["Les Fleurs du Causse", true, "compared"]]);
    expect(found.choices[0]!.documentState).toMatchObject({ state: "none_requested" });
    const searched = await searchSlotVendors({ organizationId: context.organizationId, eventId: context.eventId, slotId: context.flowers.id, term: "Atelier", locale: "fr" });
    expect(searched.choices.map((choice) => [choice.id, choice.matchesSlot])).toEqual([[autre.id, false]]);
  });
});

describe("SEC-10 à SEC-13 — Abus de « Ajouter à un mariage… » (lot 73c)", () => {
  it("une fiche de B vers un mariage de A, une fiche de A vers un mariage de B, un poste d'un autre mariage : la même réponse, rien n'est écrit", async () => {
    const a = await agency();
    const b = await agency();
    const own = await a.vendor("Maison Haddad");
    const foreign = await b.vendor("Ailleurs");
    expect(await addToEvent(a.access, { eventId: a.eventId, slotId: a.caterer.id, vendorIds: [foreign.id], mode: "compare" })).toEqual({ status: "not_found" });
    expect(await addToEvent(a.access, { eventId: b.eventId, slotId: b.caterer.id, vendorIds: [own.id], mode: "compare" })).toEqual({ status: "not_found" });
    expect(await addToEvent(a.access, { eventId: a.eventId, slotId: b.caterer.id, vendorIds: [own.id], mode: "compare" })).toEqual({ status: "not_found" });
    expect(await listVendorCandidates(a.organizationId, a.eventId)).toEqual([]);
    expect(await listVendorCandidates(b.organizationId, b.eventId)).toEqual([]);
    // La fenêtre ne s'ouvre pas sur la fiche d'une autre organisation, et ne montre pas ses mariages.
    expect(await loadAdditionChoices(a.access, { vendorIds: [foreign.id], today: TODAY })).toBeNull();
    expect((await loadAdditionChoices(a.access, { vendorIds: [own.id], today: TODAY }))!.events.map((event) => event.eventId)).toEqual([a.eventId]);
  });

  it("un mariage annulé n'est pas proposé, et l'ajout y répond « inexistant »", async () => {
    const context = await agency("2099-06-12");
    const haddad = await context.vendor("Maison Haddad");
    await withDb((db) => withOrganization(db, context.organizationId, (tx) => tx.update(events).set({ status: "cancelled" }).where(eq(events.id, context.eventId))));
    expect((await loadAdditionChoices(context.access, { vendorIds: [haddad.id], today: TODAY }))!.events).toEqual([]);
    expect(await addToEvent(context.access, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [haddad.id], mode: "compare" })).toEqual({ status: "not_found" });
  });

  it("une Planner restreinte à son équipe ne voit pas les autres mariages dans la fenêtre et ne peut y ajouter ; ni annuler l'ajout d'une autre", async () => {
    const context = await agency("2099-06-12");
    const haddad = await context.vendor("Maison Haddad");
    const restricted: AdditionAccess = { ...context.access, userId: randomUUID(), viewer: { userId: randomUUID(), role: "member", allPlannersSeeAll: false } };
    restricted.viewer.userId = restricted.userId;
    expect((await loadAdditionChoices(restricted, { vendorIds: [haddad.id], today: TODAY }))!.events).toEqual([]);
    expect(await addToEvent(restricted, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [haddad.id], mode: "compare" })).toEqual({ status: "not_found" });
    const added = await addToEvent(context.access, { eventId: context.eventId, slotId: context.caterer.id, vendorIds: [haddad.id], mode: "compare" });
    if (added.status !== "added") throw new Error("ajout attendu");
    expect(await undoAddition(restricted, added.undoId)).toBe(false);
    await withDb((db) => withOrganization(db, context.organizationId, (tx) => tx.insert(eventTeamMembers).values({ organizationId: context.organizationId, eventId: context.eventId, userId: restricted.userId, role: "lead" })));
    expect((await loadAdditionChoices(restricted, { vendorIds: [haddad.id], today: TODAY }))!.events.map((event) => event.eventId)).toEqual([context.eventId]);
  });
});
