// DEV-04 — « Une facture émise ne peut plus être modifiée ni supprimée »,
// y compris par appel direct à la base avec le rôle applicatif (RLS et
// trigger testés sur PostgreSQL réel). Isolation entre organisations.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "./client";
import { creditNotes, invoices, quotes, quoteVersions } from "./schema/quotes";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

// Message PostgreSQL (Drizzle l'enveloppe dans « Failed query » + cause).
async function failure(action: Promise<unknown>): Promise<string> {
  try {
    await action;
  } catch (error) {
    return String((error as { cause?: { message?: string } }).cause?.message ?? (error as Error).message);
  }
  return "aucune erreur";
}

const SNAPSHOT = { organizationName: "Atelier" };

async function seedInvoice(tx: Tx, organizationId: string, isDemo = false) {
  const [quote] = await tx
    .insert(quotes)
    .values({ organizationId, eventId: randomUUID(), number: `D-${randomUUID().slice(0, 8)}`, createdByUserId: randomUUID(), isDemo })
    .returning();
  const [version] = await tx.insert(quoteVersions).values({ organizationId, quoteId: quote!.id, version: 1 }).returning();
  const [invoice] = await tx
    .insert(invoices)
    .values({
      organizationId,
      quoteId: quote!.id,
      versionId: version!.id,
      kind: "deposit",
      number: `F-${randomUUID().slice(0, 8)}`,
      isDemo,
      issuedAt: new Date(),
      issuedOn: "2027-04-01",
      paymentDueOn: "2027-04-15",
      amountCents: 90000,
      vatRegime: "franchise",
      sellerSnapshot: SNAPSHOT,
      buyerSnapshot: [],
      linesSnapshot: [],
      totalsSnapshot: {},
    })
    .returning();
  const [creditNote] = await tx
    .insert(creditNotes)
    .values({
      organizationId,
      invoiceId: invoice!.id,
      number: `A-${randomUUID().slice(0, 8)}`,
      isDemo,
      issuedAt: new Date(),
      issuedOn: "2027-04-02",
      amountCents: 10000,
      reason: "Geste commercial",
      sellerSnapshot: SNAPSHOT,
      buyerSnapshot: [],
      totalsSnapshot: {},
    })
    .returning();
  return { invoice: invoice!, creditNote: creditNote! };
}

describe("DEV-04 — Factures et avoirs immuables (PostgreSQL réel, rôle applicatif)", () => {
  it("une facture émise ne peut être ni modifiée ni supprimée, même par appel direct", async () => {
    const organizationId = randomUUID();
    const { invoice } = await withOrganization(db, organizationId, (tx) => seedInvoice(tx, organizationId));

    // Pas de droit UPDATE pour le rôle applicatif.
    expect(
      await failure(withOrganization(db, organizationId, (tx) => tx.update(invoices).set({ amountCents: 1 }).where(eq(invoices.id, invoice.id)))),
    ).toMatch(/permission denied/);
    expect(await failure(withOrganization(db, organizationId, (tx) => tx.delete(invoices).where(eq(invoices.id, invoice.id))))).toMatch(
      /immuable/,
    );
    const [row] = await withOrganization(db, organizationId, (tx) => tx.select().from(invoices).where(eq(invoices.id, invoice.id)));
    expect(row?.amountCents).toBe(90000);
  });

  it("un avoir émis est immuable lui aussi", async () => {
    const organizationId = randomUUID();
    const { creditNote } = await withOrganization(db, organizationId, (tx) => seedInvoice(tx, organizationId));
    expect(
      await failure(
        withOrganization(db, organizationId, (tx) => tx.update(creditNotes).set({ reason: "falsifié" }).where(eq(creditNotes.id, creditNote.id))),
      ),
    ).toMatch(/permission denied/);
    expect(await failure(withOrganization(db, organizationId, (tx) => tx.delete(creditNotes).where(eq(creditNotes.id, creditNote.id))))).toMatch(
      /immuable/,
    );
  });

  it("seuls les documents d'un essai guidé se suppriment (purge de l'essai, ADR 0008)", async () => {
    const organizationId = randomUUID();
    const { invoice, creditNote } = await withOrganization(db, organizationId, (tx) => seedInvoice(tx, organizationId, true));
    await withOrganization(db, organizationId, async (tx) => {
      await tx.delete(creditNotes).where(eq(creditNotes.id, creditNote.id));
      await tx.delete(invoices).where(eq(invoices.id, invoice.id));
    });
    expect(await withOrganization(db, organizationId, (tx) => tx.select().from(invoices).where(eq(invoices.id, invoice.id)))).toEqual([]);
  });

  it("une organisation ne lit ni les factures ni les avoirs d'une autre", async () => {
    const own = randomUUID();
    const other = randomUUID();
    await withOrganization(db, other, (tx) => seedInvoice(tx, other));
    expect(await withOrganization(db, own, (tx) => tx.select().from(invoices))).toEqual([]);
    expect(await withOrganization(db, own, (tx) => tx.select().from(creditNotes))).toEqual([]);
    // Sans contexte d'organisation : requête refusée.
    expect(await failure(db.select().from(invoices))).not.toBe("aucune erreur");
  });
});
