// Lot 24b — SEC-22 (décision D5) : au-delà du plafond, l'envoi est refusé avec
// le délai à attendre, et la titulaire est prévenue : une ligne au journal de
// l'organisation, une seule par heure. PostgreSQL réel.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { appDatabase, closeAppDatabase } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { withOrganization } from "@symbola/db/with-organization";
import { MailQuotaExceededError, organizationMailQuota, reserveOrganizationMail } from "./quota";

afterAll(async () => {
  await closeAppDatabase();
});

describe("SEC-22 — Le plafond atteint bloque et prévient le planner", () => {
  it("refuse l'envoi au-delà du plafond, journalise une fois dans l'heure, et l'état le montre", async () => {
    const organizationId = randomUUID();
    await reserveOrganizationMail(organizationId, { cap: 2 });
    await reserveOrganizationMail(organizationId, { cap: 2 });
    await expect(reserveOrganizationMail(organizationId, { cap: 2 })).rejects.toBeInstanceOf(MailQuotaExceededError);
    await expect(reserveOrganizationMail(organizationId, { cap: 2 })).rejects.toMatchObject({ retryAfterSeconds: expect.any(Number) });

    const visible = await withOrganization(appDatabase(), organizationId, (tx) => tx.select().from(auditEntries));
    const alerts = visible.filter((entry) => entry.organizationId === organizationId && entry.action === "hub.mail.quota_reached");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ category: "partage", actorKind: "system" });
    expect(await organizationMailQuota(organizationId, { cap: 2 })).toMatchObject({ cap: 2, sent: 2, reached: true });
  });
});
