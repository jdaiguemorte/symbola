// AIDE-02 — la purge planifiée supprime les essais abandonnés de toutes
// les organisations, au-delà de 24 h seulement.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { getEvent, startEventsTrial } from "@/modules/events/service";
import { purgeAllExpiredDemoData } from "./demo-purge";

describe("AIDE-02 — Purge planifiée des essais abandonnés", () => {
  // Parcourt toutes les organisations de la base de test (nombreuses en local).
  it("supprime les essais de plus de 24 h dans chaque organisation, garde les plus récents", { timeout: 60_000 }, async () => {
    const { sql, db } = createAppConnection();
    let first: string;
    let second: string;
    try {
      first = (await createOrganization(db, `Org ${randomUUID()}`)).id;
      second = (await createOrganization(db, `Org ${randomUUID()}`)).id;
    } finally {
      await sql.end();
    }
    const now = new Date();
    const old = await startEventsTrial({
      organizationId: first,
      userId: randomUUID(),
      locale: "fr",
      now: new Date(now.getTime() - 25 * 60 * 60 * 1000),
    });
    const recent = await startEventsTrial({ organizationId: second, userId: randomUUID(), locale: "fr", now });

    expect(await purgeAllExpiredDemoData(now)).toBeGreaterThanOrEqual(1);
    expect(await getEvent(first, old.eventId)).toBeNull();
    expect(await getEvent(second, recent.eventId)).not.toBeNull();
  });
});
