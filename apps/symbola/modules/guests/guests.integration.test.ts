// Lot 49 — module Invités contre un vrai PostgreSQL (RLS, ADR 0012), par la porte d'entrée du
// module : foyers et personnes (INV-01, RGP-18), RSVP par lien (INV-03), accord et chiffrement des
// régimes (RGP-06, RGP-07), suivi (INV-04), activation (INV-07, partie G). Tests d'abus obligatoires
// (CLAUDE.md § 2.11) : autre organisation, autre foyer, autre évènement, lien expiré, enfant.
import { randomUUID } from "node:crypto";
import { eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { diets, dietConsents, guestLinks, guests, households } from "@symbola/db/schema/guests";
import { withOrganization } from "@symbola/db/with-organization";
import { setModuleEnabled } from "@/modules/hub/service";
import {
  answerRsvp,
  getDietTallies,
  getGuestEventSummary,
  GuestEventNotFoundError,
  GuestLinkUnavailableError,
  GuestsNotReadyError,
  HouseholdInvalidError,
  issueGuestLink,
  listDietaryOptions,
  listHouseholds,
  openRsvp,
  removeHousehold,
  revokeGuestLinks,
  saveHousehold,
} from "./service";
import { household, jeanneHousehold, linkFor, openResponses, readyOrganization, weddingEvent, withDb } from "./test-fixtures";

const owner = { kind: "owner" } as const;
const member = { kind: "member" } as const;

async function setup() {
  const org = await readyOrganization();
  const event = await weddingEvent(org.organizationId, org.ownerId);
  await openResponses(org.organizationId, event.eventId);
  return { ...org, ...event };
}

// Nom de la contrainte refusée par PostgreSQL (Drizzle enveloppe l'erreur de la base).
async function violated(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    const cause = (error as { cause?: { constraint_name?: string; message?: string } }).cause;
    return cause?.constraint_name ?? cause?.message ?? String(error);
  }
  return "aucune erreur";
}

function presence(view: { members: { id: string; keyMomentIds: string[]; canAnswerPresence: boolean }[] }, attending = true) {
  return view.members.filter((person) => person.canAnswerPresence).flatMap((person) => person.keyMomentIds.map((keyMomentId) => ({ guestId: person.id, keyMomentId, attending })));
}

describe("INV-07 (partie G) — Le module ne s'emploie qu'après l'analyse d'impact", () => {
  it("sans confirmation de l'analyse d'impact, aucune saisie n'est possible", async () => {
    const org = await readyOrganization({ confirm: false });
    const { eventId } = await weddingEvent(org.organizationId, org.ownerId);
    await expect(saveHousehold(org.organizationId, eventId, null, jeanneHousehold())).rejects.toBeInstanceOf(GuestsNotReadyError);
  });
});

describe("INV-01 — Liste d'invités par foyers et personnes", () => {
  it("un foyer s'enregistre avec un nom et un moyen de contact ; refusé sans", async () => {
    const { organizationId, eventId } = await setup();
    const created = await household(organizationId, eventId, jeanneHousehold());
    expect(created.people.map((person) => person.firstName)).toEqual(["Jeanne", "Paul"]);
    expect(created.respondentGuestId).toBe(created.people[0]!.id);
    await expect(saveHousehold(organizationId, eventId, null, { people: [{ kind: "adult", firstName: "Sans", lastName: "Contact" }] })).rejects.toMatchObject({ problem: "contact_missing" });
  });

  it("côté (un client de l'évènement ou les deux), groupe créé à la volée, temps forts restreints", async () => {
    const { organizationId, eventId, moments } = await setup();
    const created = await household(organizationId, eventId, { ...jeanneHousehold(), side: { kind: "both" }, groupLabel: "Amis du lycée", keyMomentIds: [moments.brunch] });
    expect(created.side).toEqual({ kind: "both" });
    expect(created.groupLabel).toBe("Amis du lycée");
    expect(created.keyMomentIds).toEqual([moments.brunch]);
    const again = await household(organizationId, eventId, { ...jeanneHousehold("autre@example.test"), groupLabel: "amis du lycée" });
    expect(again.groupId).toBe(created.groupId);
    await expect(saveHousehold(organizationId, eventId, null, { ...jeanneHousehold(), side: { kind: "client", clientId: randomUUID() } })).rejects.toMatchObject({ problem: "side_unknown" });
    await expect(saveHousehold(organizationId, eventId, null, { ...jeanneHousehold(), keyMomentIds: [randomUUID()] })).rejects.toMatchObject({ problem: "key_moment_unknown" });
  });
});

