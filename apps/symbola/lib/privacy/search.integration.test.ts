// RGPD-01 — recherche transverse contre de vrais modules (PostgreSQL réel) :
// les données d'une personne sont rassemblées depuis chaque module souscrit,
// avec celles de ses événements ; un module en échec ou trop lent rend le
// résultat incomplet ; un module non souscrit n'est pas interrogé ; une
// autre organisation n'est jamais lue.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { invoices, quotes, quoteSigners, quoteVersions, signatureRequests } from "@symbola/db/schema/quotes";
import { withOrganization } from "@symbola/db/with-organization";
import type { PrivacyContractV1 } from "@symbola/privacy";
import { updateBudgetLine } from "@/modules/budget/service";
import { addEventTask, addEventVendorSlot, createProspect, createProspectSource } from "@/modules/events/service";
import { budgetPrivacy } from "@/modules/budget/service";
import { eventsPrivacy } from "@/modules/events/service";
import { hubPrivacy, setModuleEnabled } from "@/modules/hub/service";
import { quotesPrivacy } from "@/modules/quotes/service";
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

// Un mariage complet : client, tâche, poste et ligne de budget, devis signé
// par la mariée (signataire), facture à son nom.
async function seedWedding(planner: Planner, firstName: string, lastName: string) {
  const { id: eventId } = await createProspect({
    organizationId: planner.organizationId,
    createdByUserId: planner.userId,
    prospectSourceId: planner.sourceId,
    clients: [{ firstName, lastName }],
    eventDate: "2027-06-12",
  });
  await addEventTask(planner.organizationId, eventId, { label: "Réserver le traiteur", dueDate: "2027-01-15", responsible: "planner" });
  const slot = await addEventVendorSlot(planner.organizationId, eventId, "Traiteur");
  await updateBudgetLine({ organizationId: planner.organizationId, eventId, eventVendorSlotId: slot.id, field: "planned", amountCents: 800000, changedByUserId: planner.userId });
  await withOrganization(db, planner.organizationId, async (tx) => {
    const [quote] = await tx
      .insert(quotes)
      .values({ organizationId: planner.organizationId, eventId, number: `D-2027-${randomUUID().slice(0, 4)}`, status: "signed", createdByUserId: planner.userId })
      .returning();
    const [version] = await tx.insert(quoteVersions).values({ organizationId: planner.organizationId, quoteId: quote!.id, version: 1 }).returning();
    const [request] = await tx
      .insert(signatureRequests)
      .values({ organizationId: planner.organizationId, versionId: version!.id, provider: "fake", externalId: randomUUID(), status: "completed" })
      .returning();
    await tx.insert(quoteSigners).values({
      organizationId: planner.organizationId,
      requestId: request!.id,
      name: `${firstName} ${lastName}`,
      email: `${firstName.toLowerCase()}@example.org`,
      billingAddress: "1 rue des Lilas, 75011 Paris",
      signingUrl: "https://signature.invalid/s/x",
      status: "signed",
    });
    await tx.insert(invoices).values({
      organizationId: planner.organizationId,
      quoteId: quote!.id,
      versionId: version!.id,
      kind: "deposit",
      number: `F-2027-${randomUUID().slice(0, 4)}`,
      issuedAt: new Date(),
      issuedOn: "2027-01-10",
      paymentDueOn: "2027-01-10",
      amountCents: 150000,
      vatRegime: "franchise",
      sellerSnapshot: {},
      buyerSnapshot: [{ name: `${firstName} ${lastName}`, billingAddress: "1 rue des Lilas, 75011 Paris" }],
      linesSnapshot: [],
      totalsSnapshot: {},
    });
  });
  return eventId;
}

