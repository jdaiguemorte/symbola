// Lot 50 — INV-05 (plan de table) et INV-06 (synthèse pour le traiteur), contre un vrai PostgreSQL :
// tables en série, copie d'un plan, présents et « en attente », désistement, contraintes et capacité
// signalées, une place par invité et par plan ; synthèse exacte sur un jeu de cent vingt invités
// (SC-07), nominative pour la titulaire seule, agrégée exacte pour un membre, rien n'est stocké,
// chaque téléchargement journalisé sans contenu ; abus (autre organisation, client, autre
// évènement) ; purge à horloge simulée (régimes à J+7, plan et contraintes à J+30). Données fictives.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createUser } from "@symbola/auth";
import { auditEntries } from "@symbola/db/schema/core";
import { catererSummaryDownloads, diets, seatAssignments, seatingConstraints, seatingPlans, seatingTables, vendorMealCounts } from "@symbola/db/schema/guests";
import { organizationExports, privacyExports } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import type { HouseholdView } from "@symbola/contracts";
import { dietPlace, sealDietOptions } from "./diets";
import {
  addMealType,
  addSeatingConstraint,
  addSeatingTables,
  answerRsvp,
  copySeatingPlan,
  createSeatingPlan,
  dismissSeatRelease,
  downloadCatererSummary,
  getSeatingPlan,
  GuestEventNotFoundError,
  guestsPrivacy,
  listDietaryOptions,
  listHouseholds,
  listMealTypes,
  listSeatingMoments,
  openRsvp,
  recordHouseholdAnswers,
  removeSeatingTable,
  renameMealType,
  runGuestPurge,
  seatGuest,
  seatHousehold,
  SeatingInvalidError,
  SeatingNotFoundError,
  setGuestMealType,
  setMealTypeHidden,
  setVendorMealCount,
  updateSeatingTable,
} from "./service";
import { household, linkFor, openResponses, readyOrganization, weddingEvent, withDb } from "./test-fixtures";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function rows<T>(organizationId: string, query: (tx: Tx) => Promise<T>): Promise<T> {
  return withDb((db) => withOrganization(db, organizationId, query));
}

async function wedding() {
  const org = await readyOrganization();
  const event = await weddingEvent(org.organizationId, org.ownerId);
  await openResponses(org.organizationId, event.eventId);
  return { ...org, ...event };
}

// Réponse notée par la planner : présent (true), absent (false) au temps fort.
async function answer(organizationId: string, eventId: string, view: HouseholdView, keyMomentId: string, attending: boolean | ((index: number) => boolean | null)) {
  const presence = view.people.flatMap((person, index) => {
    const value = typeof attending === "function" ? attending(index) : attending;
    return value === null ? [] : [{ guestId: person.id, keyMomentId, attending: value }];
  });
  await recordHouseholdAnswers(organizationId, eventId, view.id, presence, "planner");
}

// Régimes donnés avec accord (le chemin de la page de réponse est couvert par le lot 49) : la valeur
// chiffrée est écrite telle que la page l'écrit.
async function giveDiet(organizationId: string, guestId: string, optionIds: string[]) {
  await rows(organizationId, (tx) => tx.insert(diets).values({ organizationId, guestId, optionsSealed: sealDietOptions(optionIds, dietPlace(organizationId, guestId)) }));
}

const durand = { displayName: "Famille Durand", people: [{ kind: "adult" as const, firstName: "Jeanne", lastName: "Durand", email: `jeanne-${randomUUID()}@example.test` }, { kind: "adult" as const, firstName: "Paul", lastName: "Durand" }, { kind: "child" as const, firstName: "Mila", ageRange: "0-2" as const }] };
const leroy = { displayName: "Antoine Leroy", people: [{ kind: "adult" as const, firstName: "Antoine", lastName: "Leroy", email: `antoine-${randomUUID()}@example.test` }] };
const morel = { displayName: "Famille Morel", people: [{ kind: "adult" as const, firstName: "Claire", lastName: "Morel", email: `claire-${randomUUID()}@example.test` }, { kind: "child" as const, firstName: "Léo", ageRange: "6-11" as const }] };

