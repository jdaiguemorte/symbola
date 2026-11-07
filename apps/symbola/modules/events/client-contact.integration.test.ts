// Lot 14 (décisions I et K) — coordonnées des clients de l'événement et
// budget souhaité, contre un vrai PostgreSQL : écriture, valeurs refusées,
// recherche et oubli RGPD, isolation entre organisations.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { eventsPrivacy } from "./privacy";
import {
  createProspect,
  createProspectSource,
  EventNotFoundError,
  getEvent,
  InvalidClientContactError,
  setEventWantedBudget,
  updateEventClientContact,
} from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function newEvent() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `p-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const source = await createProspectSource(organization.id, "Instagram");
  const { id } = await createProspect({
    organizationId: organization.id,
    createdByUserId: user.id,
    prospectSourceId: source.id,
    clients: [{ firstName: "Léa", lastName: "Martin" }, { firstName: "Hugo", lastName: "Bernard" }],
  });
  return { organizationId: organization.id, eventId: id };
}

describe("Lot 14 (décision I) — coordonnées des mariés", () => {
  it("l'e-mail, le téléphone et l'adresse de chaque client sont enregistrés ; une valeur vide est effacée", async () => {
    const { organizationId, eventId } = await newEvent();
    const [lea] = (await getEvent(organizationId, eventId))!.clients;
    await updateEventClientContact({
      organizationId,
      eventId,
      clientId: lea!.id,
      contact: { email: " lea.martin@example.org ", phone: "06 39 98 01 01", addressLine: "12 rue des Lilas", postalCode: "86000", city: "Poitiers" },
    });
    expect((await getEvent(organizationId, eventId))!.clients[0]).toMatchObject({
      email: "lea.martin@example.org",
      phone: "06 39 98 01 01",
      addressLine: "12 rue des Lilas",
      postalCode: "86000",
      city: "Poitiers",
    });
    await updateEventClientContact({ organizationId, eventId, clientId: lea!.id, contact: { email: "lea.martin@example.org", phone: "" } });
    expect((await getEvent(organizationId, eventId))!.clients[0]).toMatchObject({ phone: null, city: null });
  });

  it("un e-mail illisible est refusé", async () => {
    const { organizationId, eventId } = await newEvent();
    const [lea] = (await getEvent(organizationId, eventId))!.clients;
    await expect(updateEventClientContact({ organizationId, eventId, clientId: lea!.id, contact: { email: "lea@" } })).rejects.toThrow(InvalidClientContactError);
  });

  it("isolation : une autre organisation ne modifie ni les coordonnées ni le budget souhaité", async () => {
    const a = await newEvent();
    const b = await newEvent();
    const [lea] = (await getEvent(a.organizationId, a.eventId))!.clients;
    await expect(updateEventClientContact({ organizationId: b.organizationId, eventId: a.eventId, clientId: lea!.id, contact: { email: "x@example.org" } })).rejects.toThrow(EventNotFoundError);
    await expect(setEventWantedBudget(b.organizationId, a.eventId, 100)).rejects.toThrow(EventNotFoundError);
    expect((await getEvent(a.organizationId, a.eventId))!.clients[0]!.email).toBeNull();
    expect((await getEvent(a.organizationId, a.eventId))!.wantedBudgetCents).toBeNull();
  });

  it("RGPD : un client est trouvé par son e-mail ou son téléphone, et l'oubli efface ses coordonnées", async () => {
    const { organizationId, eventId } = await newEvent();
    const [lea] = (await getEvent(organizationId, eventId))!.clients;
    await updateEventClientContact({ organizationId, eventId, clientId: lea!.id, contact: { email: "lea.martin@example.org", phone: "06 39 98 01 01", city: "Poitiers" } });

    const found = await eventsPrivacy.find({ organizationId, terms: { email: "LEA.MARTIN@example.org" } });
    const client = found.find((record) => record.kind === "event_client")!;
    expect(client.fields).toMatchObject({ email: "lea.martin@example.org", phone: "06 39 98 01 01", address: "Poitiers" });
    expect((await eventsPrivacy.find({ organizationId, terms: { phone: "0639980101" } })).some((record) => record.kind === "event_client")).toBe(true);

    const rules = { accountingRetentionMonths: 120, signedQuoteRetentionMonths: 60 };
    await eventsPrivacy.erase({ organizationId, records: [{ kind: "event_client", recordId: client.recordId }], rules, today: "2026-11-07" });
    expect((await getEvent(organizationId, eventId))!.clients.find((entry) => entry.id === lea!.id)).toMatchObject({ email: null, phone: null, city: null });
  });
});

describe("Lot 14 (décision K) — budget souhaité", () => {
  it("le budget souhaité est enregistré en centimes, effacé par null, un montant négatif est refusé", async () => {
    const { organizationId, eventId } = await newEvent();
    await setEventWantedBudget(organizationId, eventId, 2_500_000);
    expect((await getEvent(organizationId, eventId))!.wantedBudgetCents).toBe(2_500_000);
    await expect(setEventWantedBudget(organizationId, eventId, -1)).rejects.toThrow(RangeError);
    await setEventWantedBudget(organizationId, eventId, null);
    expect((await getEvent(organizationId, eventId))!.wantedBudgetCents).toBeNull();
  });
});
