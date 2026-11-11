// Lot 16 (L16-ARC-01, ADR 0043) — la réserve de connexions partagée : une seule par
// processus, et le contexte RLS d'une transaction ne reste jamais sur la
// connexion qu'une autre requête emprunte ensuite. PostgreSQL réel, rôle
// applicatif ; sources de prospects (une table sous RLS).
import { randomUUID } from "node:crypto";
import { sql } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { appDatabase, closeAppDatabase } from "./client";
import { prospectSources } from "./schema/events";
import { withOrganization } from "./with-organization";

afterAll(async () => {
  await closeAppDatabase();
});

describe("L16-ARC-01 — Une connexion partagée", () => {
  it("appDatabase renvoie la même réserve à chaque appel, et en rouvre une après fermeture", async () => {
    const first = appDatabase();
    expect(appDatabase()).toBe(first);
    await closeAppDatabase();
    expect(appDatabase()).not.toBe(first);
  });

  it("le contexte d'organisation ne survit pas à sa transaction", async () => {
    const db = appDatabase();
    await Promise.all(Array.from({ length: 10 }, () => withOrganization(db, randomUUID(), async () => undefined)));
    // Autant de requêtes que de connexions dans la réserve : chacune retombe sur une connexion qui vient de servir.
    const results = await Promise.all(Array.from({ length: 20 }, () => db.execute<{ value: string | null }>(sql`select current_setting('app.organization_id', true) as value`)));
    for (const rows of results) expect(rows[0]?.value ?? "").toBe("");
  });

  it("des transactions simultanées d'organisations différentes ne voient que leurs lignes", async () => {
    const db = appDatabase();
    // Plus d'organisations que de connexions : certaines transactions attendent leur tour.
    const organizations = Array.from({ length: 15 }, () => randomUUID());
    await Promise.all(
      organizations.map((organizationId) => withOrganization(db, organizationId, (tx) => tx.insert(prospectSources).values({ organizationId, label: `réserve ${organizationId}` }))),
    );
    const seen = await Promise.all(organizations.map((organizationId) => withOrganization(db, organizationId, (tx) => tx.select().from(prospectSources))));
    seen.forEach((rows, index) => {
      expect(rows).toHaveLength(1);
      expect(rows[0]?.organizationId).toBe(organizations[index]);
    });
  });
});
