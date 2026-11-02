// RGPD-03 — demande d'oubli contre de vrais modules (PostgreSQL réel) :
// aperçu (supprimée, anonymisée, conservée avec motif légal et date de fin),
// exécution par chaque module avec accusé, demande close seulement quand tous
// ont répondu, statistiques intactes, personne introuvable ensuite par la
// recherche transverse (hors données conservées par la loi) ; isolation.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { eventClientAccesses, eventClients, events, eventVendorSlots, programItems } from "@symbola/db/schema/events";
import { users } from "@symbola/db/schema/hub";
import { invoices, quotes, quoteSigners, quoteVersions, signatureRequests } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import type { PersonTerms, PrivacyContractV1 } from "@symbola/privacy";
import { listBudgetLines, updateBudgetLine } from "@/modules/budget/service";
import { addEventTask, addEventVendorSlot, createProspect, createProspectSource, eventsPrivacy } from "@/modules/events/service";
import { budgetPrivacy } from "@/modules/budget/service";
import { createPrivacyRequest, getPrivacyErasure, hubPrivacy, listPrivacyRequests, PrivacyErasureInvalidError, PrivacyErasureNotFoundError } from "@/modules/hub/service";
import { quotesPrivacy } from "@/modules/quotes/service";
import { executeErasure, previewErasure, retryErasure } from "./erasure";
import { recordKey } from "./export";
import { searchPerson } from "./search";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function createPlanner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `planner-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  const source = await createProspectSource(organization.id, "Instagram");
  return { organizationId: organization.id, userId: user.id, sourceId: source.id };
}

type Planner = Awaited<ReturnType<typeof createPlanner>>;

// Mariage : client, tâche, poste avec prestataire, ligne de budget, note
// interne au programme, devis (signé ou non) avec la mariée comme signataire,
// et, si signé, une facture d'acompte à son nom.
async function seedWedding(planner: Planner, firstName: string, lastName: string, signed: boolean) {
  const { id: eventId } = await createProspect({
    organizationId: planner.organizationId,
    createdByUserId: planner.userId,
    prospectSourceId: planner.sourceId,
    clients: [{ firstName, lastName }],
    eventDate: "2027-06-12",
  });
  await addEventTask(planner.organizationId, eventId, { label: `Appeler ${firstName}`, dueDate: "2027-01-15", responsible: "planner" });
  const slot = await addEventVendorSlot(planner.organizationId, eventId, "Traiteur");
  await updateBudgetLine({ organizationId: planner.organizationId, eventId, eventVendorSlotId: slot.id, field: "planned", amountCents: 800000, changedByUserId: planner.userId });
  await withOrganization(db, planner.organizationId, async (tx) => {
    await tx.update(events).set({ venueName: "Château des Lilas", venueCity: "Senlis" }).where(eq(events.id, eventId));
    await tx.update(eventVendorSlots).set({ vendorName: "Traiteur Dupont" }).where(eq(eventVendorSlots.id, slot.id));
    await tx.insert(programItems).values({ organizationId: planner.organizationId, eventId, label: "Cérémonie", startTime: "15:00", internalNote: `${firstName} ${lastName} arrive en retard` });
    const [quote] = await tx
      .insert(quotes)
      .values({ organizationId: planner.organizationId, eventId, number: `D-2027-${randomUUID().slice(0, 4)}`, status: signed ? "signed" : "sent", createdByUserId: planner.userId })
      .returning();
    const [version] = await tx.insert(quoteVersions).values({ organizationId: planner.organizationId, quoteId: quote!.id, version: 1 }).returning();
    const [request] = await tx
      .insert(signatureRequests)
      .values({
        organizationId: planner.organizationId,
        versionId: version!.id,
        provider: "fake",
        externalId: randomUUID(),
        status: signed ? "completed" : "pending",
        completedAt: signed ? new Date("2026-03-10T10:00:00Z") : null,
      })
      .returning();
    await tx.insert(quoteSigners).values({
      organizationId: planner.organizationId,
      requestId: request!.id,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}@example.org`,
      billingAddress: "1 rue des Lilas, 75011 Paris",
      signingUrl: "https://signature.invalid/s/x",
      status: signed ? "signed" : "pending",
    });
    if (signed) {
      await tx.insert(invoices).values({
        organizationId: planner.organizationId,
        quoteId: quote!.id,
        versionId: version!.id,
        kind: "deposit",
        number: `F-2026-${randomUUID().slice(0, 4)}`,
        issuedAt: new Date("2026-03-11T10:00:00Z"),
        issuedOn: "2026-03-11",
        paymentDueOn: "2026-03-11",
        amountCents: 150000,
        vatRegime: "franchise",
        sellerSnapshot: {},
        buyerSnapshot: [{ name: `${firstName} ${lastName}`, billingAddress: "1 rue des Lilas, 75011 Paris" }],
        linesSnapshot: [],
        totalsSnapshot: {},
      });
    }
  });
  return eventId;
}