describe("INV-05 — Plan de table : un plan par temps fort, tables en série, copie", () => {
  it("D1 : un plan par temps fort choisi ; le créer deux fois ne crée qu'un plan", async () => {
    const w = await wedding();
    const first = await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner);
    expect(await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner)).toBe(first);
    const moments = await listSeatingMoments(w.organizationId, w.eventId);
    expect(moments.map((moment) => [moment.id, moment.planId !== null])).toEqual([
      [w.moments.ceremony, false],
      [w.moments.dinner, true],
      [w.moments.brunch, false],
    ]);
    await expect(createSeatingPlan(w.organizationId, w.eventId, randomUUID())).rejects.toBeInstanceOf(SeatingNotFoundError);
  });

  it("« 12 tables rondes de 10 », puis deux de plus à la suite ; forme, capacité et nom modifiables ; bornes", async () => {
    const w = await wedding();
    const planId = await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner);
    await addSeatingTables(w.organizationId, w.eventId, planId, { count: 12, shape: "round", capacity: 10, namePrefix: "Table" });
    await addSeatingTables(w.organizationId, w.eventId, planId, { count: 2, shape: "rectangular", capacity: 8, namePrefix: "Table" });
    let plan = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
    expect(plan.tables).toHaveLength(14);
    expect(plan.tables[0]).toMatchObject({ name: "Table 1", shape: "round", capacity: 10, occupied: 0 });
    expect(plan.tables[13]).toMatchObject({ name: "Table 14", shape: "rectangular", capacity: 8 });
    await updateSeatingTable(w.organizationId, w.eventId, plan.tables[0]!.id, { name: "Honneur", shape: "head", capacity: 6 });
    plan = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
    expect(plan.tables[0]).toMatchObject({ name: "Honneur", shape: "head", capacity: 6 });
    await expect(addSeatingTables(w.organizationId, w.eventId, planId, { count: 500, shape: "round", capacity: 10, namePrefix: "Table" })).rejects.toBeInstanceOf(SeatingInvalidError);
    await expect(addSeatingTables(w.organizationId, w.eventId, planId, { count: 1, shape: "round", capacity: 0, namePrefix: "Table" })).rejects.toBeInstanceOf(SeatingInvalidError);
    await expect(updateSeatingTable(w.organizationId, w.eventId, plan.tables[1]!.id, { name: "  ", shape: "round", capacity: 10 })).rejects.toBeInstanceOf(SeatingInvalidError);
  });

  it("copie du plan du dîner vers le brunch : les tables, et les places de ceux qui n'ont pas décliné le brunch", async () => {
    const w = await wedding();
    const a = await household(w.organizationId, w.eventId, durand);
    const b = await household(w.organizationId, w.eventId, leroy);
    await answer(w.organizationId, w.eventId, a, w.moments.dinner, true);
    await answer(w.organizationId, w.eventId, b, w.moments.dinner, true);
    await answer(w.organizationId, w.eventId, a, w.moments.brunch, true);
    await answer(w.organizationId, w.eventId, b, w.moments.brunch, false);
    const planId = await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner);
    await addSeatingTables(w.organizationId, w.eventId, planId, { count: 2, shape: "round", capacity: 10, namePrefix: "Table" });
    const dinner = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
    await seatHousehold(w.organizationId, w.eventId, planId, a.id, dinner.tables[0]!.id);
    await seatHousehold(w.organizationId, w.eventId, planId, b.id, dinner.tables[1]!.id);

    expect(await copySeatingPlan(w.organizationId, w.eventId, w.moments.dinner, w.moments.brunch)).toEqual({ tables: 2, seats: 3 });
    const brunch = await getSeatingPlan(w.organizationId, w.eventId, w.moments.brunch, { kind: "owner" });
    expect(brunch.tables.map((table) => [table.name, table.occupied])).toEqual([
      ["Table 1", 3],
      ["Table 2", 0],
    ]);
    // Un plan déjà composé ne se remplace pas par une copie.
    await expect(copySeatingPlan(w.organizationId, w.eventId, w.moments.dinner, w.moments.brunch)).rejects.toMatchObject({ problem: "target_not_empty" });
    await expect(copySeatingPlan(w.organizationId, w.eventId, w.moments.dinner, w.moments.dinner)).rejects.toMatchObject({ problem: "same_moment" });
  });
});

