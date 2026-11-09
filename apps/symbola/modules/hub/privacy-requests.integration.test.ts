// RGPD-04 — suivi des demandes d'exercice de droits, contre un vrai
// PostgreSQL et avec une horloge simulée : échéance d'un mois, alerte à moins
// de 7 jours (la veille et le jour du seuil), prolongation à trois mois avec
// motif obligatoire, clôture ; réglages chargés du modèle de départ ;
// isolation entre organisations.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import {
  closePrivacyRequest,
  markPrivacyActionDone,
  markPrivacyResponseSent,
  createPrivacyRequest,
  extendPrivacyRequest,
  getPrivacySettings,
  listDueSoonPrivacyRequests,
  listPrivacyRequests,
  PrivacyRequestInvalidError,
  PrivacyRequestNotFoundError,
  updatePrivacySettings,
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

// Midi à Paris, pour une date donnée.
function at(date: string): Date {
  return new Date(`${date}T11:00:00Z`);
}

describe("RGPD-04 — Suivi des demandes", () => {
  it("Chaque demande a un type, une date de réception, une échéance légale d'un mois et un statut", async () => {
    const owner = await createOwner();
    const request = await createPrivacyRequest(db, {
      ...owner,
      type: "erasure",
      personLabel: "  Élodie Durand (e-mail du 2 novembre)  ",
      receivedOn: "2026-11-02",
      now: at("2026-11-02"),
    });
    expect(request).toMatchObject({
      type: "erasure",
      personLabel: "Élodie Durand (e-mail du 2 novembre)",
      receivedOn: "2026-11-02",
      dueOn: "2026-12-02",
      status: "open",
      daysLeft: 30,
      dueSoon: false,
    });
    // Reçue le 31 janvier : échéance au dernier jour de février.
    expect((await createPrivacyRequest(db, { ...owner, type: "access", personLabel: "Inès", receivedOn: "2027-01-31", now: at("2027-02-01") })).dueOn).toBe("2027-02-28");
  });

  it("une demande sans personne, ou reçue dans le futur, est refusée", async () => {
    const owner = await createOwner();
    await expect(createPrivacyRequest(db, { ...owner, type: "access", personLabel: "  ", receivedOn: "2026-11-02", now: at("2026-11-02") })).rejects.toThrow(
      PrivacyRequestInvalidError,
    );
    await expect(createPrivacyRequest(db, { ...owner, type: "access", personLabel: "Inès", receivedOn: "2026-11-03", now: at("2026-11-02") })).rejects.toThrow(
      PrivacyRequestInvalidError,
    );
  });

  it("Étant donné une échéance à moins de 7 jours, alors la demande apparaît en alerte dans le tableau de bord (pas la veille du seuil)", async () => {
    const owner = await createOwner();
    const request = await createPrivacyRequest(db, { ...owner, type: "rectification", personLabel: "Chloé", receivedOn: "2026-11-02", now: at("2026-11-02") });
    // Échéance le 2 décembre : 7 jours restants le 25 novembre, 6 le 26.
    expect(await listDueSoonPrivacyRequests(db, owner.organizationId, at("2026-11-25"))).toEqual([]);
    expect((await listDueSoonPrivacyRequests(db, owner.organizationId, at("2026-11-26"))).map((view) => [view.id, view.daysLeft])).toEqual([[request.id, 6]]);
    // Le jour même, puis dépassée : toujours en alerte.
    expect((await listDueSoonPrivacyRequests(db, owner.organizationId, at("2026-12-02")))[0]?.daysLeft).toBe(0);
    expect((await listDueSoonPrivacyRequests(db, owner.organizationId, at("2026-12-04")))[0]?.daysLeft).toBe(-2);
    // Close (lot 18 : action faite et réponse envoyée) : plus jamais en alerte.
    await markPrivacyActionDone(db, { organizationId: owner.organizationId, requestId: request.id });
    await markPrivacyResponseSent(db, { organizationId: owner.organizationId, requestId: request.id });
    await closePrivacyRequest(db, { organizationId: owner.organizationId, requestId: request.id, now: at("2026-12-04") });
    expect(await listDueSoonPrivacyRequests(db, owner.organizationId, at("2026-12-04"))).toEqual([]);
    expect((await listPrivacyRequests(db, owner.organizationId, at("2026-12-04")))[0]).toMatchObject({ status: "closed", daysLeft: null, dueSoon: false });
  });

  it("Quand elle prolonge une demande complexe, alors le motif est obligatoire et l'échéance passe à trois mois au total", async () => {
    const owner = await createOwner();
    const request = await createPrivacyRequest(db, { ...owner, type: "portability", personLabel: "Léa", receivedOn: "2026-11-30", now: at("2026-12-01") });
    await expect(extendPrivacyRequest(db, { organizationId: owner.organizationId, requestId: request.id, reason: "   ", now: at("2026-12-01") })).rejects.toThrow(
      PrivacyRequestInvalidError,
    );
    const extended = await extendPrivacyRequest(db, {
      organizationId: owner.organizationId,
      requestId: request.id,
      reason: "Données dans trois modules et deux anciens fichiers",
      now: at("2026-12-20"),
    });
    expect(extended).toMatchObject({ status: "extended", dueOn: "2027-02-28", extensionReason: "Données dans trois modules et deux anciens fichiers" });
    // Une seule prolongation : jamais au-delà de trois mois.
    await expect(extendPrivacyRequest(db, { organizationId: owner.organizationId, requestId: request.id, reason: "encore", now: at("2026-12-21") })).rejects.toThrow(
      PrivacyRequestInvalidError,
    );
  });

  it("les réglages viennent du modèle de départ (alerte à 7 jours) et se modifient ; le seuil suit le réglage", async () => {
    const owner = await createOwner();
    expect(await getPrivacySettings(db, owner.organizationId)).toEqual({
      requestAlertDays: 7,
      prospectRetentionMonths: 36,
      clientRetentionMonths: 36,
      accountingRetentionMonths: 120,
      inactiveAccountMonths: 24,
      signedQuoteRetentionMonths: 60,
      requestProofRetentionMonths: 60,
    });
    await createPrivacyRequest(db, { ...owner, type: "objection", personLabel: "Manon", receivedOn: "2026-11-02", now: at("2026-11-02") });
    await updatePrivacySettings(db, owner.organizationId, { ...(await getPrivacySettings(db, owner.organizationId)), requestAlertDays: 10 });
    expect(await listDueSoonPrivacyRequests(db, owner.organizationId, at("2026-11-23"))).toHaveLength(1);
    await expect(updatePrivacySettings(db, owner.organizationId, { ...(await getPrivacySettings(db, owner.organizationId)), requestAlertDays: 0 })).rejects.toThrow(
      PrivacyRequestInvalidError,
    );
  });
});

