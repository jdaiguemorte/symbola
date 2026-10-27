// AIDE-01/04 — visite guidée (première ouverture seulement, relançable),
// liste « premiers pas » (masquable, se coche seule). Contre un vrai
// PostgreSQL.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { hasSeenTour, hideFirstSteps, markTourSeen } from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function createTestUser(): Promise<string> {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, {
    organizationId: organization.id,
    email: `user-${randomUUID()}@symbola.test`,
    password: "mot-de-passe",
    role: "owner",
  });
  return user.id;
}

describe("AIDE-01 — Visite guidée", () => {
  it("n'a pas encore été vue par défaut, puis reste vue après l'avoir marquée", async () => {
    const userId = await createTestUser();

    expect(await hasSeenTour(db, userId, "hub")).toBe(false);

    await markTourSeen(db, userId, "hub");
    expect(await hasSeenTour(db, userId, "hub")).toBe(true);

    // Un autre module reste non vu : le suivi est bien par module.
    expect(await hasSeenTour(db, userId, "autre-module")).toBe(false);
  });

  it("peut être marquée vue plusieurs fois sans erreur (relance)", async () => {
    const userId = await createTestUser();
    await markTourSeen(db, userId, "hub");
    await expect(markTourSeen(db, userId, "hub")).resolves.not.toThrow();
  });
});

describe("AIDE-04 — Masquer la liste « premiers pas »", () => {
  it("peut être masquée par l'utilisateur", async () => {
    const userId = await createTestUser();
    await expect(hideFirstSteps(db, userId)).resolves.not.toThrow();
  });
});
