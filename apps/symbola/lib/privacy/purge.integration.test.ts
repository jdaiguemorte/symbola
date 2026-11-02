// RGPD-05 — purge mensuelle contre de vrais modules (PostgreSQL réel), avec
// des dates simulées : prospect sans suite, client, compte de marié inactif,
// facture et devis signé à la fin de leur conservation ; échu le jour même,
// jamais la veille. Rien n'est purgé sans validation ; une exclusion exige un
// motif ; isolation entre organisations.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { eventClients, events } from "@symbola/db/schema/events";
import { users } from "@symbola/db/schema/hub";
import { invoices, paymentScheduleItems, quotes, quoteSigners, quoteVersions, signatureRequests } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import { addMonths, parisDate } from "@symbola/privacy";
import { createProspect, createProspectSource } from "@/modules/events/service";
import { getPrivacyPurge } from "@/modules/hub/service";
import { executePurge, listPurgeCandidates } from "./purge";
import { searchPerson } from "./search";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

const today = parisDate(new Date());

function dayBefore(date: string): string {
  const day = new Date(`${date}T12:00:00Z`);
  day.setUTCDate(day.getUTCDate() - 1);
  return day.toISOString().slice(0, 10);
}

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `planner-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const source = await createProspectSource(organization.id, "Instagram");
  return { organizationId: organization.id, userId: user.id, sourceId: source.id };
}

type Planner = Awaited<ReturnType<typeof createPlanner>>;

async function prospect(planner: Planner, lastName: string) {
  const { id } = await createProspect({
    organizationId: planner.organizationId,
    createdByUserId: planner.userId,
    prospectSourceId: planner.sourceId,
    clients: [{ firstName: "Élodie", lastName }],
    eventDate: "2027-06-12",
  });
  return id;
}

// Client : événement confirmé, devis signé (preuve terminée le 10/03/2026),
// dernier paiement le 01/07/2027, facture émise le 11/03/2026.
async function client(planner: Planner, lastName: string) {
  const eventId = await prospect(planner, lastName);
  return withOrganization(db, planner.organizationId, async (tx) => {
    await tx.update(events).set({ status: "confirmed" }).where(eq(events.id, eventId));
    const [quote] = await tx
      .insert(quotes)
      .values({ organizationId: planner.organizationId, eventId, number: `D-${randomUUID().slice(0, 6)}`, status: "signed", createdByUserId: planner.userId })
      .returning();
    const [version] = await tx.insert(quoteVersions).values({ organizationId: planner.organizationId, quoteId: quote!.id, version: 1 }).returning();
    const [request] = await tx
      .insert(signatureRequests)
      .values({ organizationId: planner.organizationId, versionId: version!.id, provider: "fake", externalId: randomUUID(), status: "completed", completedAt: new Date("2026-03-10T10:00:00Z") })
      .returning();
    await tx.insert(quoteSigners).values({
      organizationId: planner.organizationId,
      requestId: request!.id,
      name: `Élodie ${lastName}`,
      email: "elodie@example.org",
      billingAddress: "1 rue des Lilas",
      signingUrl: "https://signature.invalid/s",
      status: "signed",
    });
    await tx.insert(paymentScheduleItems).values({ organizationId: planner.organizationId, versionId: version!.id, label: "Acompte", amountCents: 100000, dueDate: "2027-07-01", paidOn: "2027-07-01" });
    const [invoice] = await tx
      .insert(invoices)
      .values({
        organizationId: planner.organizationId,
        quoteId: quote!.id,
        versionId: version!.id,
        kind: "deposit",
        number: `F-${randomUUID().slice(0, 6)}`,
        issuedAt: new Date("2026-03-11T10:00:00Z"),
        issuedOn: "2026-03-11",
        paymentDueOn: "2026-03-11",
        amountCents: 100000,
        vatRegime: "franchise",
        sellerSnapshot: {},
        buyerSnapshot: [{ name: `Élodie ${lastName}`, billingAddress: "1 rue des Lilas" }],
        linesSnapshot: [],
        totalsSnapshot: {},
      })
      .returning();
    return { eventId, quoteId: quote!.id, invoiceId: invoice!.id };
  });
}

const keys = async (planner: Planner, day: string) => (await listPurgeCandidates(planner.organizationId, day)).map((candidate) => `${candidate.rule}:${candidate.key}`);

describe("RGPD-05 — Purge mensuelle : liste des données échues (dates simulées)", { timeout: 30_000 }, () => {
  it("prospect sans suite : listé 3 ans après sa dernière activité, le jour même et pas la veille", async () => {
    const planner = await createPlanner();
    const eventId = await prospect(planner, `Durand${randomUUID().slice(0, 4)}`);
    const due = addMonths(today, 36);
    expect(await keys(planner, dayBefore(due))).toEqual([]);
    expect(await keys(planner, due)).toEqual([`prospect:event:${eventId}`]);
  });

  it("client : 3 ans après le dernier encaissement ; facture 10 ans après son émission ; devis signé 5 ans après la signature", async () => {
    const planner = await createPlanner();
    const { eventId, quoteId, invoiceId } = await client(planner, `Martin${randomUUID().slice(0, 4)}`);
    // Fin de la relation : dernier paiement (01/07/2027) plutôt que la date du mariage (12/06/2027).
    expect(await keys(planner, "2030-06-30")).toEqual([]);
    expect(await keys(planner, "2030-07-01")).toEqual([`client:event:${eventId}`]);
    expect(await keys(planner, "2031-03-09")).toEqual([`client:event:${eventId}`]);
    expect(await keys(planner, "2031-03-10")).toEqual([`client:event:${eventId}`, `signed_quote:quote:${quoteId}`]);
    expect(await keys(planner, "2036-03-11")).toContain(`accounting_document:invoice:${invoiceId}`);
    expect(await keys(planner, "2036-03-10")).not.toContain(`accounting_document:invoice:${invoiceId}`);
  });

  it("compte d'un marié : 2 ans sans connexion, à partir de sa création s'il ne s'est jamais connecté", async () => {
    const planner = await createPlanner();
    const account = await createUser(db, { organizationId: planner.organizationId, email: `marie-${randomUUID().slice(0, 6)}@example.org`, password: "mot-de-passe", role: "client" });
    const due = addMonths(today, 24);
    expect(await keys(planner, dayBefore(due))).toEqual([]);
    expect(await keys(planner, due)).toEqual([`inactive_account:account:${account.id}`]);
    // Une connexion repousse l'échéance.
    await db.update(users).set({ lastLoginAt: new Date(`${addMonths(today, 12)}T12:00:00Z`) }).where(eq(users.id, account.id));
    expect(await keys(planner, due)).toEqual([]);
  });
});

describe("RGPD-05 — Purge mensuelle : validation", { timeout: 30_000 }, () => {
  it("Quand elle valide la liste, alors la purge s'exécute ; une ligne exclue l'est avec un motif obligatoire et revient ensuite", async () => {
    const planner = await createPlanner();
    const lostName = `Petit${randomUUID().slice(0, 4)}`;
    const keptName = `Roux${randomUUID().slice(0, 4)}`;
    const toPurge = await prospect(planner, lostName);
    const toKeep = await prospect(planner, keptName);
    const day = addMonths(today, 36);

    // Rien n'est purgé sans validation : la liste ne modifie rien.
    expect(await keys(planner, day)).toHaveLength(2);
    expect((await searchPerson({ organizationId: planner.organizationId, terms: { name: lostName } }))!.records.length).toBeGreaterThan(0);

    // Exclusion sans motif : refusée.
    expect(
      await executePurge({
        organizationId: planner.organizationId,
        userId: planner.userId,
        today: day,
        decisions: [
          { key: `event:${toPurge}`, excluded: false, reason: "" },
          { key: `event:${toKeep}`, excluded: true, reason: "  " },
        ],
      }),
    ).toEqual({ status: "reason_missing" });

    const result = await executePurge({
      organizationId: planner.organizationId,
      userId: planner.userId,
      today: day,
      decisions: [
        { key: `event:${toPurge}`, excluded: false, reason: "" },
        { key: `event:${toKeep}`, excluded: true, reason: "Les mariés ont redemandé un devis" },
      ],
    });
    expect(result).toMatchObject({ status: "ok", purgeStatus: "completed" });
    if (result.status !== "ok") return;

    const purge = await getPrivacyPurge(db, planner.organizationId, result.purgeId);
    expect(purge.period).toBe(day.slice(0, 7));
    expect(purge.lines.map((line) => [line.key, line.outcome, line.exclusionReason])).toEqual([
      [`event:${toPurge}`, "purged", null],
      [`event:${toKeep}`, "excluded", "Les mariés ont redemandé un devis"],
    ]);
    expect(purge.acks.every((ack) => ack.status === "ok")).toBe(true);

    // Purgé : introuvable, statistiques gardées ; l'exclu est intact et revient.
    expect((await searchPerson({ organizationId: planner.organizationId, terms: { name: lostName } }))!.records).toEqual([]);
    const [purgedEvent] = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(events).where(eq(events.id, toPurge)));
    expect(purgedEvent).toMatchObject({ status: "prospect", prospectSourceId: planner.sourceId, eventDate: "2027-06-01" });
    expect((await searchPerson({ organizationId: planner.organizationId, terms: { name: keptName } }))!.records.length).toBeGreaterThan(0);
    expect(await keys(planner, addMonths(day, 1))).toEqual([`prospect:event:${toKeep}`]);
  });

  it("à la fin de la conservation, l'acheteur d'une facture et le signataire d'un devis signé sont anonymisés ; le montant reste", async () => {
    const planner = await createPlanner();
    const lastName = `Blanc${randomUUID().slice(0, 4)}`;
    const { quoteId, invoiceId } = await client(planner, lastName);
    const day = "2036-03-11";
    const result = await executePurge({
      organizationId: planner.organizationId,
      userId: planner.userId,
      today: day,
      decisions: [
        { key: `invoice:${invoiceId}`, excluded: false, reason: "" },
        { key: `quote:${quoteId}`, excluded: false, reason: "" },
      ],
    });
    expect(result).toMatchObject({ status: "ok", purgeStatus: "completed" });
    const [invoice] = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(invoices).where(eq(invoices.id, invoiceId)));
    expect(invoice).toMatchObject({ amountCents: 100000, buyerSnapshot: [{ name: "[anonymisé]", billingAddress: "[anonymisé]" }] });
    const signers = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(quoteSigners));
    expect(signers.map((signer) => signer.name)).toEqual(["[anonymisé]"]);
    // Plus rien d'échu à proposer pour ces documents.
    expect((await keys(planner, day)).filter((key) => key.includes(invoiceId) || key.includes(quoteId))).toEqual([]);
  });

  it("le compte d'un marié inactif est supprimé", async () => {
    const planner = await createPlanner();
    const account = await createUser(db, { organizationId: planner.organizationId, email: `marie-${randomUUID().slice(0, 6)}@example.org`, password: "mot-de-passe", role: "client" });
    const result = await executePurge({
      organizationId: planner.organizationId,
      userId: planner.userId,
      today: addMonths(today, 24),
      decisions: [{ key: `account:${account.id}`, excluded: false, reason: "" }],
    });
    expect(result).toMatchObject({ status: "ok", purgeStatus: "completed" });
    expect(await db.select().from(users).where(eq(users.id, account.id))).toEqual([]);
  });
});

describe("RGPD-05 — Isolation de la purge", { timeout: 30_000 }, () => {
  it("organisation A ne voit ni ne purge les données échues de B", async () => {
    const plannerA = await createPlanner();
    const plannerB = await createPlanner();
    const eventB = await prospect(plannerB, `Faure${randomUUID().slice(0, 4)}`);
    const day = addMonths(today, 36);
    expect(await keys(plannerA, day)).toEqual([]);
    expect(
      await executePurge({ organizationId: plannerA.organizationId, userId: plannerA.userId, today: day, decisions: [{ key: `event:${eventB}`, excluded: false, reason: "" }] }),
    ).toEqual({ status: "empty" });
    const clients = await withOrganization(db, plannerB.organizationId, (tx) => tx.select().from(eventClients).where(eq(eventClients.eventId, eventB)));
    expect(clients[0]?.firstName).toBe("Élodie");
  });
});
