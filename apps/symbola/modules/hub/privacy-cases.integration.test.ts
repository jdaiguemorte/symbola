// Lot 18 (RGPD-07, ADR 0047) — dossier d'une demande contre un vrai
// PostgreSQL (RLS) : étapes dans l'ordre, clôture seulement quand l'action est
// faite et la réponse envoyée, isolation entre organisations.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  closePrivacyRequest,
  createPrivacyRequest,
  getPrivacyCase,
  markPrivacyActionDone,
  markPrivacyResponseSent,
  PrivacyRequestInvalidError,
  PrivacyRequestNotFoundError,
} from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

async function createOwner() {
  const organization = await createOrganization(db, `Org ${randomUUID()}`);
  const user = await createUser(db, { organizationId: organization.id, email: `owner-${randomUUID()}@symbola.test`, password: "mot-de-passe", role: "owner" });
  return { organizationId: organization.id, userId: user.id };
}

const today = new Date().toISOString().slice(0, 10);

describe("RGPD-07 — Une demande, un dossier suivi de bout en bout", () => {
  it("une rectification : action faite, puis réponse envoyée, puis clôture ; chaque jalon est daté et le dossier avance", async () => {
    const owner = await createOwner();
    const request = await createPrivacyRequest(db, { ...owner, type: "rectification", personLabel: "Inès Martin", receivedOn: today });
    expect((await getPrivacyCase(db, owner.organizationId, request.id)).current).toBe("found");

    await markPrivacyActionDone(db, { organizationId: owner.organizationId, requestId: request.id });
    const afterAction = await getPrivacyCase(db, owner.organizationId, request.id);
    expect(afterAction).toMatchObject({ actionKind: "manual", actionDone: true, current: "response", canClose: false });
    expect(afterAction.request.actionDoneAt).not.toBeNull();

    await markPrivacyResponseSent(db, { organizationId: owner.organizationId, requestId: request.id });
    expect((await getPrivacyCase(db, owner.organizationId, request.id)).canClose).toBe(true);

    await closePrivacyRequest(db, { organizationId: owner.organizationId, requestId: request.id });
    const closed = await getPrivacyCase(db, owner.organizationId, request.id);
    expect(closed.request).toMatchObject({ status: "closed" });
    expect(Object.values(closed.steps).every((state) => state === "done")).toBe(true);
  });

  it("la clôture est refusée tant que l'action n'est pas faite, puis tant que la réponse n'est pas envoyée", async () => {
    const owner = await createOwner();
    const request = await createPrivacyRequest(db, { ...owner, type: "objection", personLabel: "Hugo Bernard", receivedOn: today });
    await expect(closePrivacyRequest(db, { organizationId: owner.organizationId, requestId: request.id })).rejects.toMatchObject({ code: "action_missing" });
    await expect(markPrivacyResponseSent(db, { organizationId: owner.organizationId, requestId: request.id })).rejects.toMatchObject({ code: "action_missing" });
    await markPrivacyActionDone(db, { organizationId: owner.organizationId, requestId: request.id });
    await expect(closePrivacyRequest(db, { organizationId: owner.organizationId, requestId: request.id })).rejects.toMatchObject({ code: "response_missing" });
  });

  it("un oubli ou un accès ne se marquent pas faits à la main : ils passent par l'effacement ou l'export", async () => {
    const owner = await createOwner();
    for (const type of ["erasure", "access", "portability"] as const) {
      const request = await createPrivacyRequest(db, { ...owner, type, personLabel: `Personne ${type}`, receivedOn: today });
      await expect(markPrivacyActionDone(db, { organizationId: owner.organizationId, requestId: request.id })).rejects.toBeInstanceOf(PrivacyRequestInvalidError);
      expect((await getPrivacyCase(db, owner.organizationId, request.id)).actionDone).toBe(false);
    }
  });
});

describe("RGPD-07 — Isolation des dossiers", () => {
  it("organisation A ne lit, ne fait avancer ni ne clôt le dossier d'une demande de B", async () => {
    const ownerA = await createOwner();
    const ownerB = await createOwner();
    const request = await createPrivacyRequest(db, { ...ownerB, type: "rectification", personLabel: "Personne de B", receivedOn: today });
    await expect(getPrivacyCase(db, ownerA.organizationId, request.id)).rejects.toBeInstanceOf(PrivacyRequestNotFoundError);
    await expect(markPrivacyActionDone(db, { organizationId: ownerA.organizationId, requestId: request.id })).rejects.toBeInstanceOf(PrivacyRequestNotFoundError);
    await expect(markPrivacyResponseSent(db, { organizationId: ownerA.organizationId, requestId: request.id })).rejects.toBeInstanceOf(PrivacyRequestNotFoundError);
    await expect(closePrivacyRequest(db, { organizationId: ownerA.organizationId, requestId: request.id })).rejects.toBeInstanceOf(PrivacyRequestNotFoundError);
    expect((await getPrivacyCase(db, ownerB.organizationId, request.id)).request).toMatchObject({ status: "open", actionDoneAt: null });
  });
});