describe("RGP-18 — Aucun contact direct collecté pour un enfant", () => {
  it("un enfant avec e-mail ou téléphone est refusé par le service et par la base même (requête directe)", async () => {
    const { organizationId, eventId } = await setup();
    await expect(saveHousehold(organizationId, eventId, null, { people: [...jeanneHousehold().people, { kind: "child", firstName: "Léo", email: "leo@example.test" }] })).rejects.toBeInstanceOf(HouseholdInvalidError);
    const created = await household(organizationId, eventId, { people: [...jeanneHousehold().people, { kind: "child", firstName: "Léo", ageRange: "3-5" }] });
    const child = created.people.find((person) => person.kind === "child")!;
    expect(await violated(withDb((db) => withOrganization(db, organizationId, (tx) => tx.update(guests).set({ phone: "0611111111" }).where(eq(guests.id, child.id)))))).toBe("guests_child_no_contact_check");
    expect(await violated(withDb((db) => withOrganization(db, organizationId, (tx) => tx.update(guests).set({ email: "leo@example.test" }).where(eq(guests.id, child.id)))))).toBe("guests_child_no_contact_check");
  });

  it("aucun lien ne se crée pour un enfant, ni par le service ni par la base", async () => {
    const { organizationId, eventId } = await setup();
    const created = await household(organizationId, eventId, { people: [...jeanneHousehold().people, { kind: "child", firstName: "Léo" }] });
    const child = created.people.find((person) => person.kind === "child")!;
    await expect(issueGuestLink(organizationId, eventId, child.id)).rejects.toMatchObject({ reason: "child" });
    expect(await violated(withDb((db) => withOrganization(db, organizationId, (tx) => tx.insert(guestLinks).values({ organizationId, eventId, guestId: child.id, guestKind: "adult", tokenHash: "a".repeat(64) }))))).toBe("guest_links_adult_fk");
    expect(await violated(withDb((db) => withOrganization(db, organizationId, (tx) => tx.insert(guestLinks).values({ organizationId, eventId, guestId: child.id, guestKind: "child", tokenHash: "b".repeat(64) }))))).toBe("guest_links_adult_check");
  });

  it("un adulte sans moyen de contact n'a pas de lien (D3)", async () => {
    const { organizationId, eventId } = await setup();
    const created = await household(organizationId, eventId, jeanneHousehold());
    await expect(issueGuestLink(organizationId, eventId, created.people[1]!.id)).rejects.toMatchObject({ reason: "no_contact" });
  });
});

