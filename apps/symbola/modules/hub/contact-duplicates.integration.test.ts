// Lot 45 (CRM-07 ; D4, D5 ; ADR 0090) — doublons de contacts et fusion, contre un vrai PostgreSQL
// (RLS) : détection à la saisie par e-mail et téléphone normalisés, paire écartée, fusion champ par
// champ qui garde tout l'historique (évènements, notes, messages, rendez-vous, liens, signatures),
// événement hub.contact.merged repointé par chaque module de façon idempotente, jamais de fusion avec
// une fiche fictive, isolation entre organisations (SEC-36).
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { domainEvents } from "@symbola/db/schema/core";
import { appointments } from "@symbola/db/schema/appointments";
import { withOrganization } from "@symbola/db/with-organization";
import { HUB_CONTACT_MERGED } from "@symbola/contracts";
import { CONSUMERS, runEventWorkerOnce } from "@/lib/event-worker";
import { countEventsContactReferences, createProspect, createProspectSource, getEvent, listContactMessages, prospectMessageContext, repointMergedContact, sendProspectMessage } from "@/modules/events/service";
import { countContactAppointments } from "@/modules/appointments/service";
import {
  addContactNote,
  ContactMergeRefusedError,
  countDuplicatePairs,
  createContact,
  detectAllDuplicates,
  dismissDuplicatePair,
  DuplicatePairNotFoundError,
  getContact,
  getContactsByIds,
  listContactMerges,
  listContactNotes,
  listDuplicatePairs,
  mergeContacts,
  updateContact,
} from "./service";

const plannerId = randomUUID();

async function organization(): Promise<string> {
  const { sql, db } = createAppConnection();
  try {
    return (await createOrganization(db, `Atelier ${randomUUID()}`)).id;
  } finally {
    await sql.end();
  }
}

// Le worker des tests ne fait tourner que les consommateurs de la fusion (pas de course avec les autres).
const MERGE_CONSUMERS = Object.fromEntries(
  Object.entries(CONSUMERS)
    .filter(([, handlers]) => HUB_CONTACT_MERGED in handlers)
    .map(([name, handlers]) => [name, { [HUB_CONTACT_MERGED]: handlers[HUB_CONTACT_MERGED]! }]),
);

describe("CRM-07 — Détection des doublons sur e-mail et téléphone", () => {
  it("à la saisie, deux fiches au même téléphone (écrit autrement) deviennent une paire possible ; jamais fusionnées seules", async () => {
    const organizationId = await organization();
    const first = await createContact(organizationId, { firstName: "Léa", lastName: "Martin", phone: "06 12 34 56 78" });
    const second = await createContact(organizationId, { firstName: "Lea", lastName: "Martin", phone: "+33 6 12 34 56 78" });
    const pairs = await listDuplicatePairs(organizationId);
    expect(pairs).toHaveLength(1);
    expect(pairs[0]).toMatchObject({ reason: "phone" });
    expect(new Set([pairs[0]!.first.id, pairs[0]!.second.id])).toEqual(new Set([first.id, second.id]));
    // Les deux fiches existent toujours : rien n'est fusionné sans la planner.
    expect(await getContact(organizationId, first.id)).not.toBeNull();
    expect(await getContact(organizationId, second.id)).not.toBeNull();
  });

  it("une modification qui rapproche deux fiches les apparie ; la recherche de nuit est rejouable", async () => {
    const organizationId = await organization();
    await createContact(organizationId, { firstName: "Hugo", phone: "0611111111" });
    const other = await createContact(organizationId, { firstName: "Hugo B.", phone: "0622222222" });
    expect(await countDuplicatePairs(organizationId)).toBe(0);
    await updateContact(organizationId, other.id, { phone: "+33611111111" });
    expect(await countDuplicatePairs(organizationId)).toBe(1);
    expect(await detectAllDuplicates(organizationId)).toBe(0);
  });

  it("« ce ne sont pas les mêmes » écarte la paire pour toujours", async () => {
    const organizationId = await organization();
    await createContact(organizationId, { firstName: "Inès", phone: "0633333333" });
    await createContact(organizationId, { firstName: "Inès P.", phone: "0633333333" });
    const [pair] = await listDuplicatePairs(organizationId);
    await dismissDuplicatePair(organizationId, pair!.id, plannerId);
    expect(await listDuplicatePairs(organizationId)).toEqual([]);
    expect(await detectAllDuplicates(organizationId)).toBe(0);
    expect(await listDuplicatePairs(organizationId)).toEqual([]);
  });

  it("une fiche fictive (essai guidé) n'est jamais appariée", async () => {
    const organizationId = await organization();
    await createContact(organizationId, { firstName: "Démo", phone: "0644444444" }, { isDemo: true });
    await createContact(organizationId, { firstName: "Réelle", phone: "0644444444" });
    expect(await detectAllDuplicates(organizationId)).toBe(0);
  });
});

