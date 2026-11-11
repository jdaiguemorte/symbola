// Lot 23b — FAC-14 : chaque facture, avoir et encaissement est enchaîné au
// précédent par une empreinte calculée par la base ; une modification directe
// en base est détectée par quotes.verify_ledger. JUR-05 : un encaissement ne se
// modifie pas. PostgreSQL réel (socle de dev, base migrée).
import { randomUUID } from "node:crypto";
import { eq, sql as rawSql } from "drizzle-orm";
import postgres from "postgres";
import { afterAll, describe, expect, it } from "vitest";
import { parseAdminEnv } from "../scripts/admin-env";
import { createAppConnection } from "./client";
import { invoices, ledgerEntries, paymentEntries, paymentScheduleItems, quotes, quoteVersions } from "./schema/quotes";
import { withOrganization } from "./with-organization";

const { sql, db } = createAppConnection();
const env = parseAdminEnv(process.env);
const admin = postgres({
  host: env.POSTGRES_HOST,
  port: env.POSTGRES_PORT,
  database: env.POSTGRES_DB,
  username: env.POSTGRES_ADMIN_USER,
  password: env.POSTGRES_ADMIN_PASSWORD,
  max: 1,
  onnotice: () => {},
});

afterAll(async () => {
  await sql.end();
  await admin.end();
});

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function failure(action: Promise<unknown>): Promise<string> {
  try {
    await action;
  } catch (error) {
    return String((error as { cause?: { message?: string } }).cause?.message ?? (error as Error).message);
  }
  return "aucune erreur";
}

async function seedQuote(tx: Tx, organizationId: string, isDemo = false) {
  const [quote] = await tx
    .insert(quotes)
    .values({ organizationId, eventId: randomUUID(), number: `D-${randomUUID().slice(0, 8)}`, createdByUserId: randomUUID(), isDemo })
    .returning();
  const [version] = await tx
    .insert(quoteVersions)
    .values({ organizationId, quoteId: quote!.id, version: 1, totalsSnapshot: { totalTtcCents: 100000 } })
    .returning();
  return { quote: quote!, version: version! };
}

async function seedInvoice(tx: Tx, organizationId: string, isDemo = false) {
  const { quote, version } = await seedQuote(tx, organizationId, isDemo);
  const [invoice] = await tx
    .insert(invoices)
    .values({
      organizationId,
      quoteId: quote.id,
      versionId: version.id,
      kind: "deposit",
      number: `F-${randomUUID().slice(0, 8)}`,
      isDemo,
      issuedAt: new Date("2027-04-10T10:00:00Z"),
      issuedOn: "2027-04-10",
      paymentDueOn: "2027-04-15",
      amountCents: 30000,
      vatRegime: "franchise",
      sellerSnapshot: { organizationName: "Atelier" },
      buyerSnapshot: [{ name: "Inès Martin" }],
      linesSnapshot: [],
      totalsSnapshot: {},
    })
    .returning();
  return invoice!;
}

function entriesOf(organizationId: string) {
  return withOrganization(db, organizationId, (tx) =>
    tx.select().from(ledgerEntries).where(eq(ledgerEntries.organizationId, organizationId)).orderBy(ledgerEntries.sequence),
  );
}

async function anomaliesOf(organizationId: string): Promise<string[]> {
  const rows = await withOrganization(db, organizationId, (tx) =>
    tx.execute(rawSql`select anomaly from quotes.verify_ledger(${organizationId}::uuid)`),
  );
  return [...(rows as unknown as { anomaly: string }[])].map((row) => row.anomaly);
}

