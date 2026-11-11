// Lot 24a — SEC-13 et SC-S1 (décision D4) : un identifiant introuvable demandé
// dans une adresse va au journal de l'organisation de la personne connectée,
// au plus une fois par minute et par route ; la réponse reste celle d'un objet
// inexistant. PostgreSQL réel ; seule la session est simulée.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { describe, expect, it, vi } from "vitest";
import type { AuthResult } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";

const session = vi.hoisted(() => ({ current: { status: "unauthenticated" } as AuthResult }));

vi.mock("./auth-context", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./auth-context")>()),
  getAuthContext: async () => session.current,
}));

const { journalAccessRefusal, refusedResponse, refusedRoute } = await import("./access-refusals");

function signedIn(organizationId: string | null, role = "owner") {
  const user = { id: randomUUID(), email: "titulaire@symbola.test", role, organizationId, language: null, firstStepsHidden: false, mfaEnabled: true };
  session.current = { status: "authenticated", user } as AuthResult;
  return user;
}

function refusalsOf(organizationId: string) {
  return withOrganization(appDatabase(), organizationId, (tx) =>
    tx
      .select()
      .from(auditEntries)
      .where(and(eq(auditEntries.organizationId, organizationId), eq(auditEntries.action, "hub.access.refused"))),
  );
}

describe("SEC-13 — Même réponse pour « inexistant » et « interdit », refus journalisé (SC-S1)", () => {
  it("la route garde sa forme, les identifiants deviennent [id] ; une adresse sans identifiant n'est pas un refus", () => {
    const eventId = randomUUID();
    const candidateId = randomUUID();
    expect(refusedRoute(`/events/${eventId}/consultes/${candidateId}/devis`)).toEqual({
      route: "/events/[id]/consultes/[id]/devis",
      objectId: candidateId,
    });
    expect(refusedRoute("/parametres/journal")).toBeNull();
    expect(refusedRoute("/devis/D-2027-001")).toBeNull();
  });

  it("un identifiant introuvable demandé par une personne connectée va au journal de SON organisation, et de nulle autre", async () => {
    const organizationA = randomUUID();
    const organizationB = randomUUID();
    const user = signedIn(organizationA);
    const eventOfB = randomUUID();
    expect(await journalAccessRefusal(`/events/${eventOfB}`)).toBe(true);
    const [entry, ...others] = await refusalsOf(organizationA);
    expect(others).toEqual([]);
    expect(entry).toMatchObject({
      category: "droits",
      actorKind: "member",
      actorId: user.id,
      objectId: eventOfB,
      details: { route: "/events/[id]" },
    });
    expect(JSON.stringify(entry)).not.toContain("titulaire@");
    expect(await refusalsOf(organizationB)).toEqual([]);
  });

  it("au plus une ligne par minute, par personne et par route", async () => {
    const organizationId = randomUUID();
    signedIn(organizationId);
    const start = Date.parse("2027-04-10T10:00:00Z");
    expect(await journalAccessRefusal(`/devis/${randomUUID()}`, start)).toBe(true);
    expect(await journalAccessRefusal(`/devis/${randomUUID()}`, start + 30_000)).toBe(false);
    expect(await journalAccessRefusal(`/devis/factures/${randomUUID()}/pdf`, start + 30_000)).toBe(true);
    expect(await journalAccessRefusal(`/devis/${randomUUID()}`, start + 60_000)).toBe(true);
    expect(await refusalsOf(organizationId)).toHaveLength(3);
  });

  it("rien pour une personne non connectée ni pour l'Admin, qui n'a pas d'organisation", async () => {
    session.current = { status: "unauthenticated" };
    expect(await journalAccessRefusal(`/events/${randomUUID()}`)).toBe(false);
    signedIn(null, "admin");
    expect(await journalAccessRefusal(`/events/${randomUUID()}`)).toBe(false);
  });

  it("une route répond un 404 vide, le même pour un objet inexistant et pour celui d'une autre organisation", async () => {
    signedIn(randomUUID());
    const response = await refusedResponse(new Request(`http://localhost/devis/factures/${randomUUID()}/pdf`));
    expect(response.status).toBe(404);
    expect(await response.text()).toBe("");
  });
});
