// SOC-13 — « une requête du module hello incrémente bien le compteur de
// la bonne organisation. » Exercé via la fonction appelée depuis
// getAuthContext() (point de passage de toute page protégée, dont celle
// du module hello) ; contre un vrai PostgreSQL.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { usageCounters } from "@symbola/db/schema/core";
import { recordUsage } from "./usage";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

describe("SOC-13 — Collecte des compteurs d'usage", () => {
  it("incrémente le compteur du jour pour la bonne organisation", async () => {
    const organizationId = randomUUID();
    const otherOrganizationId = randomUUID();
    const today = new Date().toISOString().slice(0, 10);

    await recordUsage(organizationId);
    await recordUsage(organizationId);
    await recordUsage(otherOrganizationId);

    const [row] = await db
      .select()
      .from(usageCounters)
      .where(and(eq(usageCounters.organizationId, organizationId), eq(usageCounters.date, today)));
    expect(row?.requestCount).toBe(2);

    const [otherRow] = await db
      .select()
      .from(usageCounters)
      .where(
        and(eq(usageCounters.organizationId, otherOrganizationId), eq(usageCounters.date, today)),
      );
    expect(otherRow?.requestCount).toBe(1);
  });
});
