// Lot 52 (HUB-04, HUB-05, SEC-02, SEC-08 ; ADR 0094) — révocation, transfert de propriété, comptable,
// sessions et appareils, alertes de nouvel appareil et de changement d'identité. PostgreSQL réel ;
// le fournisseur d'identité est remplacé par un adaptateur simulé.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { identityChangeAlerts, memberships, users } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { identityWebhookDeliveryKey, mfaFactorsFingerprint } from "./identity/webhook";
import { markIdentityAlertSent, recordIdentityChange } from "./identity-changes";
import { confirmOwnershipTransfer, describeOwnershipTransfer, findPendingOwnershipTransfer, OWNERSHIP_TRANSFER_TTL_MS, requestOwnershipTransfer } from "./ownership";
import { createOrganization, createUser, requireUser, signInWithIdentity } from "./service";
import { closeAccountSession, closeAllAccountSessions, disownDeviceAlert, isDeviceAlertTokenValid, listAccountSessions } from "./sessions";
import { removeMember, revokeOtherSessions } from "./team";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

const SAFARI_IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1";
const FIREFOX_MAC = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14.7; rv:132.0) Gecko/20100101 Firefox/132.0";

async function organizationWith() {
  const organization = await createOrganization(db, `Atelier ${randomUUID()}`);
  const make = async (role: "owner" | "member" | "accountant", label: string) => {
    const email = `${label}-${randomUUID()}@example.test`;
    const user = await createUser(db, { organizationId: organization.id, email, role });
    return { id: user.id, email, subject: `sub-${user.id}` };
  };
  return {
    organizationId: organization.id,
    owner: await make("owner", "proprietaire"),
    planner: await make("member", "planner"),
    accountant: await make("accountant", "comptable"),
  };
}

async function signIn(account: { email: string; subject: string }, options: { mfa?: boolean; deviceId?: string; userAgent?: string; now?: Date } = {}) {
  const outcome = await signInWithIdentity(
    db,
    { subject: account.subject, email: account.email, mfa: options.mfa ?? true },
    { device: { id: options.deviceId ?? null, userAgent: options.userAgent ?? FIREFOX_MAC }, ...(options.now ? { now: options.now } : {}) },
  );
  if (outcome.outcome !== "signed_in") throw new Error("session attendue");
  return outcome;
}

async function audit(organizationId: string, action: string) {
  return withOrganization(db, organizationId, (tx) => tx.select().from(auditEntries).where(and(eq(auditEntries.organizationId, organizationId), eq(auditEntries.action, action))));
}

describe("HUB-04 — Révocation d'un membre", () => {
  it("un membre révoqué est refusé à sa requête suivante, sans attendre : sa session Symbola est supprimée", async () => {
    const { organizationId, owner, planner } = await organizationWith();
    const session = await signIn(planner);
    expect((await requireUser(db, session.sessionToken)).status).toBe("authenticated");
    const closed: string[] = [];
    const outcome = await removeMember(db, { organizationId, userId: planner.id, removedByUserId: owner.id, closeProviderSessions: async (subject) => closed.push(subject) });
    expect(outcome).toBe("removed");
    // Contrôle à chaque requête : la suivante est refusée (critère : moins d'une minute).
    expect((await requireUser(db, session.sessionToken)).status).toBe("unauthenticated");
    // Ses sessions chez le fournisseur sont fermées (adaptateur simulé).
    expect(closed).toEqual([planner.subject]);
  });

  it("le Comptable se révoque comme une Planner ; un échec du fournisseur ne rend pas l'accès", async () => {
    const { organizationId, owner, accountant } = await organizationWith();
    const session = await signIn(accountant);
    const outcome = await removeMember(db, {
      organizationId,
      userId: accountant.id,
      removedByUserId: owner.id,
      closeProviderSessions: async () => {
        throw new Error("fournisseur injoignable");
      },
    });
    expect(outcome).toBe("removed");
    expect((await requireUser(db, session.sessionToken)).status).toBe("unauthenticated");
  });

  it("un compte qui garde une autre organisation garde ses sessions chez le fournisseur", async () => {
    const first = await organizationWith();
    const second = await createOrganization(db, `Autre ${randomUUID()}`);
    await db.insert(memberships).values({ userId: first.planner.id, organizationId: second.id, role: "member" });
    await signIn(first.planner);
    const closed: string[] = [];
    await removeMember(db, { organizationId: first.organizationId, userId: first.planner.id, removedByUserId: first.owner.id, closeProviderSessions: async (subject) => closed.push(subject) });
    expect(closed).toEqual([]);
  });

  it("la Propriétaire ne se révoque pas ; un membre ne révoque personne d'une autre organisation", async () => {
    const { organizationId, owner } = await organizationWith();
    const other = await organizationWith();
    expect(await removeMember(db, { organizationId, userId: owner.id, removedByUserId: owner.id })).toBe("not_removable");
    expect(await removeMember(db, { organizationId, userId: other.planner.id, removedByUserId: owner.id })).toBe("not_found");
  });
});