describe("RGPD-04 — Isolation des demandes", () => {
  it("organisation A ne voit, ne prolonge ni ne clôt une demande de B, et n'a pas ses réglages", async () => {
    const ownerA = await createOwner();
    const ownerB = await createOwner();
    const request = await createPrivacyRequest(db, { ...ownerB, type: "erasure", personLabel: "Personne de B", receivedOn: "2026-11-02", now: at("2026-11-02") });
    await updatePrivacySettings(db, ownerB.organizationId, { ...(await getPrivacySettings(db, ownerB.organizationId)), requestAlertDays: 20 });

    expect(await listPrivacyRequests(db, ownerA.organizationId, at("2026-11-30"))).toEqual([]);
    expect(await listDueSoonPrivacyRequests(db, ownerA.organizationId, at("2026-11-30"))).toEqual([]);
    await expect(extendPrivacyRequest(db, { organizationId: ownerA.organizationId, requestId: request.id, reason: "x", now: at("2026-11-30") })).rejects.toThrow(
      PrivacyRequestNotFoundError,
    );
    await expect(closePrivacyRequest(db, { organizationId: ownerA.organizationId, requestId: request.id })).rejects.toThrow(PrivacyRequestNotFoundError);
    expect((await getPrivacySettings(db, ownerA.organizationId)).requestAlertDays).toBe(7);
    expect((await listPrivacyRequests(db, ownerB.organizationId, at("2026-11-30")))[0]?.status).toBe("open");
  });
});