async function erasureRequest(planner: Planner, person: string) {
  return createPrivacyRequest(db, { ...planner, type: "erasure", personLabel: person, receivedOn: "2026-11-02", now: new Date("2026-11-02T11:00:00Z") });
}

async function everything(planner: Planner, terms: PersonTerms) {
  const found = await searchPerson({ organizationId: planner.organizationId, terms });
  return found!.records.map(recordKey);
}

describe("RGPD-03 — Demande d'oubli", { timeout: 30_000 }, () => {
  it("Quand elle traite une demande d'oubli, alors l'aperçu classe chaque donnée ; une facture et un devis signé sont conservés avec motif légal et date de fin", async () => {
    const planner = await createPlanner();
    const lastName = `Durand${randomUUID().slice(0, 6)}`;
    await seedWedding(planner, "Élodie", lastName, true);
    const terms = { name: `Élodie ${lastName}` };
    const preview = await previewErasure({ organizationId: planner.organizationId, terms, selectedKeys: await everything(planner, terms) });
    expect(preview.status).toBe("ok");
    if (preview.status !== "ok") return;
    const fate = (kind: string) => preview.items.filter((item) => item.kind === kind).map((item) => [item.fate, item.legalBasis, item.keptUntil]);
    expect(fate("invoice")).toEqual([["kept", "accounting", "2036-03-11"]]);
    expect(fate("quote_signer")).toEqual([["kept", "contract_proof", "2031-03-10"]]);
    expect(fate("quote")).toEqual([["kept", "contract_proof", "2031-03-10"]]);
    expect(fate("event_client")).toEqual([["anonymized", null, null]]);
    expect(fate("event")).toEqual([["anonymized", null, null]]);
    expect(fate("task")).toEqual([["deleted", null, null]]);
    expect(fate("program_item")).toEqual([["deleted", null, null]]);
    expect(fate("budget_line")).toEqual([["anonymized", null, null]]);
    // Chaque fiche porte son libellé, pour que la titulaire vérifie l'aperçu.
    expect(preview.items.find((item) => item.kind === "event_client")?.label).toBe(`Élodie ${lastName}`);
  });

  it("Quand elle valide, chaque module exécute sa part ; les statistiques restent justes ; nom, e-mail et notes sont introuvables, y compris par la recherche ; la demande est close", async () => {
    const planner = await createPlanner();
    const lastName = `Martin${randomUUID().slice(0, 6)}`;
    const eventId = await seedWedding(planner, "Chloé", lastName, false);
    const request = await erasureRequest(planner, `Chloé ${lastName}`);
    const terms = { name: `Chloé ${lastName}` };
    const before = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(events).where(eq(events.id, eventId)));

    const result = await executeErasure({ organizationId: planner.organizationId, userId: planner.userId, requestId: request.id, terms, selectedKeys: await everything(planner, terms) });
    expect(result).toMatchObject({ status: "ok", erasureStatus: "completed" });
    if (result.status !== "ok") return;

    // Accusés de chaque module concerné, demande close.
    const erasure = await getPrivacyErasure(db, planner.organizationId, result.erasureId);
    expect(erasure.acks.map((ack) => [ack.module, ack.status]).sort()).toEqual([
      ["budget", "ok"],
      ["events", "ok"],
      ["quotes", "ok"],
    ]);
    expect(erasure.completedAt).not.toBeNull();
    expect((await listPrivacyRequests(db, planner.organizationId)).find((candidate) => candidate.id === request.id)?.status).toBe("closed");

    // Introuvable, par le nom comme par l'e-mail.
    expect((await searchPerson({ organizationId: planner.organizationId, terms }))!.records).toEqual([]);
    expect((await searchPerson({ organizationId: planner.organizationId, terms: { email: "chloé@example.org" } }))!.records).toEqual([]);

    // Statistiques justes : statut, source, montants ; date ramenée au mois, lieu effacé.
    const [after] = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(events).where(eq(events.id, eventId)));
    expect(after).toMatchObject({ status: before[0]!.status, prospectSourceId: planner.sourceId, eventDate: "2027-06-01", venueName: null, venueCity: null });
    expect((await listBudgetLines(planner.organizationId, eventId)).lines.map((line) => line.plannedAmountCents)).toEqual([800000]);
    const [client] = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventClients).where(eq(eventClients.eventId, eventId)));
    expect(client).toMatchObject({ firstName: "[anonymisé]", lastName: null });
    const signers = await withOrganization(db, planner.organizationId, (tx) => tx.select().from(quoteSigners));
    expect(signers.every((signer) => signer.name === "[anonymisé]" && signer.email.endsWith("@anonymise.invalid") && signer.signingUrl === "")).toBe(true);
  });

  it("une facture conservée reste trouvable (conservation légale) ; le reste ne l'est plus", async () => {
    const planner = await createPlanner();
    const lastName = `Bernard${randomUUID().slice(0, 6)}`;
    await seedWedding(planner, "Inès", lastName, true);
    const request = await erasureRequest(planner, `Inès ${lastName}`);
    const terms = { name: `Inès ${lastName}` };
    await executeErasure({ organizationId: planner.organizationId, userId: planner.userId, requestId: request.id, terms, selectedKeys: await everything(planner, terms) });
    const direct = (await searchPerson({ organizationId: planner.organizationId, terms }))!.records.filter((record) => record.direct).map((record) => record.kind).sort();
    expect(direct).toEqual(["invoice", "quote_signer"]);
  });

  it("le compte d'accès d'un marié est supprimé, avec son accès à l'événement", async () => {
    const planner = await createPlanner();
    const lastName = `Leroy${randomUUID().slice(0, 6)}`;
    const eventId = await seedWedding(planner, "Zoé", lastName, false);
    const email = `zoe-${randomUUID().slice(0, 6)}@example.org`;
    const account = await createUser(db, { organizationId: planner.organizationId, email, password: "mot-de-passe-marie", role: "client" });
    await withOrganization(db, planner.organizationId, (tx) =>
      tx.insert(eventClientAccesses).values({ organizationId: planner.organizationId, eventId, email, userId: account.id, expiresAt: new Date(), invitedByUserId: planner.userId, acceptedAt: new Date() }),
    );
    const request = await erasureRequest(planner, `Zoé ${lastName}`);
    const terms = { email };
    const keys = await everything(planner, terms);
    expect(keys.some((key) => key.startsWith("hub:client_account:"))).toBe(true);
    expect(keys.some((key) => key.startsWith("events:client_access:"))).toBe(true);
    const result = await executeErasure({ organizationId: planner.organizationId, userId: planner.userId, requestId: request.id, terms, selectedKeys: keys });
    expect(result).toMatchObject({ status: "ok", erasureStatus: "completed" });
    expect(await db.select().from(users).where(eq(users.id, account.id))).toEqual([]);
    expect(await withOrganization(db, planner.organizationId, (tx) => tx.select().from(eventClientAccesses).where(eq(eventClientAccesses.eventId, eventId)))).toEqual([]);
    expect((await searchPerson({ organizationId: planner.organizationId, terms }))!.records).toEqual([]);
  });

  it("Étant donné un module qui n'accuse pas réception, alors la demande reste ouverte ; la relance termine et clôt", async () => {
    const planner = await createPlanner();
    const lastName = `Petit${randomUUID().slice(0, 6)}`;
    await seedWedding(planner, "Léa", lastName, false);
    const request = await erasureRequest(planner, `Léa ${lastName}`);
    const terms = { name: `Léa ${lastName}` };
    const failingQuotes: PrivacyContractV1 = { ...quotesPrivacy, erase: () => Promise.reject(new Error("indisponible")) };
    const participants = [
      { contract: hubPrivacy, moduleKey: null },
      { contract: eventsPrivacy, moduleKey: "events" as const },
      { contract: budgetPrivacy, moduleKey: "budget" as const },
      { contract: failingQuotes, moduleKey: "quotes" as const },
    ];
    const result = await executeErasure(
      { organizationId: planner.organizationId, userId: planner.userId, requestId: request.id, terms, selectedKeys: await everything(planner, terms) },
      { participants },
    );
    expect(result).toMatchObject({ status: "ok", erasureStatus: "partial" });
    if (result.status !== "ok") return;
    expect((await listPrivacyRequests(db, planner.organizationId)).find((candidate) => candidate.id === request.id)?.status).toBe("open");
    // Une seconde exécution pour la même demande est refusée tant que la première n'est pas terminée.
    await expect(
      executeErasure({ organizationId: planner.organizationId, userId: planner.userId, requestId: request.id, terms: { name: `Léa ${lastName}` }, selectedKeys: await everything(planner, terms) }),
    ).rejects.toThrow(PrivacyErasureInvalidError);

    expect(await retryErasure({ organizationId: planner.organizationId, erasureId: result.erasureId })).toBe("completed");
    expect((await listPrivacyRequests(db, planner.organizationId)).find((candidate) => candidate.id === request.id)?.status).toBe("closed");
    expect((await searchPerson({ organizationId: planner.organizationId, terms }))!.records).toEqual([]);
  });
});