describe("HUB-04 (D1) — Transfert de propriété", () => {
  it("vers une Planner qui a la double authentification, confirmé par elle : rôles échangés, journal d'audit", async () => {
    const { organizationId, owner, planner } = await organizationWith();
    const requested = await requestOwnershipTransfer(db, { organizationId, fromUserId: owner.id, toUserId: planner.id, toHasMfa: true });
    if (requested.outcome !== "requested") throw new Error("demande attendue");
    expect(requested.toEmail).toBe(planner.email);
    expect(await findPendingOwnershipTransfer(db, organizationId)).toMatchObject({ toUserId: planner.id });
    expect(await describeOwnershipTransfer(db, requested.token)).toMatchObject({ organizationId, fromUserId: owner.id, toUserId: planner.id });

    expect(await confirmOwnershipTransfer(db, { token: requested.token, userId: planner.id, mfaVerified: true })).toEqual({ outcome: "transferred", organizationId, fromUserId: owner.id, toUserId: planner.id });
    const roles = await db.select({ userId: memberships.userId, role: memberships.role }).from(memberships).where(eq(memberships.organizationId, organizationId));
    expect(roles.find((row) => row.userId === owner.id)?.role).toBe("member");
    expect(roles.find((row) => row.userId === planner.id)?.role).toBe("owner");
    expect(await audit(organizationId, "hub.ownership.transfer_requested")).toHaveLength(1);
    expect(await audit(organizationId, "hub.ownership.transferred")).toHaveLength(1);
    // Usage unique.
    expect((await confirmOwnershipTransfer(db, { token: requested.token, userId: planner.id, mfaVerified: true })).outcome).toBe("invalid");
  });

  it("refusé vers une Planner sans double authentification, vers le Comptable, ou par une Planner", async () => {
    const { organizationId, owner, planner, accountant } = await organizationWith();
    expect((await requestOwnershipTransfer(db, { organizationId, fromUserId: owner.id, toUserId: planner.id, toHasMfa: false })).outcome).toBe("mfa_missing");
    expect((await requestOwnershipTransfer(db, { organizationId, fromUserId: owner.id, toUserId: accountant.id, toHasMfa: true })).outcome).toBe("not_planner");
    expect((await requestOwnershipTransfer(db, { organizationId, fromUserId: planner.id, toUserId: owner.id, toHasMfa: true })).outcome).toBe("not_owner");
  });

  it("seule la Planner désignée confirme, dans une session à double authentification, avant sept jours (horloge simulée)", async () => {
    const { organizationId, owner, planner, accountant } = await organizationWith();
    const now = new Date("2027-03-01T10:00:00Z");
    const requested = await requestOwnershipTransfer(db, { organizationId, fromUserId: owner.id, toUserId: planner.id, toHasMfa: true, now });
    if (requested.outcome !== "requested") throw new Error("demande attendue");
    expect((await confirmOwnershipTransfer(db, { token: requested.token, userId: accountant.id, mfaVerified: true, now })).outcome).toBe("not_recipient");
    expect((await confirmOwnershipTransfer(db, { token: requested.token, userId: planner.id, mfaVerified: false, now })).outcome).toBe("mfa_required");
    const lastMoment = new Date(now.getTime() + OWNERSHIP_TRANSFER_TTL_MS - 1);
    expect(await describeOwnershipTransfer(db, requested.token, lastMoment)).not.toBeNull();
    const expired = new Date(now.getTime() + OWNERSHIP_TRANSFER_TTL_MS);
    expect((await confirmOwnershipTransfer(db, { token: requested.token, userId: planner.id, mfaVerified: true, now: expired })).outcome).toBe("invalid");
  });

  it("une nouvelle demande remplace la précédente ; le lien d'une Planner retirée entre-temps ne vaut plus", async () => {
    const { organizationId, owner, planner } = await organizationWith();
    const first = await requestOwnershipTransfer(db, { organizationId, fromUserId: owner.id, toUserId: planner.id, toHasMfa: true });
    const second = await requestOwnershipTransfer(db, { organizationId, fromUserId: owner.id, toUserId: planner.id, toHasMfa: true });
    if (first.outcome !== "requested" || second.outcome !== "requested") throw new Error("demandes attendues");
    expect(await describeOwnershipTransfer(db, first.token)).toBeNull();
    await removeMember(db, { organizationId, userId: planner.id, removedByUserId: owner.id });
    expect((await confirmOwnershipTransfer(db, { token: second.token, userId: planner.id, mfaVerified: true })).outcome).toBe("invalid");
  });
});

