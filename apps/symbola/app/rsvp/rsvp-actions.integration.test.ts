// Lot 49 (INV-03, SEC-04, SEC-14, SEC-17) — les actions de la page de réponse d'un invité, contre un
// vrai PostgreSQL : seule la requête Next.js (en-têtes, langue) est simulée. Débit limité à
// l'ouverture et à l'envoi (par adresse IP et par lien) ; une entrée malformée vaut « lien inconnu ».
import { describe, expect, it, vi } from "vitest";

const request = vi.hoisted(() => ({ ip: "203.0.113.49" }));

vi.mock("next/headers", () => ({
  headers: async () => new Headers({ "x-forwarded-for": request.ip }),
  cookies: async () => ({ get: () => undefined, set: () => undefined, delete: () => undefined }),
}));
vi.mock("next-intl/server", () => ({ getLocale: async () => "fr" }));

const { answerRsvpAction, openRsvpAction, opposeRsvpAction } = await import("./actions");
const { household, linkFor, openResponses, readyOrganization, weddingEvent } = await import("@/modules/guests/test-fixtures");

async function token() {
  const { organizationId, ownerId } = await readyOrganization();
  const { eventId } = await weddingEvent(organizationId, ownerId);
  await openResponses(organizationId, eventId);
  const created = await household(organizationId, eventId, { people: [{ kind: "adult", firstName: "Jeanne", phone: "0612345678" }] });
  return linkFor(organizationId, eventId, created.people[0]!.id);
}

describe("INV-03 — Page de réponse : débit limité, entrées contrôlées", () => {
  it("l'ouverture est limitée par lien (vingt par quart d'heure), puis « réessayez dans N minutes »", async () => {
    request.ip = `203.0.113.${Math.floor(Math.random() * 200) + 1}`;
    const link = await token();
    for (let attempt = 0; attempt < 20; attempt += 1) expect((await openRsvpAction(link)).outcome).toBe("open");
    const refused = await openRsvpAction(link);
    expect(refused).toMatchObject({ outcome: "retry" });
  });

  it("l'envoi est limité aussi (dix par quart d'heure et par lien)", async () => {
    request.ip = `198.51.100.${Math.floor(Math.random() * 200) + 1}`;
    const link = await token();
    const empty = { presence: [], consent: false, dietOptionIds: [], children: [] };
    for (let attempt = 0; attempt < 10; attempt += 1) expect((await answerRsvpAction(link, empty)).outcome).toBe("saved");
    expect(await answerRsvpAction(link, empty)).toMatchObject({ outcome: "retry" });
    expect(await opposeRsvpAction(link)).toMatchObject({ outcome: "retry" });
  });

  it("un jeton ou une réponse malformés valent « lien inconnu », sans rien écrire", async () => {
    request.ip = `192.0.2.${Math.floor(Math.random() * 200) + 1}`;
    expect(await openRsvpAction(42)).toEqual({ outcome: "invalid" });
    expect(await openRsvpAction("x".repeat(500))).toEqual({ outcome: "invalid" });
    const link = await token();
    expect(await answerRsvpAction(link, { presence: "tous", consent: true })).toEqual({ outcome: "invalid" });
    expect(await answerRsvpAction(link, { presence: [{ guestId: "pas-un-uuid", keyMomentId: "x", attending: true }], consent: false, dietOptionIds: [], children: [] })).toEqual({ outcome: "invalid" });
  });
});
