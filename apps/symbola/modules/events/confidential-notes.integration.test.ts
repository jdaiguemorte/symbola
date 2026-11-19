// Lot 48a (DAT-08 ; D5, ADR 0093) — notes d'évènement et de contact confidentielles : chiffrées en base,
// lues par leur auteur et la titulaire seuls, absentes des recherches, de la fiche d'identité et de
// l'export complet ; rendues à la personne qui exerce son droit d'accès.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { events } from "@symbola/db/schema/events";
import { contactNotes } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { addContactNote, createContact, listContactNotes } from "@/modules/hub/service";
import { createProspect, createProspectSource, EventNotesForbiddenError, getEvent, readEventConfidentialNotes, saveEventNotes, setEventIdentity } from "./service";
import { exportEventsData } from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function team() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const owner = await createUser(db, { organizationId: organization.id, email: `o-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const author = await createUser(db, { organizationId: organization.id, email: `a-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "member" });
  const other = await createUser(db, { organizationId: organization.id, email: `b-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "member" });
  // Lot 52 (HUB-04) : le Comptable de l'organisation, en lecture seule de la comptabilité.
  const accountant = await createUser(db, { organizationId: organization.id, email: `c-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "accountant" });
  return {
    organizationId: organization.id,
    owner: { userId: owner.id, role: "owner" as const },
    author: { userId: author.id, role: "member" as const },
    other: { userId: other.id, role: "member" as const },
    accountant: { userId: accountant.id, role: "accountant" as const },
  };
}

describe("DAT-08 — Notes confidentielles (lot 48a, D5)", () => {
  it("notes d'évènement : chiffrées, réservées, jamais écrasées par la fiche d'identité, absentes de l'export", async () => {
    const { organizationId, owner, author, other, accountant } = await team();
    const source = await createProspectSource(organizationId, "Salon");
    const eventId = (await createProspect({ organizationId, createdByUserId: owner.userId, prospectSourceId: source.id, clients: [{ firstName: "Léa" }] })).id;
    await saveEventNotes(organizationId, eventId, { notes: "Tension dans la famille du marié", confidential: true }, author);
    const [row] = await withOrganization(db, organizationId, (tx) => tx.select().from(events).where(eq(events.id, eventId)));
    expect(row!.notes).toBeNull();
    expect(JSON.stringify(row)).not.toContain("Tension");
    expect(await getEvent(organizationId, eventId)).toMatchObject({ notes: null, notesConfidential: { authorUserId: author.userId } });
    expect(await readEventConfidentialNotes(organizationId, eventId, author)).toBe("Tension dans la famille du marié");
    expect(await readEventConfidentialNotes(organizationId, eventId, owner)).toBe("Tension dans la famille du marié");
    await expect(readEventConfidentialNotes(organizationId, eventId, other)).rejects.toBeInstanceOf(EventNotesForbiddenError);
    await expect(readEventConfidentialNotes(organizationId, eventId, accountant)).rejects.toBeInstanceOf(EventNotesForbiddenError);
    await expect(saveEventNotes(organizationId, eventId, { notes: "", confidential: false }, other)).rejects.toBeInstanceOf(EventNotesForbiddenError);
    await setEventIdentity(organizationId, eventId, { guestsEstimated: 80, guestsConfirmed: null, style: null, notes: "écrasement" });
    expect(await readEventConfidentialNotes(organizationId, eventId, owner)).toBe("Tension dans la famille du marié");
    const exported = await exportEventsData(organizationId, { excludedEventIds: new Set() });
    expect(JSON.stringify(exported)).not.toContain("Tension");
    expect(JSON.stringify(exported)).not.toContain("f1:");
    await saveEventNotes(organizationId, eventId, { notes: "Apaisé", confidential: false }, owner);
    expect(await getEvent(organizationId, eventId)).toMatchObject({ notes: "Apaisé", notesConfidential: null });
  });

  it("notes de contact : chiffrées, lisibles par l'auteur et la titulaire, vides pour les autres, rendues au droit d'accès", async () => {
    const { organizationId, owner, author, other, accountant } = await team();
    const contact = await createContact(organizationId, { kind: "person", firstName: "Léa", lastName: "Martin" });
    await addContactNote(organizationId, { contactId: contact.id, authorUserId: author.userId, body: "Budget serré, ne pas le dire", confidential: true });
    await addContactNote(organizationId, { contactId: contact.id, authorUserId: author.userId, body: "Préfère le téléphone" });
    const [sealed] = await withOrganization(db, organizationId, (tx) => tx.select().from(contactNotes).where(eq(contactNotes.isConfidential, true)));
    expect(sealed!.body).toBeNull();
    expect(JSON.stringify(sealed)).not.toContain("Budget");
    const byAuthor = await listContactNotes(organizationId, contact.id, author);
    expect(byAuthor.find((note) => note.confidential)).toMatchObject({ readable: true, body: "Budget serré, ne pas le dire" });
    expect((await listContactNotes(organizationId, contact.id, owner)).find((note) => note.confidential)).toMatchObject({ readable: true });
    const byOther = await listContactNotes(organizationId, contact.id, other);
    expect(byOther.find((note) => note.confidential)).toMatchObject({ readable: false, body: "" });
    expect(byOther.find((note) => !note.confidential)).toMatchObject({ body: "Préfère le téléphone" });
    // Lot 52 : le Comptable ne lit pas une note confidentielle.
    expect((await listContactNotes(organizationId, contact.id, accountant)).find((note) => note.confidential)).toMatchObject({ readable: false, body: "" });
    expect((await listContactNotes(organizationId, contact.id, "reveal")).find((note) => note.confidential)).toMatchObject({ body: "Budget serré, ne pas le dire" });
  });
});