describe("HUB-04 — Comptable : double authentification exigée", () => {
  it("une session du Comptable sans second facteur attend la double authentification", async () => {
    const { accountant } = await organizationWith();
    const session = await signIn(accountant, { mfa: false });
    expect(session.requiresMfa).toBe(true);
    expect(await requireUser(db, session.sessionToken)).toMatchObject({ status: "mfa_required", role: "accountant" });
    const verified = await signIn(accountant, { mfa: true });
    expect(await requireUser(db, verified.sessionToken)).toMatchObject({ status: "authenticated", user: { role: "accountant" } });
  });

  it("une Planner sans second facteur entre (la double authentification lui est proposée, pas exigée)", async () => {
    const { planner } = await organizationWith();
    const session = await signIn(planner, { mfa: false });
    expect(session.requiresMfa).toBe(false);
    expect((await requireUser(db, session.sessionToken)).status).toBe("authenticated");
  });
});

describe("HUB-05 — Sessions et appareils", () => {
  it("l'utilisateur voit chacune de ses sessions (appareil, dernière activité, « cet appareil »), sans adresse IP", async () => {
    const { planner } = await organizationWith();
    const laptop = await signIn(planner, { userAgent: FIREFOX_MAC });
    const phone = await signIn(planner, { userAgent: SAFARI_IPHONE });
    const listed = await listAccountSessions(db, { userId: planner.id, currentSessionToken: phone.sessionToken });
    expect(listed).toHaveLength(2);
    expect(listed[0]).toMatchObject({ current: true, device: { browser: "safari", system: "iphone" } });
    expect(listed[1]).toMatchObject({ current: false, device: { browser: "firefox", system: "mac" } });
    expect(Object.keys(listed[0]!).sort()).toEqual(["createdAt", "current", "device", "id", "lastSeenAt"]);
    expect(laptop.deviceId).not.toBe(phone.deviceId);
  });

  it("« Fermer » une session : elle est refusée à sa requête suivante ; la session d'un autre compte répond comme inexistante", async () => {
    const { planner, owner } = await organizationWith();
    const laptop = await signIn(planner);
    const phone = await signIn(planner, { userAgent: SAFARI_IPHONE });
    const [, other] = await listAccountSessions(db, { userId: planner.id, currentSessionToken: phone.sessionToken });
    expect(await closeAccountSession(db, { userId: owner.id, sessionId: other!.id })).toEqual({ status: "not_found" });
    expect(await closeAccountSession(db, { userId: planner.id, sessionId: other!.id })).toEqual({ status: "closed", remaining: 1 });
    expect((await requireUser(db, laptop.sessionToken)).status).toBe("unauthenticated");
    expect((await requireUser(db, phone.sessionToken)).status).toBe("authenticated");
  });

  it("« Fermer toutes les autres » garde seulement celle en cours", async () => {
    const { planner } = await organizationWith();
    const first = await signIn(planner);
    const second = await signIn(planner);
    const current = await signIn(planner);
    expect(await revokeOtherSessions(db, { userId: planner.id, currentSessionToken: current.sessionToken })).toBe(2);
    for (const session of [first, second]) expect((await requireUser(db, session.sessionToken)).status).toBe("unauthenticated");
    expect(await listAccountSessions(db, { userId: planner.id, currentSessionToken: current.sessionToken })).toHaveLength(1);
  });
});

