// Lot 36a (CRM-03, DAT-12, UX-02, ARC-03 ; D3 à D9 ; ADR 0069) — le contact unique, contre de vrais
// modules (PostgreSQL réel) : une adresse e-mail n'appartient qu'à un contact ; un couple revient
// pour un second évènement sans être ressaisi ; ses coordonnées se modifient une fois, partout ;
// les évènements se retrouvent par le nom de leurs clients ; les notes ; l'isolation ; la purge
// d'un contact sans évènement (horloge simulée) ; un essai emporte ses contacts.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { addMonths, parisDate } from "@symbola/privacy";
import { endTrial } from "@/lib/demo-purge";
import { listPurgeCandidates } from "@/lib/privacy/purge";
import {
  ClientEmailTakenError,
  createProspect,
  createProspectSource,
  getEvent,
  listEvents,
  listEventsOfContact,
  startEventsTrial,
  updateEventClientContact,
} from "@/modules/events/service";
import { globalSearch } from "./search";
import {
  addContactNote,
  ContactEmailTakenError,
  ContactNoteNotFoundError,
  ContactNotFoundError,
  createContact,
  getContact,
  listContactNotes,
  listContacts,
  removeContactNote,
  resolveContact,
  updateContact,
} from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function createPlanner() {
  const organization = await createOrganization(db, `Atelier ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `camille-${randomUUID()}@symbola.test`, password: "mot-de-passe-contacts", role: "owner" });
  const source = await createProspectSource(organization.id, "Salon");
  return { organizationId: organization.id, userId: user.id, sourceId: source.id };
}

type Planner = Awaited<ReturnType<typeof createPlanner>>;

function wedding(planner: Planner, clients: Parameters<typeof createProspect>[0]["clients"], eventDate = "2027-06-12") {
  return createProspect({ organizationId: planner.organizationId, createdByUserId: planner.userId, prospectSourceId: planner.sourceId, clients, eventDate });
}

describe("DAT-12 — Un contact par adresse e-mail et par organisation", () => {
  it("une adresse déjà connue (casse et espaces mis à part) est refusée sur un autre contact, et reprend le contact qui la porte", async () => {
    const planner = await createPlanner();
    const email = `lea-${randomUUID()}@exemple.test`;
    const lea = await createContact(planner.organizationId, { firstName: "Léa", lastName: "Martin", email });
    expect(lea.email).toBe(email);
    await expect(createContact(planner.organizationId, { firstName: "Autre", email: `  ${email.toUpperCase()} ` })).rejects.toBeInstanceOf(ContactEmailTakenError);
    expect((await resolveContact(planner.organizationId, { firstName: "Léa", email: email.toUpperCase() })).id).toBe(lea.id);
    const hugo = await createContact(planner.organizationId, { firstName: "Hugo" });
    await expect(updateContact(planner.organizationId, hugo.id, { email })).rejects.toBeInstanceOf(ContactEmailTakenError);
    // Sans adresse, autant de contacts qu'il faut.
    await createContact(planner.organizationId, { firstName: "Hugo" });
  });
});

describe("CRM-03 / UX-02 — Le contact unique, sans ressaisie", () => {
  it("un couple qui revient pour un second évènement n'est pas ressaisi : le même contact, ses coordonnées modifiées une fois, partout", async () => {
    const planner = await createPlanner();
    const lastName = `Martin${randomUUID().slice(0, 6)}`;
    const first = await wedding(planner, [{ firstName: "Léa", lastName }]);
    const lea = (await getEvent(planner.organizationId, first.id))!.clients[0]!;
    expect(lea.contactId).not.toBeNull();
    const second = await wedding(planner, [{ contactId: lea.contactId, firstName: "Léa" }], "2028-05-20");
    expect((await getEvent(planner.organizationId, second.id))!.clients[0]!.contactId).toBe(lea.contactId);

    // Les coordonnées modifiées depuis le premier évènement sont celles du contact, donc du second.
    await updateEventClientContact({ organizationId: planner.organizationId, eventId: first.id, clientId: lea.id, contact: { email: `lea-${randomUUID()}@exemple.test`, phone: "06 12 34 56 78" } });
    expect((await getEvent(planner.organizationId, second.id))!.clients[0]!).toMatchObject({ phone: "06 12 34 56 78" });
    expect((await getContact(planner.organizationId, lea.contactId!))!.phone).toBe("06 12 34 56 78");
    // Une adresse prise par un autre contact est refusée (DAT-12).
    const other = await createContact(planner.organizationId, { firstName: "Inès", email: `ines-${randomUUID()}@exemple.test` });
    await expect(
      updateEventClientContact({ organizationId: planner.organizationId, eventId: first.id, clientId: lea.id, contact: { email: other.email } }),
    ).rejects.toBeInstanceOf(ClientEmailTakenError);

    // La fiche du contact : ses deux évènements.
    expect((await listEventsOfContact(planner.organizationId, lea.contactId!)).map((event) => event.id).sort()).toEqual([first.id, second.id].sort());
    expect((await listContacts(planner.organizationId, { search: lastName })).contacts.map((contact) => contact.id)).toEqual([lea.contactId]);
  });

  it("une adresse e-mail saisie à la création d'un évènement reprend le contact qui la porte", async () => {
    const planner = await createPlanner();
    const email = `hugo-${randomUUID()}@exemple.test`;
    const hugo = await createContact(planner.organizationId, { firstName: "Hugo", lastName: "Durand", email });
    const event = await wedding(planner, [{ firstName: "Hugo", lastName: "Durand", email: email.toUpperCase() }]);
    expect((await getEvent(planner.organizationId, event.id))!.clients[0]!.contactId).toBe(hugo.id);
  });

  it("les évènements se retrouvent par le nom de leurs clients, accents et casse mis à part ; la recherche globale aussi", async () => {
    const planner = await createPlanner();
    const lastName = `Écho${randomUUID().slice(0, 6)}`;
    const event = await wedding(planner, [{ firstName: "Chloé", lastName }]);
    expect((await listEvents({ organizationId: planner.organizationId, search: lastName })).map((found) => found.id)).toEqual([event.id]);
    const found = await globalSearch({ organizationId: planner.organizationId, term: `chloe ${lastName.replace("É", "e").toLowerCase()}`, modules: { events: true, quotes: false } });
    expect(found.events.map((row) => [row.id, row.names])).toEqual([[event.id, "Chloé"]]);
  });

  it("les notes de la fiche : datées, avec leur auteur ; seul l'auteur retire la sienne", async () => {
    const planner = await createPlanner();
    const contact = await createContact(planner.organizationId, { firstName: "Léa" });
    const note = await addContactNote(planner.organizationId, { contactId: contact.id, authorUserId: planner.userId, body: "Préfère être appelée le soir" });
    expect((await listContactNotes(planner.organizationId, contact.id)).map((item) => item.body)).toEqual(["Préfère être appelée le soir"]);
    await expect(removeContactNote(planner.organizationId, { noteId: note.id, authorUserId: randomUUID() })).rejects.toBeInstanceOf(ContactNoteNotFoundError);
    await removeContactNote(planner.organizationId, { noteId: note.id, authorUserId: planner.userId });
    expect(await listContactNotes(planner.organizationId, contact.id)).toEqual([]);
  });
});

describe("SEC-10 / SEC-13 — Isolation des contacts", () => {
  it("un contact d'une autre organisation n'est ni lu, ni modifié, ni choisi comme client, ni annoté", async () => {
    const plannerA = await createPlanner();
    const plannerB = await createPlanner();
    const contactB = await createContact(plannerB.organizationId, { firstName: "Secret", lastName: "B" });
    expect(await getContact(plannerA.organizationId, contactB.id)).toBeNull();
    await expect(updateContact(plannerA.organizationId, contactB.id, { phone: "falsifié" })).rejects.toBeInstanceOf(ContactNotFoundError);
    await expect(wedding(plannerA, [{ contactId: contactB.id, firstName: "Secret" }])).rejects.toBeInstanceOf(ContactNotFoundError);
    await expect(addContactNote(plannerA.organizationId, { contactId: contactB.id, authorUserId: plannerA.userId, body: "Note" })).rejects.toBeInstanceOf(ContactNotFoundError);
    expect((await listContacts(plannerA.organizationId, { search: "Secret" })).contacts).toEqual([]);
    expect((await getContact(plannerB.organizationId, contactB.id))!.phone).toBeNull();
  });
});

describe("RGPD-05 (D9) — Un contact sans évènement suit la règle des prospects", () => {
  it("il est proposé à la purge trois ans après sa dernière modification (la veille, non ; le jour même, oui) ; un client d'un évènement suit la règle de son évènement", async () => {
    const planner = await createPlanner();
    const alone = await createContact(planner.organizationId, { firstName: "Isolé", lastName: randomUUID().slice(0, 6) });
    const withEvent = await wedding(planner, [{ firstName: "Client", lastName: randomUUID().slice(0, 6) }]);
    const clientContact = (await getEvent(planner.organizationId, withEvent.id))!.clients[0]!.contactId!;
    const due = addMonths(parisDate(alone.updatedAt), 36);
    const keys = async (day: string) => (await listPurgeCandidates(planner.organizationId, day)).map((candidate) => candidate.key);
    const dayBefore = parisDate(new Date(new Date(`${due}T12:00:00Z`).getTime() - 86_400_000));
    expect(await keys(dayBefore)).not.toContain(`contact:${alone.id}`);
    expect(await keys(due)).toContain(`contact:${alone.id}`);
    expect(await keys(due)).not.toContain(`contact:${clientContact}`);
  });
});

describe("AIDE-02 — Un essai guidé emporte ses contacts d'essai", () => {
  it("les clients fictifs sont des contacts d'essai, hors de la liste, supprimés à la fin de l'essai", async () => {
    const planner = await createPlanner();
    const trial = await startEventsTrial({ organizationId: planner.organizationId, userId: planner.userId, locale: "fr" });
    const contactIds = (await getEvent(planner.organizationId, trial.eventId))!.clients.map((client) => client.contactId!);
    expect(contactIds.length).toBeGreaterThan(0);
    for (const id of contactIds) expect((await getContact(planner.organizationId, id))!.isDemo).toBe(true);
    expect((await listContacts(planner.organizationId)).contacts).toEqual([]);
    await endTrial(planner.organizationId, trial.eventId);
    for (const id of contactIds) expect(await getContact(planner.organizationId, id)).toBeNull();
  });
});