describe("INV-03 — RSVP en ligne par lien personnel, sans compte", () => {
  it("le lien ouvre la réponse du foyer ; le répondant répond pour tous ; le récapitulatif suit", async () => {
    const { organizationId, eventId, moments } = await setup();
    const created = await household(organizationId, eventId, jeanneHousehold());
    const token = await linkFor(organizationId, eventId, created.people[0]!.id);
    const opened = await openRsvp(token, "fr");
    expect(opened.outcome).toBe("open");
    if (opened.outcome === "invalid") return;
    expect(opened.view.isRespondent).toBe(true);
    expect(opened.view.keyMoments.map((moment) => moment.id)).toEqual([moments.ceremony, moments.dinner, moments.brunch]);
    expect(opened.view.clientNames).toBe("Léa & Hugo");
    const saved = await answerRsvp(token, { presence: presence(opened.view), consent: false, dietOptionIds: [], children: [] }, "fr");
    expect(saved.outcome).toBe("saved");
    if (saved.outcome !== "saved") return;
    expect(saved.view.answeredAt).not.toBeNull();
    expect(saved.view.members.every((person) => Object.values(person.answers).every(Boolean))).toBe(true);
    const summary = await getGuestEventSummary(organizationId, eventId);
    expect(summary).toMatchObject({ households: 1, people: 2, answered: 1, confirmed: 2 });
    expect(summary.tallies.find((tally) => tally.keyMomentId === moments.dinner)).toMatchObject({ yes: 2, no: 0, pending: 0 });
  });

  it("un autre adulte du foyer ne répond que pour lui-même", async () => {
    const { organizationId, eventId } = await setup();
    const created = await household(organizationId, eventId, { people: [{ kind: "adult", firstName: "Jeanne", phone: "0612345678" }, { kind: "adult", firstName: "Paul", email: "paul@example.test" }] });
    const paul = created.people[1]!;
    const token = await linkFor(organizationId, eventId, paul.id);
    const opened = await openRsvp(token, "fr");
    if (opened.outcome === "invalid") throw new Error("lien refusé");
    const all = opened.view.members.flatMap((person) => person.keyMomentIds.map((keyMomentId) => ({ guestId: person.id, keyMomentId, attending: false })));
    await answerRsvp(token, { presence: all, consent: false, dietOptionIds: [], children: [] }, "fr");
    const [after] = await listHouseholds(organizationId, eventId, owner);
    expect(after!.people.find((person) => person.id === paul.id)!.answers).toHaveLength(3);
    expect(after!.people.find((person) => person.id !== paul.id)!.answers).toHaveLength(0);
    expect(after!.answeredAt).toBeNull();
  });

  it("le lien d'un foyer ne lit ni n'écrit un autre foyer du même évènement", async () => {
    const { organizationId, eventId, moments } = await setup();
    const first = await household(organizationId, eventId, jeanneHousehold());
    const second = await household(organizationId, eventId, { people: [{ kind: "adult", firstName: "Antoine", email: "antoine@example.test" }] });
    const token = await linkFor(organizationId, eventId, first.people[0]!.id);
    const opened = await openRsvp(token, "fr");
    if (opened.outcome === "invalid") throw new Error("lien refusé");
    expect(opened.view.members.map((person) => person.id)).not.toContain(second.people[0]!.id);
    await answerRsvp(token, { presence: [{ guestId: second.people[0]!.id, keyMomentId: moments.dinner, attending: false }], consent: false, dietOptionIds: [], children: [] }, "fr");
    const antoine = (await listHouseholds(organizationId, eventId, owner)).find((candidate) => candidate.id === second.id)!;
    expect(antoine.people[0]!.answers).toEqual([]);
  });

  it("lien d'une autre organisation, altéré, retiré : « lien inconnu » ; module fermé : aussi", async () => {
    const { organizationId, eventId } = await setup();
    const created = await household(organizationId, eventId, jeanneHousehold());
    const token = await linkFor(organizationId, eventId, created.people[0]!.id);
    const other = await readyOrganization();
    const [, secret] = token.split(".");
    expect((await openRsvp(`${other.organizationId}.${secret}`, "fr")).outcome).toBe("invalid");
    expect((await openRsvp(`${token.slice(0, -2)}xx`, "fr")).outcome).toBe("invalid");
    expect((await openRsvp("n'importe quoi", "fr")).outcome).toBe("invalid");
    await withDb((db) => setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey: "guests", enabled: false }));
    expect((await openRsvp(token, "fr")).outcome).toBe("invalid");
    await withDb((db) => setModuleEnabled(db, { adminUserId: randomUUID(), organizationId, moduleKey: "guests", enabled: true }));
    expect((await openRsvp(token, "fr")).outcome).toBe("open");
    await revokeGuestLinks(organizationId, eventId, created.people[0]!.id);
    expect((await openRsvp(token, "fr")).outcome).toBe("invalid");
  });

  it("après la clôture (lendemain à Paris), la page passe en lecture avec le contact de la planner ; plus aucune réponse", async () => {
    const { organizationId, eventId } = await setup();
    const created = await household(organizationId, eventId, jeanneHousehold());
    const token = await linkFor(organizationId, eventId, created.people[0]!.id);
    // Clôture le 13 mai 2027 : ouvert jusqu'à 23 h 59 à Paris (21 h 59 UTC, heure d'été).
    expect((await openRsvp(token, "fr", new Date("2027-05-13T21:59:00Z"))).outcome).toBe("open");
    const closed = await openRsvp(token, "fr", new Date("2027-05-13T22:01:00Z"));
    expect(closed.outcome).toBe("closed");
    if (closed.outcome === "invalid") return;
    expect(closed.view.questions).toEqual({ diet: false, accommodation: false, transport: false });
    expect(closed.view.contact.name).not.toBe("");
    expect((await answerRsvp(token, { presence: [], consent: false, dietOptionIds: [], children: [] }, "fr", new Date("2027-05-14T08:00:00Z"))).outcome).toBe("closed");
    await expect(issueGuestLink(organizationId, eventId, created.people[0]!.id, new Date("2027-05-14T08:00:00Z"))).rejects.toMatchObject({ reason: "closed" });
  });

  it("sans clôture réglée, pas de lien (D13)", async () => {
    const org = await readyOrganization();
    const { eventId } = await weddingEvent(org.organizationId, org.ownerId);
    const created = await household(org.organizationId, eventId, jeanneHousehold());
    await expect(issueGuestLink(org.organizationId, eventId, created.people[0]!.id)).rejects.toBeInstanceOf(GuestLinkUnavailableError);
  });
});

