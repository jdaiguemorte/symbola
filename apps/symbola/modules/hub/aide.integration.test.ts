// AIDE-01/04 — visite guidée (première ouverture seulement, relançable),
// liste « premiers pas » (masquable, se coche seule). Contre un vrai
// PostgreSQL.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { eq, inArray } from "drizzle-orm";
import { users } from "@symbola/db/schema/hub";
import { hasSeenTour, hideFirstSteps, markTourSeen, showFirstSteps } from "./service";

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

// Lot 72b (AIDE-04 ; critère 5) : « Masquer » vaut pour la personne, sur tous ses appareils (en base), pas pour
// ses collègues ; « Annuler » la rend.
describe("AIDE-04 — « Pour bien démarrer » masqué pour la personne seule (lot 72b)", () => {
  const hidden = async (ids: string[]) =>
    Object.fromEntries((await db.select({ id: users.id, hidden: users.firstStepsHidden }).from(users).where(inArray(users.id, ids))).map((row) => [row.id, row.hidden]));

  it("masquer ne touche pas la collègue de la même organisation ; « Annuler » rend la ligne", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const camille = await createUser(db, { organizationId: organization.id, email: `camille-${randomUUID()}@symbola.test`, role: "owner" });
    const bastien = await createUser(db, { organizationId: organization.id, email: `bastien-${randomUUID()}@symbola.test`, role: "member" });
    await hideFirstSteps(db, camille.id);
    expect(await hidden([camille.id, bastien.id])).toEqual({ [camille.id]: true, [bastien.id]: false });
    await showFirstSteps(db, camille.id);
    expect((await db.select({ hidden: users.firstStepsHidden }).from(users).where(eq(users.id, camille.id)))[0]?.hidden).toBe(false);
  });

  it("une autre organisation n'est pas touchée non plus", async () => {
    const other = await createTestUser();
    const userId = await createTestUser();
    await hideFirstSteps(db, userId);
    expect(await hidden([userId, other])).toEqual({ [userId]: true, [other]: false });
  });
});
