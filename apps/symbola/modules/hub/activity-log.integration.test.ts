// Lot 23 — HUB-16 : journal d'activité de l'organisation, lisible par la
// titulaire : qui, quoi, quand, sur quel objet. Filtres par période, famille et
// personne ; isolation entre organisations ; essais guidés exclus.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { appendAudit, recordAudit } from "@symbola/db/audit";
import { createAppConnection } from "@symbola/db/client";
import { withOrganization } from "@symbola/db/with-organization";
import { listActivityLog, parseActivityFilters } from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function organizationWithOwner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const owner = await createUser(db, { organizationId: organization.id, email: `titulaire-${randomUUID()}@example.test`, password: "mot-de-passe-de-test", role: "owner" });
  return { organizationId: organization.id, ownerId: owner.id, ownerEmail: owner.email };
}

const ALL = { periodDays: null, category: null, actorId: null, page: 1 };

// Les accès d'exploitation (sans organisation) se lisent dans chaque journal,
// y compris ceux écrits par d'autres tests : ici, seules comptent les lignes
// de l'organisation.
const ownLines = (log: Awaited<ReturnType<typeof listActivityLog>>) => log.entries.filter((entry) => entry.category !== "exploitation");

describe("HUB-16 — Journal d'activité de l'organisation", () => {
  it("qui, quoi, quand, sur quel objet : l'auteur est nommé, l'objet et son détail sont là", async () => {
    const { organizationId, ownerId, ownerEmail } = await organizationWithOwner();
    const quoteId = randomUUID();
    await withOrganization(db, organizationId, (tx) =>
      appendAudit(tx, { organizationId, action: "quotes.quote.sent", objectId: quoteId, details: { number: "D-2027-0001", version: 1 }, actor: { kind: "member", id: ownerId } }),
    );
    const log = await listActivityLog(db, organizationId, ALL);
    expect(ownLines(log)).toMatchObject([
      { action: "quotes.quote.sent", category: "partage", actorKind: "member", actorLabel: ownerEmail, objectType: "quote", objectId: quoteId, details: { number: "D-2027-0001" } },
    ]);
    expect(log.people).toEqual([{ id: ownerId, label: ownerEmail }]);
  });

  it("filtre par période, par famille et par personne ; les plus récentes d'abord", async () => {
    const { organizationId, ownerId } = await organizationWithOwner();
    const other = randomUUID();
    await withOrganization(db, organizationId, async (tx) => {
      await appendAudit(tx, { organizationId, action: "quotes.invoice.issued", actor: { kind: "member", id: ownerId } });
      await appendAudit(tx, { organizationId, action: "hub.session.opened", actor: { kind: "member", id: other } });
    });
    // Vu dans 40 jours, ce qui date d'aujourd'hui sort des 30 derniers jours.
    const later = new Date(Date.now() + 40 * 24 * 60 * 60 * 1000);
    expect(ownLines(await listActivityLog(db, organizationId, { ...ALL, periodDays: 30, now: later }))).toEqual([]);
    expect(ownLines(await listActivityLog(db, organizationId, { ...ALL, periodDays: 30 }))).toHaveLength(2);
    expect((await listActivityLog(db, organizationId, { ...ALL, category: "emission" })).entries.map((entry) => entry.action)).toEqual(["quotes.invoice.issued"]);
    expect((await listActivityLog(db, organizationId, { ...ALL, actorId: other })).entries.map((entry) => entry.action)).toEqual(["hub.session.opened"]);
    expect(ownLines(await listActivityLog(db, organizationId, ALL)).map((entry) => entry.action)).toEqual(["hub.session.opened", "quotes.invoice.issued"]);
  });

  it("montre les accès d'exploitation de la plateforme ; ni le journal d'une autre organisation, ni les lignes d'un essai", async () => {
    const own = await organizationWithOwner();
    const foreign = await organizationWithOwner();
    const marker = `contrôle ${randomUUID()}`;
    await recordAudit(db, { organizationId: null, action: "ops.database.opened", reason: marker, actor: { kind: "operator", id: null } });
    await recordAudit(db, { organizationId: foreign.organizationId, action: "quotes.quote.sent" });
    await recordAudit(db, { organizationId: own.organizationId, action: "quotes.quote.sent", isDemo: true });
    const log = await listActivityLog(db, own.organizationId, { ...ALL, category: null });
    expect(log.entries.some((entry) => entry.action === "ops.database.opened" && entry.reason === marker && entry.actorKind === "operator")).toBe(true);
    expect(log.entries.filter((entry) => entry.action === "quotes.quote.sent")).toEqual([]);
  });

  it("lit les filtres de l'adresse sans jamais faire confiance à une valeur inattendue", () => {
    expect(parseActivityFilters({})).toEqual({ periodDays: 30, category: null, actorId: null, page: 1 });
    expect(parseActivityFilters({ periode: "tout", famille: "emission", page: "3" })).toMatchObject({ periodDays: null, category: "emission", page: 3 });
    expect(parseActivityFilters({ periode: "12", famille: "'; drop", personne: "x", page: "-2" })).toEqual({ periodDays: 30, category: null, actorId: null, page: 1 });
  });
});