describe("INV-05 — Qui se place, une place par invité, désistement", () => {
  it("seuls les présents et les « en attente » se placent ; ceux qui ont décliné n'apparaissent pas ; les non placés sont comptés", async () => {
    const w = await wedding();
    const a = await household(w.organizationId, w.eventId, durand);
    const b = await household(w.organizationId, w.eventId, leroy);
    await household(w.organizationId, w.eventId, morel);
    await answer(w.organizationId, w.eventId, a, w.moments.dinner, (index) => (index === 1 ? false : true));
    await answer(w.organizationId, w.eventId, b, w.moments.dinner, true);
    await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner);
    const plan = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "member" });
    const status = Object.fromEntries(plan.guests.map((guest) => [guest.name, guest.status]));
    expect(status).toEqual({ "Jeanne Durand": "present", Mila: "present", "Antoine Leroy": "present", "Claire Morel": "pending", Léo: "pending" });
    // « Non placés » compte les présents ; les « en attente » sont listés à part.
    expect(plan.unplacedCount).toBe(3);
    expect(plan.guests.find((guest) => guest.name === "Mila")).toMatchObject({ kind: "child", ageRange: "0-2", mealTypeChosen: false });
  });

  it("un invité n'est placé qu'une fois par plan : le replacer le déplace ; le retirer le remet dans « Non placés »", async () => {
    const w = await wedding();
    const a = await household(w.organizationId, w.eventId, leroy);
    await answer(w.organizationId, w.eventId, a, w.moments.dinner, true);
    const planId = await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner);
    await addSeatingTables(w.organizationId, w.eventId, planId, { count: 2, shape: "round", capacity: 10, namePrefix: "Table" });
    const { tables } = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
    const guestId = a.people[0]!.id;
    await seatGuest(w.organizationId, w.eventId, planId, guestId, tables[0]!.id);
    await seatGuest(w.organizationId, w.eventId, planId, guestId, tables[1]!.id);
    expect(await rows(w.organizationId, (tx) => tx.select().from(seatAssignments).where(eq(seatAssignments.guestId, guestId)))).toHaveLength(1);
    let plan = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
    expect(plan.guests[0]!.tableId).toBe(tables[1]!.id);
    await seatGuest(w.organizationId, w.eventId, planId, guestId, null);
    plan = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
    expect(plan.guests[0]!.tableId).toBeNull();
    expect(plan.unplacedCount).toBe(1);
    // Supprimer une table rend ses invités à « Non placés ».
    await seatGuest(w.organizationId, w.eventId, planId, guestId, tables[0]!.id);
    await removeSeatingTable(w.organizationId, w.eventId, tables[0]!.id);
    expect((await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" })).unplacedCount).toBe(1);
  });

  it("un désistement libère la place et la planner en est prévenue ; elle efface l'alerte", async () => {
    const w = await wedding();
    const a = await household(w.organizationId, w.eventId, { ...durand, people: durand.people.slice(0, 2) });
    await answer(w.organizationId, w.eventId, a, w.moments.dinner, true);
    const planId = await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner);
    await addSeatingTables(w.organizationId, w.eventId, planId, { count: 1, shape: "round", capacity: 10, namePrefix: "Table" });
    const { tables } = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
    expect(await seatHousehold(w.organizationId, w.eventId, planId, a.id, tables[0]!.id)).toBe(2);

    // Paul se désiste (noté par la planner) ; Jeanne aussi, par son lien personnel.
    await answer(w.organizationId, w.eventId, a, w.moments.dinner, (index) => (index === 1 ? false : null));
    const token = await linkFor(w.organizationId, w.eventId, a.people[0]!.id);
    const opened = await openRsvp(token, "fr");
    if (opened.outcome !== "open") throw new Error("lien refusé");
    const presence = a.people.flatMap((person) => [w.moments.ceremony, w.moments.dinner, w.moments.brunch].map((keyMomentId) => ({ guestId: person.id, keyMomentId, attending: keyMomentId !== w.moments.dinner })));
    await answerRsvp(token, { presence, consent: false, dietOptionIds: [], children: [] }, "fr");

    const plan = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
    expect(plan.tables[0]!.occupied).toBe(0);
    expect(plan.guests).toEqual([]);
    expect(plan.alerts.filter((alert) => alert.kind === "released")).toEqual([
      { kind: "released", guestId: a.people[0]!.id, guestName: "Jeanne Durand", tableName: "Table 1" },
      { kind: "released", guestId: a.people[1]!.id, guestName: "Paul Durand", tableName: "Table 1" },
    ]);
    await dismissSeatRelease(w.organizationId, w.eventId, planId, a.people[1]!.id);
    expect((await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" })).alerts.map((alert) => alert.kind)).toEqual(["released"]);
    // Un invité qui a décliné ne se place pas.
    await expect(seatGuest(w.organizationId, w.eventId, planId, a.people[1]!.id, tables[0]!.id)).rejects.toMatchObject({ problem: "not_eligible" });
  });
});

