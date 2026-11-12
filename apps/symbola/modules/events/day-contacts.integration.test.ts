// Lot 30a (JRJ-03, décision D4) — contacts du jour J, contre un vrai PostgreSQL (RLS) :
// ajout dans l'ordre, refus clairs, retrait ; abus d'une autre organisation ; RGPD
// (trouvés par nom ou téléphone, rendus avec l'événement, supprimés à l'oubli).
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import {
  addEventDayContact,
  createProspect,
  createProspectSource,
  DayContactInvalidError,
  EventDayContactNotFoundError,
  EventNotFoundError,
  listEventDayContacts,
  removeEventDayContact,
} from "./service";
import { eventsPrivacy } from "./privacy";

const plannerId = randomUUID();
const rules = { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 };

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function wedding() {
  const organizationId = (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
  const source = await createProspectSource(organizationId, "Salon");
  const event = await createProspect({ organizationId, createdByUserId: plannerId, prospectSourceId: source.id, clients: [{ firstName: "Léa" }], eventDate: "2027-06-12" });
  return { organizationId, eventId: event.id };
}

describe("JRJ-03 — Contacts du jour J (décision D4)", () => {
  it("s'ajoutent dans l'ordre, nom, rôle et téléphone nettoyés ; se retirent", async () => {
    const { organizationId, eventId } = await wedding();
    const manager = await addEventDayContact(organizationId, eventId, { name: "  Hélène   Vasseur ", role: "Régisseuse du domaine", phone: "01 99 00 01 00" });
    const taxi = await addEventDayContact(organizationId, eventId, { name: "Taxi Périgord", role: "", phone: "+33 5 53 00 00 00" });
    expect(manager).toMatchObject({ name: "Hélène Vasseur", role: "Régisseuse du domaine", phone: "01 99 00 01 00", position: 0 });
    expect(taxi).toMatchObject({ role: null, position: 1 });
    expect((await listEventDayContacts(organizationId, eventId)).map((contact) => contact.name)).toEqual(["Hélène Vasseur", "Taxi Périgord"]);

    await removeEventDayContact(organizationId, manager.id);
    expect((await listEventDayContacts(organizationId, eventId)).map((contact) => contact.name)).toEqual(["Taxi Périgord"]);
    await expect(removeEventDayContact(organizationId, manager.id)).rejects.toBeInstanceOf(EventDayContactNotFoundError);
  });

  it("refus clairs : nom vide, téléphone sans chiffres ou avec des lettres, rôle trop long", async () => {
    const { organizationId, eventId } = await wedding();
    const add = (name: string, phone: string, role: string | null = null) => addEventDayContact(organizationId, eventId, { name, phone, role });
    await expect(add("   ", "0600000000")).rejects.toMatchObject({ reason: "name" });
    await expect(add("Taxi", "12")).rejects.toMatchObject({ reason: "phone" });
    await expect(add("Taxi", "06 AB 00 00 00")).rejects.toMatchObject({ reason: "phone" });
    await expect(add("Taxi", "0600000000", "x".repeat(121))).rejects.toBeInstanceOf(DayContactInvalidError);
    expect(await listEventDayContacts(organizationId, eventId)).toEqual([]);
  });

  it("abus : une autre organisation ne lit, n'ajoute ni ne retire rien", async () => {
    const mine = await wedding();
    const other = await wedding();
    const contact = await addEventDayContact(mine.organizationId, mine.eventId, { name: "Régisseur", phone: "0600000000" });
    expect(await listEventDayContacts(other.organizationId, mine.eventId)).toEqual([]);
    await expect(addEventDayContact(other.organizationId, mine.eventId, { name: "Intrus", phone: "0600000000" })).rejects.toBeInstanceOf(EventNotFoundError);
    await expect(removeEventDayContact(other.organizationId, contact.id)).rejects.toBeInstanceOf(EventDayContactNotFoundError);
    expect(await listEventDayContacts(mine.organizationId, mine.eventId)).toHaveLength(1);
  });
});

describe("RGPD-01, RGPD-03 — Contacts du jour J (lot 30a)", () => {
  it("trouvés par nom ou téléphone, rendus avec l'événement, supprimés à l'oubli", async () => {
    const { organizationId, eventId } = await wedding();
    const contact = await addEventDayContact(organizationId, eventId, { name: "Hélène Vasseur", role: "Régisseuse", phone: "01 99 00 01 00" });

    expect((await eventsPrivacy.find({ organizationId, terms: { name: "Helene Vasseur" } })).filter((record) => record.kind === "event_day_contact").map((record) => record.recordId)).toEqual([contact.id]);
    expect((await eventsPrivacy.find({ organizationId, terms: { phone: "0199000100" } })).some((record) => record.kind === "event_day_contact")).toBe(true);
    const related = await eventsPrivacy.related!({ organizationId, eventIds: [eventId] });
    expect(related.find((record) => record.kind === "event_day_contact")).toMatchObject({ recordId: contact.id, fields: { name: "Hélène Vasseur", role: "Régisseuse", phone: "01 99 00 01 00" } });

    const records = [{ kind: "event_day_contact", recordId: contact.id }];
    expect(await eventsPrivacy.planErasure({ organizationId, records, rules, today: "2026-11-12" })).toEqual([
      { kind: "event_day_contact", recordId: contact.id, fate: "deleted", legalBasis: null, keptUntil: null },
    ]);
    await eventsPrivacy.erase({ organizationId, records, rules, today: "2026-11-12" });
    expect(await listEventDayContacts(organizationId, eventId)).toEqual([]);
  });
});