describe("RGP-06 — Régimes et allergies : liste fermée, accord non précoché, preuve", () => {
  async function respondent() {
    const context = await setup();
    const created = await household(context.organizationId, context.eventId, { people: [{ kind: "adult", firstName: "Jeanne", phone: "0612345678" }, { kind: "adult", firstName: "Paul", email: "paul@example.test" }, { kind: "child", firstName: "Léo", ageRange: "6-11" }] });
    const token = await linkFor(context.organizationId, context.eventId, created.people[0]!.id);
    const options = await listDietaryOptions(context.organizationId, "fr");
    const vegetarian = options.find((option) => option.starterKey === "vegetarian")!.id;
    const peanuts = options.find((option) => option.starterKey === "allergen_peanuts")!.id;
    return { ...context, created, token, vegetarian, peanuts };
  }

  it("la liste de départ n'a aucun régime à caractère religieux (D6) et compte les quatorze allergènes", async () => {
    const { organizationId } = await readyOrganization();
    const options = await listDietaryOptions(organizationId, "fr");
    expect(options.filter((option) => option.kind === "allergen")).toHaveLength(14);
    expect(options.map((option) => option.label.toLowerCase()).join(" ")).not.toMatch(/halal|casher|kasher|porc/);
  });

  it("sans accord, une requête qui contient des régimes n'enregistre rien", async () => {
    const { organizationId, created, token, vegetarian } = await respondent();
    await answerRsvp(token, { presence: [], consent: false, dietOptionIds: [vegetarian], children: [{ guestId: created.people[2]!.id, guardianDeclared: true, dietOptionIds: [vegetarian] }] }, "fr");
    const stored = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select().from(diets)));
    expect(stored).toEqual([]);
    const proofs = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select().from(dietConsents)));
    expect(proofs).toEqual([]);
  });

  it("accord puis retrait : régimes effacés aussitôt, preuve gardée (horodatage, version, canal, retrait)", async () => {
    const { organizationId, created, token, vegetarian, peanuts } = await respondent();
    const saved = await answerRsvp(token, { presence: [], consent: true, dietOptionIds: [vegetarian, peanuts], children: [] }, "fr");
    if (saved.outcome !== "saved") throw new Error("réponse refusée");
    expect(saved.view.consented).toBe(true);
    expect(saved.view.members.find((person) => person.isSelf)!.diet?.sort()).toEqual([vegetarian, peanuts].sort());
    await answerRsvp(token, { presence: [], consent: false, dietOptionIds: [vegetarian], children: [] }, "fr");
    const stored = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select().from(diets).where(eq(diets.guestId, created.people[0]!.id))));
    expect(stored).toEqual([]);
    const [proof] = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select().from(dietConsents).where(eq(dietConsents.guestId, created.people[0]!.id))));
    expect(proof).toMatchObject({ channel: "personal_link", legalGuardian: false, givenByGuestId: created.people[0]!.id });
    expect(proof!.textVersion).toMatch(/^\d{4}-\d{2}-\d{2}/);
    expect(proof!.grantedAt).toBeInstanceOf(Date);
    expect(proof!.withdrawnAt).toBeInstanceOf(Date);
  });

  it("un adulte ne donne pas le régime d'un autre adulte ; celui d'un enfant seulement avec la déclaration de représentant légal", async () => {
    const { organizationId, created, token, vegetarian } = await respondent();
    const [jeanne, paul, leo] = created.people;
    await answerRsvp(token, { presence: [], consent: true, dietOptionIds: [], children: [{ guestId: paul!.id, guardianDeclared: true, dietOptionIds: [vegetarian] }, { guestId: leo!.id, guardianDeclared: false, dietOptionIds: [vegetarian] }] }, "fr");
    let stored = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select().from(diets)));
    expect(stored).toEqual([]);
    await answerRsvp(token, { presence: [], consent: true, dietOptionIds: [], children: [{ guestId: leo!.id, guardianDeclared: true, dietOptionIds: [vegetarian] }] }, "fr");
    stored = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select().from(diets)));
    expect(stored.map((row) => row.guestId)).toEqual([leo!.id]);
    const [proof] = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.select().from(dietConsents).where(eq(dietConsents.guestId, leo!.id))));
    expect(proof).toMatchObject({ legalGuardian: true, givenByGuestId: jeanne!.id });
  });
});