describe("INV-05 — Contraintes « ensemble » et « séparés », capacité : signalées, jamais bloquantes (D4)", () => {
  it("contrainte non tenue et capacité dépassée signalées sur la table et dans la liste des alertes ; le placement passe", async () => {
    const w = await wedding();
    const a = await household(w.organizationId, w.eventId, durand);
    const b = await household(w.organizationId, w.eventId, leroy);
    await answer(w.organizationId, w.eventId, a, w.moments.dinner, true);
    await answer(w.organizationId, w.eventId, b, w.moments.dinner, true);
    const planId = await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner);
    await addSeatingTables(w.organizationId, w.eventId, planId, { count: 2, shape: "round", capacity: 2, namePrefix: "Table" });
    const { tables } = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
    const [jeanne, paul, mila] = a.people;
    const antoine = b.people[0]!;
    const together = await addSeatingConstraint(w.organizationId, w.eventId, planId, "together", [jeanne!.id, paul!.id]);
    const apart = await addSeatingConstraint(w.organizationId, w.eventId, planId, "apart", [jeanne!.id, antoine.id]);
    await expect(addSeatingConstraint(w.organizationId, w.eventId, planId, "apart", [jeanne!.id])).rejects.toMatchObject({ problem: "constraint_members" });

    await seatGuest(w.organizationId, w.eventId, planId, jeanne!.id, tables[0]!.id);
    await seatGuest(w.organizationId, w.eventId, planId, paul!.id, tables[1]!.id);
    await seatGuest(w.organizationId, w.eventId, planId, antoine.id, tables[0]!.id);
    await seatGuest(w.organizationId, w.eventId, planId, mila!.id, tables[0]!.id);
    const plan = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
    expect(plan.alerts).toEqual([
      { kind: "together", constraintId: together, tableIds: [tables[0]!.id, tables[1]!.id], guestNames: ["Jeanne Durand", "Paul Durand"] },
      { kind: "apart", constraintId: apart, tableId: tables[0]!.id, guestNames: ["Jeanne Durand", "Antoine Leroy"] },
      { kind: "capacity", tableId: tables[0]!.id, occupied: 3, capacity: 2 },
    ]);
    expect(plan.constraints.map((constraint) => [constraint.kind, constraint.members.map((member) => member.name)])).toEqual([
      ["together", ["Jeanne Durand", "Paul Durand"]],
      ["apart", ["Jeanne Durand", "Antoine Leroy"]],
    ]);
    expect(plan.tables[0]).toMatchObject({ occupied: 3, children: 1 });
  });
});

describe("INV-06 — Types de repas de l'organisation (D5)", () => {
  it("copiés des données de départ, renommés, masqués, ajoutés ; le type d'un invité se change, sinon la valeur par défaut", async () => {
    const w = await wedding();
    const types = await listMealTypes(w.organizationId, "fr");
    expect(types.map((type) => [type.starterKey, type.label])).toEqual([
      ["adult", "Adulte"],
      ["child", "Enfant"],
      ["baby", "Bébé (sans repas)"],
      ["vendor", "Prestataire"],
    ]);
    expect((await listMealTypes(w.organizationId, "en"))[0]!.label).toBe("Adult");
    const adult = types[0]!;
    await renameMealType(w.organizationId, adult.id, "Menu adulte");
    expect((await listMealTypes(w.organizationId, "en"))[0]!.label).toBe("Menu adulte");
    await renameMealType(w.organizationId, adult.id, null);
    expect((await listMealTypes(w.organizationId, "fr"))[0]!.label).toBe("Adulte");
    const teen = await addMealType(w.organizationId, "Ado", "fr");
    await setMealTypeHidden(w.organizationId, types[2]!.id, true);
    expect((await listMealTypes(w.organizationId, "fr")).find((type) => type.starterKey === "baby")!.hidden).toBe(true);
    await expect(addMealType(w.organizationId, "x".repeat(61), "fr")).rejects.toBeInstanceOf(SeatingInvalidError);

    const m = await household(w.organizationId, w.eventId, morel);
    await answer(w.organizationId, w.eventId, m, w.moments.dinner, true);
    await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner);
    await setGuestMealType(w.organizationId, w.eventId, m.people[1]!.id, teen.id);
    const plan = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "member" });
    expect(plan.guests.map((guest) => [guest.name, guest.mealTypeLabel, guest.mealTypeChosen])).toEqual([
      ["Claire Morel", "Adulte", false],
      ["Léo", "Ado", true],
    ]);
    await setGuestMealType(w.organizationId, w.eventId, m.people[1]!.id, null);
    expect((await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "member" })).guests[1]!.mealTypeLabel).toBe("Enfant");
  });
});

