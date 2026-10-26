// SOC-13 — upsert atomique des compteurs d'usage, vérifié contre un vrai
// PostgreSQL (concurrence incluse).
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "../client";
import { usageCounters } from "../schema/core";
import { incrementUsageCounters } from "./increment";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function readCounter(organizationId: string, date: string) {
  const [row] = await db
    .select()
    .from(usageCounters)
    .where(and(eq(usageCounters.organizationId, organizationId), eq(usageCounters.date, date)));
  return row;
}

describe("SOC-13 — Compteurs d'usage (PostgreSQL réel)", () => {
  it("crée la ligne du jour au premier incrément", async () => {
    const organizationId = randomUUID();
    const date = "2026-01-15";

    await incrementUsageCounters(db, { organizationId, date, requests: 1, bytes: 512 });

    const row = await readCounter(organizationId, date);
    expect(row?.requestCount).toBe(1);
    expect(row?.responseBytes).toBe(512);
  });

  it("cumule les incréments suivants au lieu d'écraser", async () => {
    const organizationId = randomUUID();
    const date = "2026-01-16";

    await incrementUsageCounters(db, { organizationId, date, requests: 1, bytes: 100 });
    await incrementUsageCounters(db, { organizationId, date, requests: 2, bytes: 300 });

    const row = await readCounter(organizationId, date);
    expect(row?.requestCount).toBe(3);
    expect(row?.responseBytes).toBe(400);
  });

  it("cumule correctement des incréments concurrents (pas de perte par écrasement)", async () => {
    const organizationId = randomUUID();
    const date = "2026-01-17";

    await Promise.all(
      Array.from({ length: 10 }, () =>
        incrementUsageCounters(db, { organizationId, date, requests: 1, bytes: 10 }),
      ),
    );

    const row = await readCounter(organizationId, date);
    expect(row?.requestCount).toBe(10);
    expect(row?.responseBytes).toBe(100);
  });

  it("garde des jours distincts séparés pour la même organisation", async () => {
    const organizationId = randomUUID();

    await incrementUsageCounters(db, { organizationId, date: "2026-02-01", requests: 1, bytes: 1 });
    await incrementUsageCounters(db, { organizationId, date: "2026-02-02", requests: 5, bytes: 5 });

    expect((await readCounter(organizationId, "2026-02-01"))?.requestCount).toBe(1);
    expect((await readCounter(organizationId, "2026-02-02"))?.requestCount).toBe(5);
  });
});