describe("RGPD-03 — Isolation de l'oubli", { timeout: 30_000 }, () => {
  it("organisation A n'efface pas les fiches de B, ne rattache pas à une demande de B et ne lit pas ses preuves", async () => {
    const plannerA = await createPlanner();
    const plannerB = await createPlanner();
    const lastName = `Roux${randomUUID().slice(0, 6)}`;
    await seedWedding(plannerA, "Manon", lastName, false);
    await seedWedding(plannerB, "Manon", lastName, false);
    const terms = { name: `Manon ${lastName}` };
    const requestA = await erasureRequest(plannerA, `Manon ${lastName}`);
    const requestB = await erasureRequest(plannerB, `Manon ${lastName}`);
    const keysB = await everything(plannerB, terms);

    expect(await executeErasure({ organizationId: plannerA.organizationId, userId: plannerA.userId, requestId: requestA.id, terms, selectedKeys: keysB })).toEqual({ status: "changed" });
    await expect(
      executeErasure({ organizationId: plannerA.organizationId, userId: plannerA.userId, requestId: requestB.id, terms, selectedKeys: await everything(plannerA, terms) }),
    ).rejects.toThrow(PrivacyErasureInvalidError);
    const resultB = await executeErasure({ organizationId: plannerB.organizationId, userId: plannerB.userId, requestId: requestB.id, terms, selectedKeys: keysB });
    if (resultB.status !== "ok") throw new Error("exécution de B attendue");
    await expect(getPrivacyErasure(db, plannerA.organizationId, resultB.erasureId)).rejects.toThrow(PrivacyErasureNotFoundError);
    // Les données de A sont intactes.
    expect((await searchPerson({ organizationId: plannerA.organizationId, terms }))!.records.length).toBeGreaterThan(0);
  });
});