describe("RGP-07 — Accès limité aux régimes ; chiffrement au niveau du champ (DAT-08)", () => {
  it("la valeur en base est chiffrée : une lecture brute ne montre aucun identifiant de régime", async () => {
    const { organizationId, eventId } = await setup();
    const created = await household(organizationId, eventId, jeanneHousehold());
    const token = await linkFor(organizationId, eventId, created.people[0]!.id);
    const vegetarian = (await listDietaryOptions(organizationId, "fr")).find((option) => option.starterKey === "vegetarian")!.id;
    await answerRsvp(token, { presence: [], consent: true, dietOptionIds: [vegetarian], children: [] }, "fr");
    const [raw] = await withDb((db) => withOrganization(db, organizationId, (tx) => tx.execute(sql`select options_sealed from guests.diets`)));
    const value = (raw as { options_sealed: string }).options_sealed;
    expect(value.startsWith("f1:")).toBe(true);
    expect(value).not.toContain(vegetarian);
  });

  it("la titulaire voit les régimes nominatifs ; un membre et le client, jamais (même en appelant le service)", async () => {
    const { organizationId, eventId } = await setup();
    const created = await household(organizationId, eventId, jeanneHousehold());
    const token = await linkFor(organizationId, eventId, created.people[0]!.id);
    const vegetarian = (await listDietaryOptions(organizationId, "fr")).find((option) => option.starterKey === "vegetarian")!.id;
    await answerRsvp(token, { presence: [], consent: true, dietOptionIds: [vegetarian], children: [] }, "fr");
    expect((await listHouseholds(organizationId, eventId, owner))[0]!.people[0]!.diet).toEqual(["Végétarien"]);
    expect((await listHouseholds(organizationId, eventId, member))[0]!.people[0]!.diet).toBeNull();
    expect((await listHouseholds(organizationId, eventId, { kind: "client", linkId: randomUUID() }))[0]!.people[0]!.diet).toBeNull();
  });

  it("par temps fort, des nombres ; un régime porté par une ou deux personnes s'affiche « moins de 3 »", async () => {
    const { organizationId, eventId, moments } = await setup();
    const vegetarian = (await listDietaryOptions(organizationId, "fr")).find((option) => option.starterKey === "vegetarian")!.id;
    const gluten = (await listDietaryOptions(organizationId, "fr")).find((option) => option.starterKey === "gluten_free")!.id;
    for (const [index, options] of [[vegetarian, gluten], [vegetarian], [vegetarian]].entries()) {
      const created = await household(organizationId, eventId, { people: [{ kind: "adult", firstName: `Invité ${index}`, email: `invite-${index}-${randomUUID()}@example.test` }] });
      const token = await linkFor(organizationId, eventId, created.people[0]!.id);
      const opened = await openRsvp(token, "fr");
      if (opened.outcome === "invalid") throw new Error("lien refusé");
      await answerRsvp(token, { presence: presence(opened.view), consent: true, dietOptionIds: options, children: [] }, "fr");
    }
    const dinner = (await getDietTallies(organizationId, eventId)).find((tally) => tally.keyMomentId === moments.dinner)!;
    expect(dinner.counts).toEqual([
      { optionId: vegetarian, label: "Végétarien", kind: "diet", count: 3, fewerThan: null },
      { optionId: gluten, label: "Sans gluten", kind: "diet", count: null, fewerThan: 3 },
    ]);
    expect(JSON.stringify(dinner)).not.toMatch(/Invité/);
  });
});

