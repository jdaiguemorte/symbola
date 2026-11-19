// Lot 52 (EVT-06, SEC-12, SEC-13 ; D3 ; ADR 0094) — les routes du mode Jour J vues par un renfort du jour
// J, avec la session de son lien (cookie), contre un vrai PostgreSQL et un vrai Mailpit. Tests d'abus
// (CLAUDE.md § 2.11, SEC-36) : un autre évènement répond comme un évènement inexistant ; une remise
// d'argent, un décalage sont refusés ; après le retrait du lien, la file rejouée est refusée et le dit.
import { randomUUID } from "node:crypto";
import { describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({ values: new Map<string, string>() }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ host: "app.test" }),
  cookies: async () => ({
    get: (name: string) => (jar.values.has(name) ? { name, value: jar.values.get(name)! } : undefined),
    set: () => undefined,
    delete: () => undefined,
  }),
}));

const { createOrganization, createUser } = await import("@symbola/auth");
const { createAppConnection } = await import("@symbola/db/client");
const events = await import("@/modules/events/service");
const { GET: getState } = await import("./etat/route");
const { POST: postActions } = await import("./actions/route");

const MAILPIT_API = "http://localhost:8025/api/v1";

async function codeSentTo(email: string): Promise<string> {
  for (let attempt = 0; attempt < 40; attempt++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${email}`)}`);
    const { messages } = (await response.json()) as { messages: { Subject: string }[] };
    const code = messages.map((message) => /(\d{6})$/.exec(message.Subject)?.[1]).find(Boolean);
    if (code) return code;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("aucun code reçu");
}

// Un évènement confirmé, daté d'aujourd'hui (mode Jour J ouvert), son renfort ouvert par son lien.
async function helperOnTheDay() {
  const { sql, db } = createAppConnection();
  let organizationId: string;
  let ownerId: string;
  try {
    organizationId = (await createOrganization(db, `Agence ${randomUUID().slice(0, 8)}`)).id;
    ownerId = (await createUser(db, { organizationId, email: `owner-${randomUUID()}@example.test`, role: "owner" })).id;
  } finally {
    await sql.end();
  }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(new Date());
  const source = await events.createProspectSource(organizationId, "Salon");
  const create = async () => {
    const event = await events.createProspect({ organizationId, createdByUserId: ownerId, prospectSourceId: source.id, clients: [{ firstName: "Léa", lastName: null }], eventDate: today });
    await events.changeEventStatus({ organizationId, eventId: event.id, changedByUserId: ownerId, toStatus: "confirmed" });
    return event.id;
  };
  const eventId = await create();
  const sibling = await create();
  const item = await events.addProgramItem(organizationId, eventId, { startTime: "16:00", label: "Cérémonie", vendorSlotIds: [], freeParticipants: [] });
  const email = `hugo-${randomUUID()}@example.test`;
  const { helper, url } = await events.createDayHelper({ organizationId, eventId, helper: { personName: "Hugo", email }, locale: "fr", byUserId: ownerId });
  const token = url.split("#")[1]!;
  const opened = await events.openEventLink(token);
  expect(opened.outcome).toBe("code_required");
  const verified = await events.verifyLinkCode(token, await codeSentTo(email));
  if (verified.outcome !== "opened") throw new Error("session attendue");
  return { organizationId, ownerId, eventId, sibling, itemId: item.id, linkId: helper.linkId, session: verified.sessionToken };
}

function asHelper(session: string | null) {
  jar.values.clear();
  if (session) jar.values.set("symbola_lien", session);
}

const params = (eventId: string) => ({ params: Promise.resolve({ eventId }) });

function post(eventId: string, actions: unknown[]) {
  return postActions(
    new Request(`http://app.test/jour-j/${eventId}/actions`, { method: "POST", headers: { origin: "http://app.test", host: "app.test", "content-type": "application/json" }, body: JSON.stringify({ actions }) }),
    params(eventId),
  );
}

function checkpoint(itemId: string) {
  return { kind: "checkpoint", actionId: randomUUID(), deviceAt: new Date().toISOString(), itemId, checkpoint: "started" };
}

describe("EVT-06 (D3) — Le renfort du jour J n'accède qu'au mode Jour J de son évènement", () => {
  it("lit l'état partagé de son évènement, sans remises d'argent ni adresse des comptes de l'équipe", async () => {
    const day = await helperOnTheDay();
    asHelper(day.session);
    const response = await getState(new Request(`http://app.test/jour-j/${day.eventId}/etat`), params(day.eventId));
    expect(response.status).toBe(200);
    const body = (await response.json()) as { handovers: unknown; state: { people: { name: string }[] } };
    expect(body.handovers).toBeNull();
    expect(body.state.people.every((person) => !person.name.includes("@"))).toBe(true);
  });

  it("pointe ; ses remises d'argent et ses décalages sont refusés pour de bon", async () => {
    const day = await helperOnTheDay();
    asHelper(day.session);
    const handover = { kind: "handover", actionId: randomUUID(), deviceAt: new Date().toISOString(), paymentId: randomUUID() };
    const shift = { kind: "shift", actionId: randomUUID(), deviceAt: new Date().toISOString(), lateItemId: day.itemId, keyMomentId: null, minutes: 15, itemIds: [day.itemId], vendorSlotIds: [] };
    const response = await post(day.eventId, [checkpoint(day.itemId), handover, shift]);
    expect(response.status).toBe(200);
    const { outcomes } = (await response.json()) as { outcomes: { status: string; reason?: string }[] };
    expect(outcomes.map((outcome) => [outcome.status, outcome.reason ?? null])).toEqual([
      ["applied", null],
      ["rejected", "scope"],
      ["rejected", "scope"],
    ]);
  });

  it("un autre évènement de l'organisation, un évènement inexistant : la même réponse, sans rien dire", async () => {
    const day = await helperOnTheDay();
    asHelper(day.session);
    const sibling = await getState(new Request(`http://app.test/jour-j/${day.sibling}/etat`), params(day.sibling));
    const unknown = await getState(new Request("http://app.test/jour-j/x/etat"), params(randomUUID()));
    expect(sibling.status).toBe(unknown.status);
    expect(await sibling.json()).toEqual(await unknown.json());
    const write = await post(day.sibling, [checkpoint(day.itemId)]);
    expect(write.status).toBe(unknown.status);
  });

  it("après le retrait de son lien, sa file rejouée est refusée et l'appareil le lui dit (401 « link »)", async () => {
    const day = await helperOnTheDay();
    asHelper(day.session);
    const queued = checkpoint(day.itemId);
    await events.revokeDayHelper(day.organizationId, day.eventId, day.linkId);
    const response = await post(day.eventId, [queued]);
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "link" });
    const state = await events.getDayState(day.organizationId, day.eventId);
    expect(state!.checkpoints).toEqual([]);
  });

  it("sans session ni lien : la reconnexion est demandée", async () => {
    const day = await helperOnTheDay();
    asHelper(null);
    const response = await getState(new Request(`http://app.test/jour-j/${day.eventId}/etat`), params(day.eventId));
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "session" });
  });
});