// Le jeu de SC-07 : 120 personnes en 52 foyers (12 enfants, dont 3 de moins de 3 ans). Au dîner :
// 100 présents placés sur 12 tables de 10 (un présent reste sans table), 12 qui déclinent, 8 sans
// réponse ; des régimes et allergènes répartis ; 4 repas de prestataires.
async function sc07() {
  const w = await wedding();
  const options = await listDietaryOptions(w.organizationId, "fr");
  const option = (key: string) => options.find((candidate) => candidate.starterKey === key)!.id;
  const dietCycle = [[option("vegetarian")], [option("gluten_free")], [option("allergen_nuts")], [option("vegan"), option("allergen_eggs")], [], [], [], []];
  const people: { name: string; kind: "adult" | "child"; ageRange: string | null }[] = [];
  const views: HouseholdView[] = [];
  let children = 0;
  for (let index = 0; index < 52; index += 1) {
    const size = index < 16 ? 3 : 2;
    const members = Array.from({ length: size }, (_, position) => {
      const child = position === 2 && children < 12;
      if (child) children += 1;
      return child
        ? { kind: "child" as const, firstName: `Enfant${index}`, ageRange: (children <= 3 ? "0-2" : "6-11") as "0-2" | "6-11" }
        : { kind: "adult" as const, firstName: `Invité${index}-${position}`, lastName: `Famille${index}`, ...(position === 0 ? { email: `f${index}-${randomUUID().slice(0, 6)}@example.test` } : {}) };
    });
    views.push(await household(w.organizationId, w.eventId, { displayName: `Foyer ${index}`, people: members }));
  }
  const all = views.flatMap((view) => view.people);
  expect(all).toHaveLength(120);
  expect(all.filter((person) => person.kind === "child")).toHaveLength(12);
  // Ordre de la liste : les 100 premiers présents, les 12 suivants déclinent, les 8 derniers sans réponse.
  const rank = new Map(all.map((person, index) => [person.id, index]));
  for (const view of views) {
    const presence = view.people.flatMap((person) => {
      const position = rank.get(person.id)!;
      return position < 112 ? [{ guestId: person.id, keyMomentId: w.moments.dinner, attending: position < 100 }] : [];
    });
    if (presence.length > 0) await recordHouseholdAnswers(w.organizationId, w.eventId, view.id, presence, "planner");
  }
  const dietOf = new Map<string, string[]>();
  for (const [index, person] of all.entries()) {
    const chosen = dietCycle[index % dietCycle.length]!;
    if (chosen.length === 0) continue;
    dietOf.set(person.id, chosen);
    await giveDiet(w.organizationId, person.id, chosen);
  }
  const planId = await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner);
  await addSeatingTables(w.organizationId, w.eventId, planId, { count: 12, shape: "round", capacity: 10, namePrefix: "Table" });
  const { tables } = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
  const tableOf = new Map<string, string>();
  for (const person of all.slice(0, 99)) {
    const tableId = tables[Math.floor(rank.get(person.id)! / 10) % 12]!.id;
    tableOf.set(person.id, tableId);
    await seatGuest(w.organizationId, w.eventId, planId, person.id, tableId);
  }
  // Une personne en attente est placée (marquée) : elle ne compte jamais dans les couverts.
  await seatGuest(w.organizationId, w.eventId, planId, all[115]!.id, tables[11]!.id);
  await setVendorMealCount(w.organizationId, w.eventId, w.moments.dinner, 4);
  const member = await withDb((db) => createUser(db, { organizationId: w.organizationId, email: `membre-${randomUUID()}@example.test`, role: "member" }));
  return { ...w, all, rank, tables, tableOf, dietOf, options, memberId: member.id, planId };
}