describe("FAC-14 — Chaîne d'empreintes des pièces", () => {
  it("chaque pièce s'enchaîne à la précédente ; le rang et l'empreinte viennent de la base ; une pièce d'essai n'y entre pas", async () => {
    const organizationId = randomUUID();
    const first = await withOrganization(db, organizationId, (tx) => seedInvoice(tx, organizationId));
    const second = await withOrganization(db, organizationId, (tx) => seedInvoice(tx, organizationId));
    await withOrganization(db, organizationId, (tx) => seedInvoice(tx, organizationId, true));
    const entries = await entriesOf(organizationId);
    expect(entries.map((entry) => [entry.sequence, entry.entryKind, entry.objectId])).toEqual([
      [1, "invoice", first.id],
      [2, "invoice", second.id],
    ]);
    expect(entries[0]!.previousHash).toBe("0".repeat(64));
    expect(entries[1]!.previousHash).toBe(entries[0]!.hash);
    expect(entries[0]!.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(JSON.stringify(entries)).not.toContain("Inès");
    expect(await anomaliesOf(organizationId)).toEqual([]);
  });

  it("l'app ne choisit ni le rang ni l'empreinte, et ne modifie ni ne supprime une écriture", async () => {
    const organizationId = randomUUID();
    const invoice = await withOrganization(db, organizationId, (tx) => seedInvoice(tx, organizationId));
    await withOrganization(db, organizationId, (tx) =>
      tx.insert(ledgerEntries).values({ organizationId, sequence: 99, entryKind: "original", objectId: invoice.id, payload: {}, previousHash: "faux", hash: "faux" }),
    );
    const [, forged] = await entriesOf(organizationId);
    expect(forged).toMatchObject({ sequence: 2 });
    expect(forged!.hash).not.toBe("faux");
    const update = await failure(withOrganization(db, organizationId, (tx) => tx.update(ledgerEntries).set({ hash: "x" }).where(eq(ledgerEntries.id, forged!.id))));
    expect(update).toMatch(/permission denied|inaltérable/);
    const remove = await failure(withOrganization(db, organizationId, (tx) => tx.delete(ledgerEntries).where(eq(ledgerEntries.id, forged!.id))));
    expect(remove).toMatch(/permission denied|inaltérable/);
  });

  it("deux pièces émises en même temps prennent deux rangs consécutifs", async () => {
    const organizationId = randomUUID();
    await Promise.all(Array.from({ length: 6 }, () => withOrganization(db, organizationId, (tx) => seedInvoice(tx, organizationId))));
    expect((await entriesOf(organizationId)).map((entry) => entry.sequence)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(await anomaliesOf(organizationId)).toEqual([]);
  });

  it("détecte une facture modifiée directement en base, déclencheurs contournés", async () => {
    const organizationId = randomUUID();
    const invoice = await withOrganization(db, organizationId, (tx) => seedInvoice(tx, organizationId));
    await admin.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`update quotes.invoices set amount_cents = 1 where id = ${invoice.id}`;
    });
    expect(await anomaliesOf(organizationId)).toEqual(["object_altered"]);
  });

  it("détecte une écriture modifiée, puis une écriture recalculée qui rompt le maillon suivant", async () => {
    const organizationId = randomUUID();
    await withOrganization(db, organizationId, (tx) => seedInvoice(tx, organizationId));
    await withOrganization(db, organizationId, (tx) => seedInvoice(tx, organizationId));
    const [first] = await entriesOf(organizationId);
    await admin.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`update quotes.ledger_entries set payload = payload || '{"amountCents": 1}'::jsonb where id = ${first!.id}`;
    });
    expect(await anomaliesOf(organizationId)).toEqual(expect.arrayContaining(["entry_altered", "object_altered"]));
    await admin.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`update quotes.ledger_entries set hash = quotes.ledger_hash(previous_hash, sequence, entry_kind, object_id, payload) where id = ${first!.id}`;
    });
    expect(await anomaliesOf(organizationId)).toEqual(expect.arrayContaining(["broken_link"]));
  });

  it("détecte une pièce supprimée et une pièce entrée sans écriture", async () => {
    const organizationId = randomUUID();
    const invoice = await withOrganization(db, organizationId, (tx) => seedInvoice(tx, organizationId));
    await admin.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`delete from quotes.invoices where id = ${invoice.id}`;
    });
    expect(await anomaliesOf(organizationId)).toEqual(["object_missing"]);

    const other = randomUUID();
    const { quote, version } = await withOrganization(db, other, (tx) => seedQuote(tx, other));
    await admin.begin(async (tx) => {
      await tx`set local session_replication_role = replica`;
      await tx`insert into quotes.invoices (organization_id, quote_id, version_id, kind, number, issued_at, issued_on, payment_due_on, amount_cents, vat_regime, seller_snapshot, buyer_snapshot, lines_snapshot, totals_snapshot)
        values (${other}, ${quote.id}, ${version.id}, 'deposit', 'F-HORS-CHAINE', now(), '2027-04-10', '2027-04-15', 100, 'franchise', '{}', '[]', '[]', '{}')`;
    });
    expect(await anomaliesOf(other)).toEqual(["object_unchained"]);
  });

  it("une organisation ne lit pas la chaîne d'une autre", async () => {
    const organizationA = randomUUID();
    const organizationB = randomUUID();
    await withOrganization(db, organizationB, (tx) => seedInvoice(tx, organizationB));
    const seen = await withOrganization(db, organizationA, (tx) => tx.select().from(ledgerEntries).where(eq(ledgerEntries.organizationId, organizationB)));
    expect(seen).toEqual([]);
  });
});