describe("RGPD-01 — Recherche transverse", () => {
  it("Quand la titulaire cherche une personne, alors le hub interroge chaque module et rassemble toutes ses données, groupées par module", async () => {
    const planner = await createPlanner();
    const firstName = `Élodie${randomUUID().slice(0, 6)}`;
    const eventId = await seedWedding(planner, firstName, "Durand");

    const result = await searchPerson({ organizationId: planner.organizationId, terms: { name: `${firstName} Durand` } });
    expect(result?.complete).toBe(true);
    const direct = result!.records.filter((record) => record.direct).map((record) => `${record.module}:${record.kind}`).sort();
    expect(direct).toEqual(["events:event_client", "quotes:invoice", "quotes:quote_signer"]);
    // Données de son événement : fiche, tâche, postes, budget, devis.
    const related = new Set(result!.records.filter((record) => !record.direct).map((record) => `${record.module}:${record.kind}`));
    for (const kind of ["events:event", "events:task", "events:event_vendor_slot", "events:status_change", "budget:budget_line", "quotes:quote"]) {
      expect(related.has(kind), kind).toBe(true);
    }
    expect(result!.records.every((record) => record.eventId === null || record.eventId === eventId)).toBe(true);
    expect(result!.outcomes.map((outcome) => outcome.module).sort()).toEqual(["budget", "events", "hello", "hub", "quotes", "vendors"]);
  });

  it("par e-mail : l'adresse du signataire mène au devis et à l'événement", async () => {
    const planner = await createPlanner();
    const firstName = `Ines${randomUUID().slice(0, 6)}`;
    await seedWedding(planner, firstName, "Moreau");
    const result = await searchPerson({ organizationId: planner.organizationId, terms: { email: `${firstName.toLowerCase()}@example.org` } });
    expect(result!.records.filter((record) => record.direct).map((record) => record.kind)).toEqual(["quote_signer"]);
    expect(result!.records.some((record) => record.kind === "event_client")).toBe(false);
    expect(result!.records.some((record) => record.kind === "event")).toBe(true);
  });

  it("Étant donné un module qui ne répond pas, alors le résultat l'indique comme incomplet, jamais comme « aucune donnée »", async () => {
    const planner = await createPlanner();
    const failing: PrivacyContractV1 = {
      module: "quotes",
      find: () => Promise.reject(new Error("base indisponible")),
      related: () => Promise.resolve([]),
      planErasure: () => Promise.resolve([]),
      erase: () => Promise.resolve([]),
    };
    const slow: PrivacyContractV1 = {
      module: "budget",
      find: () => new Promise((resolve) => setTimeout(() => resolve([]), 500)),
      related: () => Promise.resolve([]),
      planErasure: () => Promise.resolve([]),
      erase: () => Promise.resolve([]),
    };
    const result = await searchPerson(
      { organizationId: planner.organizationId, terms: { name: "Personne Introuvable" } },
      {
        participants: [
          { contract: eventsPrivacy, moduleKey: "events" },
          { contract: failing, moduleKey: "quotes" },
          { contract: slow, moduleKey: "budget" },
        ],
        timeoutMs: 50,
      },
    );
    expect(result).toMatchObject({ complete: false, records: [] });
    expect(result!.outcomes).toEqual([
      { module: "events", status: "ok" },
      { module: "quotes", status: "failed" },
      { module: "budget", status: "failed" },
    ]);
  });

  it("un module non souscrit n'est pas interrogé (dégradation propre)", async () => {
    const planner = await createPlanner();
    const firstName = `Chloe${randomUUID().slice(0, 6)}`;
    await seedWedding(planner, firstName, "Petit");
    const admin = await createUser(db, { organizationId: null, email: `admin-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "admin" });
    await setModuleEnabled(db, { adminUserId: admin.id, organizationId: planner.organizationId, moduleKey: "quotes", enabled: false });

    const result = await searchPerson({ organizationId: planner.organizationId, terms: { name: `${firstName} Petit` } });
    expect(result!.records.some((record) => record.module === "quotes")).toBe(false);
    expect(result!.outcomes.some((outcome) => outcome.module === "quotes")).toBe(false);
    expect(result!.complete).toBe(true);
  });

  it("le compte d'accès d'un marié est trouvé par son e-mail (hub)", async () => {
    const planner = await createPlanner();
    const email = `marie-${randomUUID()}@example.org`;
    await createUser(db, { organizationId: planner.organizationId, email, password: "mot-de-passe", role: "client" });
    const result = await searchPerson({ organizationId: planner.organizationId, terms: { email } });
    expect(result!.records.map((record) => `${record.module}:${record.kind}`)).toEqual(["hub:client_account"]);
  });

  it("sans terme exploitable, aucune recherche n'est lancée", async () => {
    const planner = await createPlanner();
    expect(await searchPerson({ organizationId: planner.organizationId, terms: { name: "a" } })).toBeNull();
  });
});

describe("RGPD-01 — La recherche ne porte que sur l'organisation de la titulaire", () => {
  it("une personne de l'organisation B n'est jamais trouvée depuis A, dans aucun module", async () => {
    const plannerA = await createPlanner();
    const plannerB = await createPlanner();
    const firstName = `Lea${randomUUID().slice(0, 6)}`;
    await seedWedding(plannerB, firstName, "Martin");
    const email = `${firstName.toLowerCase()}@example.org`;
    await createUser(db, { organizationId: plannerB.organizationId, email: `compte-${email}`, password: "mot-de-passe", role: "client" });

    const fromA = await searchPerson({ organizationId: plannerA.organizationId, terms: { name: `${firstName} Martin`, email } });
    expect(fromA).toMatchObject({ complete: true, records: [] });
    for (const contract of [eventsPrivacy, budgetPrivacy, quotesPrivacy, hubPrivacy]) {
      expect(await contract.find({ organizationId: plannerA.organizationId, terms: { name: `${firstName} Martin`, email } })).toEqual([]);
    }
    const fromB = await searchPerson({ organizationId: plannerB.organizationId, terms: { name: `${firstName} Martin` } });
    expect(fromB!.records.length).toBeGreaterThan(0);
  });
});