describe("SEC-08 — Alerte de nouvel appareil", () => {
  it("le premier appareil d'un compte est retenu sans alerte ; un appareil connu non plus ; un nouvel appareil, si", async () => {
    const { planner } = await organizationWith();
    const first = await signIn(planner);
    expect(first.newDevice).toBeNull();
    const again = await signIn(planner, { deviceId: first.deviceId });
    expect(again.newDevice).toBeNull();
    const phone = await signIn(planner, { userAgent: SAFARI_IPHONE });
    expect(phone.newDevice).toMatchObject({ deviceLabel: "safari/iphone" });
    expect(await isDeviceAlertTokenValid(db, phone.newDevice!.alertToken)).toBe(true);
  });

  it("« Ce n'est pas moi » ferme toutes les sessions du compte ; le lien ne sert qu'une fois", async () => {
    const { planner } = await organizationWith();
    const first = await signIn(planner);
    const intruder = await signIn(planner, { userAgent: SAFARI_IPHONE });
    const disowned = await disownDeviceAlert(db, intruder.newDevice!.alertToken);
    expect(disowned).toMatchObject({ userId: planner.id, idpSubject: planner.subject });
    expect(await closeAllAccountSessions(db, { userId: planner.id, reason: "not_me" })).toBe(2);
    for (const session of [first, intruder]) expect((await requireUser(db, session.sessionToken)).status).toBe("unauthenticated");
    expect(await disownDeviceAlert(db, intruder.newDevice!.alertToken)).toBeNull();
  });

  it("le lien « Ce n'est pas moi » expire après sept jours (horloge simulée)", async () => {
    const { planner } = await organizationWith();
    const now = new Date("2027-03-01T10:00:00Z");
    await signIn(planner, { now });
    const intruder = await signIn(planner, { userAgent: SAFARI_IPHONE, now });
    const later = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    expect(await isDeviceAlertTokenValid(db, intruder.newDevice!.alertToken, later)).toBe(false);
    expect(await disownDeviceAlert(db, intruder.newDevice!.alertToken, later)).toBeNull();
  });
});

describe("SEC-08 (D6) — Changement d'identité annoncé par le webhook", () => {
  it("un changement d'adresse alerte l'ancienne adresse, puis l'oublie une fois l'alerte envoyée ; un appel rejoué ne crée rien", async () => {
    const { planner } = await organizationWith();
    // Le compte est relié au fournisseur à sa première connexion.
    await signIn(planner);
    const fresh = `nouvelle-${randomUUID()}@example.test`;
    const deliveryKey = identityWebhookDeliveryKey(`appel-${randomUUID()}`);
    const alerts = await recordIdentityChange(db, { deliveryKey, subject: planner.subject, kind: "data_updated", primaryEmail: fresh, factorsFingerprint: null });
    expect(alerts).toEqual([{ alertId: expect.any(String), userId: planner.id, kind: "email", to: planner.email }]);
    const [account] = await db.select({ email: users.email }).from(users).where(eq(users.id, planner.id));
    expect(account!.email).toBe(fresh);
    expect(await recordIdentityChange(db, { deliveryKey, subject: planner.subject, kind: "data_updated", primaryEmail: fresh, factorsFingerprint: null })).toEqual([]);
    await markIdentityAlertSent(db, alerts[0]!.alertId);
    const [row] = await db.select().from(identityChangeAlerts).where(eq(identityChangeAlerts.id, alerts[0]!.alertId));
    expect(row).toMatchObject({ previousEmail: null, kind: "email" });
    expect(row!.sentAt).not.toBeNull();
  });

  it("un facteur ajouté ou retiré alerte (la première empreinte est retenue sans alerte) ; un mot de passe réinitialisé aussi", async () => {
    const { planner } = await organizationWith();
    await signIn(planner);
    const key = () => identityWebhookDeliveryKey(randomUUID());
    const one = mfaFactorsFingerprint([{ id: "f1", type: "Totp" }]);
    const two = mfaFactorsFingerprint([{ id: "f1", type: "Totp" }, { id: "f2", type: "WebAuthn" }]);
    expect(await recordIdentityChange(db, { deliveryKey: key(), subject: planner.subject, kind: "data_updated", primaryEmail: planner.email, factorsFingerprint: one })).toEqual([]);
    expect(await recordIdentityChange(db, { deliveryKey: key(), subject: planner.subject, kind: "data_updated", primaryEmail: planner.email, factorsFingerprint: one })).toEqual([]);
    expect((await recordIdentityChange(db, { deliveryKey: key(), subject: planner.subject, kind: "data_updated", primaryEmail: planner.email, factorsFingerprint: two })).map((alert) => alert.kind)).toEqual(["mfa"]);
    expect((await recordIdentityChange(db, { deliveryKey: key(), subject: planner.subject, kind: "password_reset" })).map((alert) => [alert.kind, alert.to])).toEqual([["password", planner.email]]);
  });

  it("un compte inconnu de Symbola est ignoré", async () => {
    expect(await recordIdentityChange(db, { deliveryKey: randomUUID(), subject: `inconnu-${randomUUID()}`, kind: "password_reset" })).toEqual([]);
  });
});