describe("Isolation entre organisations (SEC-10, ARC-08) et abus", () => {
  it("l'organisation A ne lit ni ne modifie les foyers, réponses, régimes et liens de B", async () => {
    const a = await setup();
    const b = await setup();
    const created = await household(b.organizationId, b.eventId, jeanneHousehold());
    const token = await linkFor(b.organizationId, b.eventId, created.people[0]!.id);
    const vegetarian = (await listDietaryOptions(b.organizationId, "fr")).find((option) => option.starterKey === "vegetarian")!.id;
    await answerRsvp(token, { presence: [], consent: true, dietOptionIds: [vegetarian], children: [] }, "fr");
    await expect(listHouseholds(a.organizationId, b.eventId, owner)).rejects.toBeInstanceOf(GuestEventNotFoundError);
    await expect(saveHousehold(a.organizationId, b.eventId, created.id, jeanneHousehold())).rejects.toBeInstanceOf(GuestEventNotFoundError);
    await expect(removeHousehold(a.organizationId, a.eventId, created.id)).rejects.toThrow();
    await expect(issueGuestLink(a.organizationId, a.eventId, created.people[0]!.id)).rejects.toThrow();
    for (const table of [households, guests, diets, dietConsents, guestLinks]) {
      const rows = await withDb((db) => withOrganization(db, a.organizationId, (tx) => tx.select().from(table)));
      expect(rows.filter((row) => (row as { organizationId: string }).organizationId === b.organizationId)).toEqual([]);
    }
    const rows = await withDb((db) => withOrganization(db, a.organizationId, (tx) => tx.update(households).set({ displayName: "Volé" }).where(eq(households.id, created.id)).returning()));
    expect(rows).toEqual([]);
    await expect(withDb((db) => withOrganization(db, a.organizationId, (tx) => tx.insert(households).values({ organizationId: b.organizationId, eventId: b.eventId, displayName: "Intrus" })))).rejects.toThrow();
  });

  it("le client au portail ne voit que les invités de son évènement (même organisation)", async () => {
    const context = await setup();
    const second = await weddingEvent(context.organizationId, context.ownerId, "2027-09-04");
    await household(context.organizationId, second.eventId, { people: [{ kind: "adult", firstName: "Ailleurs", email: "ailleurs@example.test" }] });
    await household(context.organizationId, context.eventId, jeanneHousehold());
    const mine = await listHouseholds(context.organizationId, context.eventId, { kind: "client", linkId: randomUUID() });
    expect(mine.map((candidate) => candidate.displayName)).toEqual(["Jeanne et Paul Durand"]);
  });

  it("un évènement d'essai n'accepte pas d'invités", async () => {
    const { organizationId } = await readyOrganization();
    await expect(listHouseholds(organizationId, randomUUID(), owner)).rejects.toBeInstanceOf(GuestEventNotFoundError);
  });
});