describe("CRM-07 — La fusion conserve tout l'historique (D4, D5)", () => {
  it("champ par champ ; notes, évènements, messages, liens et rendez-vous passent à la fiche gardée ; la fiche absorbée disparaît ; la fusion est tracée", async () => {
    const organizationId = await organization();
    const source = await createProspectSource(organizationId, "Salon");
    const kept = await createContact(organizationId, { firstName: "Léa", lastName: "Martin", email: `lea.${randomUUID().slice(0, 6)}@example.test`, phone: "0655555555" });
    const absorbedEmail = `lea.martin.${randomUUID().slice(0, 6)}@example.test`;
    const absorbed = await createContact(organizationId, { firstName: "Lea", lastName: "Martin-Dupont", email: absorbedEmail, phone: "+33 6 55 55 55 55", city: "Lyon" });
    await addContactNote(organizationId, { contactId: absorbed.id, authorUserId: plannerId, body: "Préfère être appelée le soir." });
    const { id: eventId } = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ contactId: absorbed.id, firstName: "Lea" }] });
    const context = await prospectMessageContext({ organizationId, eventId, locale: "fr", bookingUrl: null });
    await sendProspectMessage({ organizationId, eventId, recipients: context!.recipients, templateId: null, subject: "Bonjour", body: "Merci !", userId: plannerId, locale: "fr", delivery: "prepared", values: {} });
    const { sql, db } = createAppConnection();
    try {
      await withOrganization(db, organizationId, (tx) =>
        tx.insert(appointments).values({ organizationId, contactId: absorbed.id, typeName: "Découverte", hostUserId: plannerId, startsAt: new Date("2027-01-10T09:00:00Z"), endsAt: new Date("2027-01-10T10:00:00Z"), locationKind: "video", origin: "manual", personName: "Lea", personEmail: absorbedEmail }),
      );
    } finally {
      await sql.end();
    }
    const before = { events: await countEventsContactReferences(organizationId, absorbed.id), appointments: await countContactAppointments(organizationId, absorbed.id) };
    expect(before.events).toMatchObject({ events: 1, messages: 1 });
    expect(before.appointments).toBe(1);

    const result = await mergeContacts({ organizationId, keptContactId: kept.id, absorbedContactId: absorbed.id, choices: { lastName: "absorbed", email: "absorbed" }, userId: plannerId });
    expect(result.fieldsFromAbsorbed).toEqual(["lastName", "email", "city"]);
    expect(await getContact(organizationId, absorbed.id)).toBeNull();
    expect(await getContact(organizationId, kept.id)).toMatchObject({ lastName: "Martin-Dupont", email: absorbedEmail, phone: "0655555555", city: "Lyon" });
    expect((await listContactNotes(organizationId, kept.id)).map((note) => note.body)).toEqual(["Préfère être appelée le soir."]);
    // Avant que les modules repointent : l'identifiant absorbé donne déjà la fiche gardée.
    expect((await getContactsByIds(organizationId, [absorbed.id], { followMerges: true })).get(absorbed.id)?.id).toBe(kept.id);
    expect((await getContactsByIds(organizationId, [absorbed.id])).get(absorbed.id)).toBeUndefined();
    expect(await listContactMerges(organizationId, kept.id)).toMatchObject([{ absorbedContactId: absorbed.id, fields: ["lastName", "email", "city"], mergedByUserId: plannerId }]);

    await runEventWorkerOnce(MERGE_CONSUMERS);
    expect((await getEvent(organizationId, eventId))!.clients[0]).toMatchObject({ contactId: kept.id });
    expect(await listContactMessages(organizationId, kept.id)).toHaveLength(1);
    expect(await countEventsContactReferences(organizationId, kept.id)).toMatchObject({ events: 1, messages: 1 });
    expect(await countEventsContactReferences(organizationId, absorbed.id)).toEqual({ events: 0, links: 0, messages: 0, questionnaires: 0 });
    expect(await countContactAppointments(organizationId, kept.id)).toBe(before.appointments);
    expect(await countContactAppointments(organizationId, absorbed.id)).toBe(0);

    const { sql: sql2, db: db2 } = createAppConnection();
    try {
      const published = await withOrganization(db2, organizationId, (tx) => tx.select().from(domainEvents).where(and(eq(domainEvents.name, HUB_CONTACT_MERGED), eq(domainEvents.organizationId, organizationId))));
      expect(published).toHaveLength(1);
      // Aucune donnée personnelle dans l'événement : des identifiants.
      expect(JSON.stringify(published[0]!.payload)).not.toMatch(/@|Martin/);
    } finally {
      await sql2.end();
    }
  });

  it("un consommateur reçoit l'événement deux fois sans rien changer de plus (idempotent)", async () => {
    const organizationId = await organization();
    const source = await createProspectSource(organizationId, "Salon");
    const kept = await createContact(organizationId, { firstName: "Hugo" });
    const absorbed = await createContact(organizationId, { firstName: "Hugo" });
    const { id: eventId } = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ contactId: kept.id, firstName: "Hugo" }, { contactId: absorbed.id, firstName: "Hugo" }] });
    await mergeContacts({ organizationId, keptContactId: kept.id, absorbedContactId: absorbed.id, choices: {}, userId: plannerId });
    expect(await repointMergedContact(organizationId, absorbed.id, kept.id)).toBeGreaterThan(0);
    expect(await repointMergedContact(organizationId, absorbed.id, kept.id)).toBe(0);
    // Les deux fiches étaient clientes du même évènement : il n'en reste qu'une, la gardée.
    expect((await getEvent(organizationId, eventId))!.clients.map((client) => client.contactId)).toEqual([kept.id]);
  });

  it("jamais de fusion avec une fiche fictive, ni d'une fiche avec elle-même", async () => {
    const organizationId = await organization();
    const real = await createContact(organizationId, { firstName: "Réelle" });
    const demo = await createContact(organizationId, { firstName: "Démo" }, { isDemo: true });
    await expect(mergeContacts({ organizationId, keptContactId: real.id, absorbedContactId: demo.id, choices: {}, userId: plannerId })).rejects.toThrow(ContactMergeRefusedError);
    await expect(mergeContacts({ organizationId, keptContactId: real.id, absorbedContactId: real.id, choices: {}, userId: plannerId })).rejects.toThrow(/same/);
    expect(await getContact(organizationId, demo.id)).not.toBeNull();
  });
});

describe("SEC-36 — Doublons et fusion : isolation entre organisations", () => {
  it("B ne voit pas les doublons de A, ne les écarte pas, ne fusionne pas ses fiches ; une fiche de B ne s'apparie pas à une fiche de A", async () => {
    const a = await organization();
    const b = await organization();
    const first = await createContact(a, { firstName: "Léa", phone: "0677777777" });
    const second = await createContact(a, { firstName: "Léa M.", phone: "0677777777" });
    await createContact(b, { firstName: "Léa", phone: "0677777777" });
    expect(await listDuplicatePairs(b)).toEqual([]);
    const [pair] = await listDuplicatePairs(a);
    await expect(dismissDuplicatePair(b, pair!.id, plannerId)).rejects.toThrow(DuplicatePairNotFoundError);
    await expect(mergeContacts({ organizationId: b, keptContactId: first.id, absorbedContactId: second.id, choices: {}, userId: plannerId })).rejects.toThrow(/not_found/);
    expect(await getContact(a, second.id)).not.toBeNull();
    expect(await listDuplicatePairs(a)).toHaveLength(1);
  });
});