describe("JUR-05 — Encaissements en ajout seul", () => {
  async function seedItem(tx: Tx, organizationId: string, isDemo = false) {
    const { version } = await seedQuote(tx, organizationId, isDemo);
    const [item] = await tx
      .insert(paymentScheduleItems)
      .values({ organizationId, versionId: version.id, label: "Acompte", percentageBasisPoints: 3000, dueDate: "2027-04-15" })
      .returning();
    return item!;
  }

  it("un encaissement s'enchaîne ; il ne se modifie ni ne se supprime ; une annulation exige un motif", async () => {
    const organizationId = randomUUID();
    const entry = await withOrganization(db, organizationId, async (tx) => {
      const item = await seedItem(tx, organizationId);
      const [received] = await tx
        .insert(paymentEntries)
        .values({ organizationId, scheduleItemId: item.id, kind: "received", amountCents: 30000, paidOn: "2027-04-12", paymentMethodLabel: "Virement" })
        .returning();
      return received!;
    });
    expect((await entriesOf(organizationId)).map((row) => row.entryKind)).toEqual(["payment"]);
    expect(await failure(withOrganization(db, organizationId, (tx) => tx.update(paymentEntries).set({ amountCents: 1 }).where(eq(paymentEntries.id, entry.id))))).toMatch(
      /permission denied|ajout seul/,
    );
    expect(await failure(withOrganization(db, organizationId, (tx) => tx.delete(paymentEntries).where(eq(paymentEntries.id, entry.id))))).toContain("ajout seul");
    const noReason = await failure(
      withOrganization(db, organizationId, (tx) =>
        tx.insert(paymentEntries).values({ organizationId, scheduleItemId: entry.scheduleItemId, kind: "reversal", amountCents: 30000, reversesEntryId: entry.id, reason: " " }),
      ),
    );
    expect(noReason).toMatch(/payment_entries_reversal_check/);
  });

  it("une écriture d'essai part avec son échéance, sans entrer dans la chaîne", async () => {
    const organizationId = randomUUID();
    const itemId = await withOrganization(db, organizationId, async (tx) => {
      const item = await seedItem(tx, organizationId, true);
      await tx.insert(paymentEntries).values({ organizationId, scheduleItemId: item.id, kind: "received", amountCents: 30000, paidOn: "2027-04-12", isDemo: true });
      return item.id;
    });
    expect(await entriesOf(organizationId)).toEqual([]);
    await withOrganization(db, organizationId, (tx) => tx.delete(paymentScheduleItems).where(eq(paymentScheduleItems.id, itemId)));
    expect(await withOrganization(db, organizationId, (tx) => tx.select().from(paymentEntries).where(eq(paymentEntries.scheduleItemId, itemId)))).toEqual([]);
  });
});