describe("INV-06 — Synthèse pour le traiteur, exacte sur le jeu de SC-07", () => {
  it("totaux, par table, régimes et allergènes, prestataires et « en attente » à part ; nominative pour la titulaire", async () => {
    const s = await sc07();
    const summary = await downloadCatererSummary({ organizationId: s.organizationId, userId: s.ownerId, viewer: { kind: "owner" }, eventId: s.eventId, keyMomentId: s.moments.dinner, requested: "nominative", format: "pdf", locale: "fr", now: new Date("2027-06-03T16:00:00Z") });
    const present = s.all.filter((person) => s.rank.get(person.id)! < 100);
    const expectedMeals = (people: typeof s.all) => ({
      adult: people.filter((person) => person.kind === "adult").length,
      child: people.filter((person) => person.kind === "child" && person.ageRange !== "0-2").length,
      baby: people.filter((person) => person.ageRange === "0-2").length,
    });
    const meals = (counts: { label: string; count: number }[]) => Object.fromEntries(counts.map((count) => [count.label, count.count]));
    const want = expectedMeals(present);
    expect(summary.version).toBe("nominative");
    expect(summary.totals.covers).toBe(100);
    expect(meals(summary.totals.meals)).toEqual(Object.fromEntries(Object.entries({ Adulte: want.adult, Enfant: want.child, "Bébé (sans repas)": want.baby }).filter(([, count]) => count > 0)));
    const dietTotal = (optionId: string, people: typeof s.all) => people.filter((person) => s.dietOf.get(person.id)?.includes(optionId)).length;
    for (const count of summary.totals.diets) expect(count.count, count.label).toBe(dietTotal(count.id, present));
    expect(summary.totals.diets.map((count) => count.label)).toEqual(["Végétarien", "Végétalien (vegan)", "Sans gluten", "Œufs", "Fruits à coque"]);
    // Par table : 12 tables, puis le présent sans table.
    expect(summary.tables).toHaveLength(13);
    for (const table of summary.tables) {
      const seated = present.filter((person) => (table.id === null ? !s.tableOf.has(person.id) : s.tableOf.get(person.id) === table.id));
      expect(table.covers, table.name).toBe(seated.length);
      for (const count of table.diets) expect(count.count).toBe(dietTotal(count.id, seated));
      expect(table.people!.map((person) => person.name).sort()).toEqual(seated.map((person) => [person.firstName, person.lastName].filter(Boolean).join(" ")).sort());
    }
    expect(summary.tables.reduce((sum, table) => sum + table.covers, 0)).toBe(100);
    expect(summary.vendorMeals).toMatchObject({ count: 4, label: "Prestataire" });
    expect(summary.pending.covers).toBe(8);
    expect(summary.pending.people).toHaveLength(8);
    expect(summary.generatedAt).toBe("2027-06-03T16:00:00.000Z");
  }, 120_000);

  it("D6 : un membre reçoit la version agrégée exacte par table, sans aucun nom, même s'il demande la nominative", async () => {
    const s = await sc07();
    const summary = await downloadCatererSummary({ organizationId: s.organizationId, userId: s.memberId, viewer: { kind: "member" }, eventId: s.eventId, keyMomentId: s.moments.dinner, requested: "nominative", format: "csv", locale: "fr" });
    expect(summary.version).toBe("aggregate");
    expect(summary.tables.every((table) => table.people === null)).toBe(true);
    expect(JSON.stringify(summary)).not.toMatch(/Invité\d|Famille\d|Enfant\d/);
    // Exact : un nombre de 1 ou 2 reste un nombre (pas de « moins de 3 »).
    const small = summary.tables.flatMap((table) => table.diets).filter((count) => count.count < 3);
    expect(small.length).toBeGreaterThan(0);
    expect(summary.tables.flatMap((table) => table.diets).every((count) => Number.isInteger(count.count) && count.count > 0)).toBe(true);
  }, 120_000);

  it("D8 : rien n'est stocké ; chaque téléchargement est tracé (qui, quand, quelle version), sans contenu ni nom", async () => {
    const s = await sc07();
    const exportsBefore = await rows(s.organizationId, async (tx) => (await tx.select().from(organizationExports)).length + (await tx.select().from(privacyExports)).length);
    await downloadCatererSummary({ organizationId: s.organizationId, userId: s.ownerId, viewer: { kind: "owner" }, eventId: s.eventId, keyMomentId: s.moments.dinner, requested: "nominative", format: "pdf", locale: "fr" });
    await downloadCatererSummary({ organizationId: s.organizationId, userId: s.memberId, viewer: { kind: "member" }, eventId: s.eventId, keyMomentId: s.moments.dinner, requested: "aggregate", format: "csv", locale: "en" });
    const downloads = await rows(s.organizationId, (tx) => tx.select().from(catererSummaryDownloads).where(eq(catererSummaryDownloads.eventId, s.eventId)));
    expect(downloads.map((row) => [row.downloadedBy, row.version, row.format, row.keyMomentId]).sort()).toEqual(
      [
        [s.ownerId, "nominative", "pdf", s.moments.dinner],
        [s.memberId, "aggregate", "csv", s.moments.dinner],
      ].sort(),
    );
    const audit = await rows(s.organizationId, (tx) => tx.select().from(auditEntries).where(and(eq(auditEntries.action, "guests.caterer_summary.downloaded"), eq(auditEntries.objectId, s.eventId))));
    expect(audit).toHaveLength(2);
    expect(JSON.stringify(audit)).not.toMatch(/Invité|Famille|Végétarien|Sans gluten|gluten/i);
    const exportsAfter = await rows(s.organizationId, async (tx) => (await tx.select().from(organizationExports)).length + (await tx.select().from(privacyExports)).length);
    expect(exportsAfter).toBe(exportsBefore);
  }, 120_000);

  it("sans plan : les totaux seulement, la mention « plan de table non composé »", async () => {
    const w = await wedding();
    const a = await household(w.organizationId, w.eventId, leroy);
    await answer(w.organizationId, w.eventId, a, w.moments.brunch, true);
    const summary = await downloadCatererSummary({ organizationId: w.organizationId, userId: w.ownerId, viewer: { kind: "owner" }, eventId: w.eventId, keyMomentId: w.moments.brunch, requested: "aggregate", format: "csv", locale: "fr" });
    expect(summary).toMatchObject({ planComposed: false, tables: [], totals: { covers: 1 } });
  });
});

