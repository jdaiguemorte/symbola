// Lot 23b — FAC-14 : le contrôle quotidien de la chaîne signale une
// modification directe en base au journal de l'organisation et à la sonde
// Uptime Kuma (« down »), et reste muet quand tout est intact (« up »).
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { invoices, quotes, quoteVersions } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import { checkAllLedgers, pushUrl } from "./ledger-check";

const { sql, db } = createAppConnection();
const admin = postgres({
  host: process.env.POSTGRES_HOST ?? "localhost",
  port: Number(process.env.POSTGRES_PORT ?? 5432),
  database: process.env.POSTGRES_DB ?? "symbola",
  username: process.env.POSTGRES_ADMIN_USER ?? "postgres",
  password: process.env.POSTGRES_ADMIN_PASSWORD ?? "",
  max: 1,
  onnotice: () => {},
});

afterAll(async () => {
  await sql.end();
  await admin.end();
});

async function organizationWithInvoice(): Promise<{ organizationId: string; invoiceId: string }> {
  const organizationId = randomUUID();
  const invoiceId = await withOrganization(db, organizationId, async (tx) => {
    const [quote] = await tx.insert(quotes).values({ organizationId, eventId: randomUUID(), number: `D-${randomUUID().slice(0, 8)}`, createdByUserId: randomUUID() }).returning();
    const [version] = await tx.insert(quoteVersions).values({ organizationId, quoteId: quote!.id, version: 1 }).returning();
    const [invoice] = await tx
      .insert(invoices)
      .values({
        organizationId,
        quoteId: quote!.id,
        versionId: version!.id,
        kind: "deposit",
        number: `F-${randomUUID().slice(0, 8)}`,
        issuedAt: new Date(),
        issuedOn: "2027-04-10",
        paymentDueOn: "2027-04-15",
        amountCents: 30000,
        vatRegime: "franchise",
        sellerSnapshot: {},
        buyerSnapshot: [],
        linesSnapshot: [],
        totalsSnapshot: {},
      })
      .returning();
    return invoice!.id;
  });
  return { organizationId, invoiceId };
}

describe("FAC-14 — Contrôle quotidien de la chaîne des pièces", () => {
  it("une chaîne intacte : sonde « up », rien au journal", async () => {
    const { organizationId } = await organizationWithInvoice();
    const pushed: string[] = [];
    const result = await checkAllLedgers({ organizationIds: [organizationId], pushBase: "https://kuma.example/api/push/jeton?status=up&msg=OK&ping=", push: async (url) => pushed.push(url) });
    expect(result.withAnomalies).toEqual([]);
    expect(pushed).toEqual([pushUrl("https://kuma.example/api/push/jeton", "up", "OK")]);
    expect(pushed[0]).toContain("status=up");
  });

  it("une facture modifiée en base : ligne au journal de l'organisation et sonde « down »", async () => {
    const tampered = await organizationWithInvoice();
    const intact = await organizationWithInvoice();
    await admin.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`update quotes.invoices set amount_cents = 1 where id = ${tampered.invoiceId}`;
    });
    const pushed: string[] = [];
    const result = await checkAllLedgers({ organizationIds: [tampered.organizationId, intact.organizationId], pushBase: "https://kuma.example/api/push/jeton", push: async (url) => pushed.push(url) });
    expect(result.withAnomalies).toEqual([tampered.organizationId]);
    expect(pushed[0]).toContain("status=down");
    const journal = await withOrganization(db, tampered.organizationId, (tx) =>
      tx.select().from(auditEntries).where(and(eq(auditEntries.organizationId, tampered.organizationId), eq(auditEntries.action, "quotes.ledger.anomaly_detected"))),
    );
    expect(journal).toMatchObject([{ actorKind: "system", details: { count: 1, first: "object_altered", sequence: 1 } }]);
  });
});
