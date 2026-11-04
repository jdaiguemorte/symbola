// Lot 10 (AIDE-05 à AIDE-07) — progression d'un compte dans l'aide, contre un
// vrai PostgreSQL : une visite mise de côté garde son étape et ne s'impose
// plus ; un élément terminé le reste, même revu.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { createOrganization, createUser } from "@symbola/auth";
import { getHelpProgress, hasSeenTour, InvalidHelpItemError, recordHelpProgress } from "./service";

const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

async function teamUser(): Promise<string> {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  return (await createUser(db, { organizationId: organization.id, email: `aide-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" })).id;
}

describe("AIDE-05 — Visite focus mise de côté puis reprise", () => {
  it("« Plus tard » garde l'étape ; la visite ne s'ouvre plus d'elle-même ; terminée, elle le reste", async () => {
    const userId = await teamUser();
    expect(await hasSeenTour(db, userId, "event-retroplanning")).toBe(false);

    await recordHelpProgress(db, { userId, itemKey: "tour:event-retroplanning", status: "postponed", step: 2 });
    expect(await hasSeenTour(db, userId, "event-retroplanning")).toBe(true);
    expect(await getHelpProgress(db, userId)).toEqual([expect.objectContaining({ itemKey: "tour:event-retroplanning", status: "postponed", step: 2, completedAt: null })]);

    await recordHelpProgress(db, { userId, itemKey: "tour:event-retroplanning", status: "completed", step: 3 });
    // Revoir une visite terminée ne la fait pas repasser « en cours ».
    await recordHelpProgress(db, { userId, itemKey: "tour:event-retroplanning", status: "started", step: 0 });
    const [entry] = await getHelpProgress(db, userId);
    expect(entry).toMatchObject({ status: "completed", step: 3 });
    expect(entry!.completedAt).not.toBeNull();
  });
});

describe("AIDE-07 — Progression par compte", () => {
  it("chaque compte a sa propre progression ; une clé inconnue est refusée", async () => {
    const first = await teamUser();
    const second = await teamUser();
    await recordHelpProgress(db, { userId: first, itemKey: "tutorial:retroplanning-template", status: "started", step: 1 });
    expect(await getHelpProgress(db, second)).toEqual([]);
    await expect(recordHelpProgress(db, { userId: first, itemKey: "n'importe quoi", status: "started" })).rejects.toBeInstanceOf(InvalidHelpItemError);
  });
});