describe("SEC-36 — Abus et isolation du plan de table et de la synthèse", () => {
  it("l'organisation B ne lit ni ne place les invités de A ; un invité d'un autre évènement ne se place pas", async () => {
    const a = await wedding();
    const b = await wedding();
    const view = await household(a.organizationId, a.eventId, leroy);
    await answer(a.organizationId, a.eventId, view, a.moments.dinner, true);
    const planId = await createSeatingPlan(a.organizationId, a.eventId, a.moments.dinner);
    await addSeatingTables(a.organizationId, a.eventId, planId, { count: 1, shape: "round", capacity: 10, namePrefix: "Table" });
    const { tables } = await getSeatingPlan(a.organizationId, a.eventId, a.moments.dinner, { kind: "owner" });

    await expect(getSeatingPlan(b.organizationId, a.eventId, a.moments.dinner, { kind: "owner" })).rejects.toBeInstanceOf(GuestEventNotFoundError);
    await expect(seatGuest(b.organizationId, a.eventId, planId, view.people[0]!.id, tables[0]!.id)).rejects.toBeInstanceOf(GuestEventNotFoundError);
    await expect(seatGuest(b.organizationId, b.eventId, planId, view.people[0]!.id, tables[0]!.id)).rejects.toBeInstanceOf(SeatingNotFoundError);
    await expect(downloadCatererSummary({ organizationId: b.organizationId, userId: b.ownerId, viewer: { kind: "owner" }, eventId: a.eventId, keyMomentId: a.moments.dinner, requested: "nominative", format: "pdf", locale: "fr" })).rejects.toBeInstanceOf(GuestEventNotFoundError);

    // Même organisation, autre évènement : l'invité et la table de A n'entrent pas dans le plan de C.
    const otherEvent = await weddingEvent(a.organizationId, a.ownerId, "2027-09-04");
    const otherPlan = await createSeatingPlan(a.organizationId, otherEvent.eventId, otherEvent.moments.dinner);
    await expect(seatGuest(a.organizationId, otherEvent.eventId, otherPlan, view.people[0]!.id, tables[0]!.id)).rejects.toBeInstanceOf(SeatingNotFoundError);
    await expect(seatGuest(a.organizationId, a.eventId, otherPlan, view.people[0]!.id, tables[0]!.id)).rejects.toBeInstanceOf(SeatingNotFoundError);
    expect(await rows(a.organizationId, (tx) => tx.select().from(seatAssignments).where(eq(seatAssignments.planId, otherPlan)))).toEqual([]);
  });

  it("le client par son lien n'obtient ni plan ni synthèse", async () => {
    const w = await wedding();
    await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner);
    const client = { kind: "client" as const, linkId: randomUUID() };
    await expect(getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, client)).rejects.toBeInstanceOf(SeatingNotFoundError);
    await expect(downloadCatererSummary({ organizationId: w.organizationId, userId: randomUUID(), viewer: client, eventId: w.eventId, keyMomentId: w.moments.dinner, requested: "aggregate", format: "csv", locale: "fr" })).rejects.toBeInstanceOf(SeatingNotFoundError);
  });
});

describe("RGP-08 — Le plan suit la purge des invités (horloge simulée)", () => {
  it("à J+8, la synthèse ne contient plus aucun régime ; à J+30, plans, tables, places, contraintes et repas prestataires sont effacés", async () => {
    const w = await wedding();
    const a = await household(w.organizationId, w.eventId, durand);
    await answer(w.organizationId, w.eventId, a, w.moments.dinner, true);
    const options = await listDietaryOptions(w.organizationId, "fr");
    await giveDiet(w.organizationId, a.people[0]!.id, [options[0]!.id]);
    const planId = await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner);
    await addSeatingTables(w.organizationId, w.eventId, planId, { count: 1, shape: "round", capacity: 10, namePrefix: "Table" });
    const { tables } = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
    await seatHousehold(w.organizationId, w.eventId, planId, a.id, tables[0]!.id);
    await addSeatingConstraint(w.organizationId, w.eventId, planId, "apart", [a.people[0]!.id, a.people[1]!.id]);
    await setVendorMealCount(w.organizationId, w.eventId, w.moments.dinner, 3);
    const request = { organizationId: w.organizationId, userId: w.ownerId, viewer: { kind: "owner" as const }, eventId: w.eventId, keyMomentId: w.moments.dinner, requested: "nominative" as const, format: "csv" as const, locale: "fr" as const };
    expect((await downloadCatererSummary(request)).totals.diets).toHaveLength(1);

    // Dernier jour : le brunch du 13 juin. Régimes à J+7 (20 juin, 0 h, Paris) ; J+8 : aucun régime.
    await runGuestPurge(w.organizationId, new Date("2027-06-19T22:01:00Z"));
    const after = await downloadCatererSummary({ ...request, now: new Date("2027-06-21T08:00:00Z") });
    expect(after.dietsPurged).toBe(true);
    expect(after.totals.diets).toEqual([]);
    expect(after.tables.flatMap((table) => table.people ?? []).flatMap((person) => person.diets)).toEqual([]);
    expect(after.totals.covers).toBe(3);

    // J+30 (13 juillet) : tout part.
    await runGuestPurge(w.organizationId, new Date("2027-07-12T22:01:00Z"));
    for (const table of [seatingPlans, seatingTables, seatAssignments, seatingConstraints, vendorMealCounts, catererSummaryDownloads] as const) {
      expect(await rows(w.organizationId, (tx) => tx.select().from(table)), String(table)).toEqual([]);
    }
  });

  it("RGPD-03 : effacer un invité retire sa place et ses contraintes ; une contrainte réduite à une personne disparaît", async () => {
    const w = await wedding();
    const a = await household(w.organizationId, w.eventId, durand);
    await answer(w.organizationId, w.eventId, a, w.moments.dinner, true);
    const planId = await createSeatingPlan(w.organizationId, w.eventId, w.moments.dinner);
    await addSeatingTables(w.organizationId, w.eventId, planId, { count: 1, shape: "round", capacity: 10, namePrefix: "Table" });
    const { tables } = await getSeatingPlan(w.organizationId, w.eventId, w.moments.dinner, { kind: "owner" });
    await seatGuest(w.organizationId, w.eventId, planId, a.people[0]!.id, tables[0]!.id);
    await addSeatingConstraint(w.organizationId, w.eventId, planId, "apart", [a.people[0]!.id, a.people[1]!.id]);
    const found = await guestsPrivacy.find({ organizationId: w.organizationId, terms: { email: durand.people[0]!.email } });
    expect(found[0]!.fields.seating).toContain("Table 1");
    expect(JSON.stringify(found)).not.toMatch(/apart|séparés/);
    await guestsPrivacy.erase({ organizationId: w.organizationId, records: [{ kind: "guest", recordId: a.people[0]!.id }], rules: { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 120 }, today: "2027-01-01" });
    expect(await rows(w.organizationId, (tx) => tx.select().from(seatAssignments))).toEqual([]);
    expect(await rows(w.organizationId, (tx) => tx.select().from(seatingConstraints))).toEqual([]);
    expect((await listHouseholds(w.organizationId, w.eventId, { kind: "owner" }))[0]!.people).toHaveLength(2);
  });
});
