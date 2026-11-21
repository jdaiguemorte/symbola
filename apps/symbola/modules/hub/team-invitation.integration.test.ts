// Lot 33b (HUB-03, D12) — la Propriétaire invite une Planner, contre un vrai PostgreSQL : lien de
// sept jours à usage unique (horloge simulée), adhésion de Planner à l'adresse invitée, jamais de
// Propriétaire, une organisation seulement ; l'Exploitation ne voit pas ces invitations.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createOrganization, createUser, listTeam, removeMember } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { auditEntries } from "@symbola/db/schema/core";
import { invitations, memberships, users } from "@symbola/db/schema/hub";
import { withOrganization } from "@symbola/db/with-organization";
import { listOrganizationsSupport } from "./admin-support";
import { acceptInvitation, createTeamInvitation, describeInvitation, listPendingTeamInvitations, TEAM_INVITATION_DURATION_MS } from "./service";

const { sql, db } = createAppConnection();
// L'invitation est acceptée à l'horloge réelle : une date figée la faisait expirer sept jours plus tard
// (le test est tombé le 21/11/2026 à 11 h). L'instant de l'envoi est donc celui du test.
const NOW = new Date();
const MINUTE = 60 * 1000;

afterAll(async () => {
  await sql.end();
});

async function organizationWithOwner() {
  const organization = await createOrganization(db, `Atelier ${randomUUID()}`);
  const owner = await createUser(db, { organizationId: organization.id, email: `titulaire-${randomUUID()}@symbola.test`, role: "owner" });
  return { organizationId: organization.id, ownerId: owner.id };
}

async function invite(organizationId: string, ownerId: string, email = `planner-${randomUUID()}@symbola.test`, now = new Date()) {
  const result = await createTeamInvitation(db, { organizationId, email, invitedByUserId: ownerId, now });
  if (result.outcome !== "invited") throw new Error(`invitation attendue : ${result.outcome}`);
  return { ...result, email: email.toLowerCase() };
}

async function organizationsOf(email: string): Promise<string[]> {
  const rows = await db.select({ organizationId: memberships.organizationId }).from(memberships).innerJoin(users, eq(users.id, memberships.userId)).where(eq(users.email, email));
  return rows.map((row) => row.organizationId);
}

describe("HUB-03 — Propriétaire et Planner : ajouter une Planner", () => {
  it("l'invitation crée, à l'acceptation, une adhésion de Planner pour l'adresse invitée, compte créé si besoin", async () => {
    const { organizationId, ownerId } = await organizationWithOwner();
    const { token, email, expiresAt } = await invite(organizationId, ownerId, `Camille.${randomUUID()}@Symbola.test`, NOW);
    expect(expiresAt.getTime() - NOW.getTime()).toBe(TEAM_INVITATION_DURATION_MS);
    expect(TEAM_INVITATION_DURATION_MS).toBe(7 * 24 * 60 * MINUTE);
    expect(await acceptInvitation(db, { token })).toMatchObject({ outcome: "success", organizationId, email });
    expect((await listTeam(db, organizationId)).find((member) => member.email === email)).toMatchObject({ role: "member", disabledAt: null });
    // Le journal garde le geste et le rôle, jamais l'adresse (SEC-20).
    const rows = await withOrganization(db, organizationId, (tx) => tx.select().from(auditEntries).where(eq(auditEntries.organizationId, organizationId)));
    expect(rows.map((row) => row.action)).toEqual(expect.arrayContaining(["hub.invitation.sent", "hub.invitation.accepted"]));
    expect(JSON.stringify(rows)).not.toContain(email);
  });

  it("à usage unique : une deuxième acceptation ne fait rien de plus", async () => {
    const { organizationId, ownerId } = await organizationWithOwner();
    const { token } = await invite(organizationId, ownerId);
    expect((await acceptInvitation(db, { token })).outcome).toBe("success");
    expect((await acceptInvitation(db, { token })).outcome).toBe("already_accepted");
    expect(await describeInvitation(db, token)).toBeNull();
  });

  it("valable sept jours : encore ouverte une minute avant, refusée une minute après (horloge simulée)", async () => {
    const { organizationId, ownerId } = await organizationWithOwner();
    const fresh = await invite(organizationId, ownerId, undefined, new Date(Date.now() - TEAM_INVITATION_DURATION_MS + MINUTE));
    expect(await describeInvitation(db, fresh.token)).not.toBeNull();
    const old = await invite(organizationId, ownerId, undefined, new Date(Date.now() - TEAM_INVITATION_DURATION_MS - MINUTE));
    expect(await describeInvitation(db, old.token)).toBeNull();
    expect((await acceptInvitation(db, { token: old.token })).outcome).toBe("invalid_or_expired");
  });

  it("élévation de rôle impossible : une invitation de Planner ne donne jamais le rôle de Propriétaire", async () => {
    const { organizationId, ownerId } = await organizationWithOwner();
    const { token, invitationId } = await invite(organizationId, ownerId);
    const [stored] = await db.select({ role: invitations.role }).from(invitations).where(eq(invitations.id, invitationId));
    expect(stored!.role).toBe("member");
    await acceptInvitation(db, { token });
    expect((await listTeam(db, organizationId)).filter((member) => member.role === "owner").map((member) => member.id)).toEqual([ownerId]);
  });

  it("accès croisé : l'invitation de A n'ouvre rien chez B", async () => {
    const a = await organizationWithOwner();
    const b = await organizationWithOwner();
    const { token, email } = await invite(a.organizationId, a.ownerId);
    await acceptInvitation(db, { token });
    expect(await organizationsOf(email)).toEqual([a.organizationId]);
    expect((await listTeam(db, b.organizationId)).map((member) => member.email)).not.toContain(email);
    expect(await listPendingTeamInvitations(db, b.organizationId)).toEqual([]);
  });

  it("une adresse déjà dans l'équipe n'est pas invitée de nouveau ; une Planner retirée peut l'être, et retrouve l'accès", async () => {
    const { organizationId, ownerId } = await organizationWithOwner();
    const first = await invite(organizationId, ownerId);
    await acceptInvitation(db, { token: first.token });
    expect((await createTeamInvitation(db, { organizationId, email: first.email, invitedByUserId: ownerId })).outcome).toBe("already_member");
    expect((await createTeamInvitation(db, { organizationId, email: "pas-une-adresse", invitedByUserId: ownerId })).outcome).toBe("invalid_email");
    const planner = (await listTeam(db, organizationId)).find((member) => member.email === first.email)!;
    await removeMember(db, { organizationId, userId: planner.id, removedByUserId: ownerId });
    const again = await invite(organizationId, ownerId, first.email);
    await acceptInvitation(db, { token: again.token });
    expect((await listTeam(db, organizationId)).find((member) => member.id === planner.id)).toMatchObject({ role: "member", disabledAt: null });
  });

  it("les invitations en attente se listent pour la Propriétaire ; l'assistance de l'Exploitation ne les voit pas", async () => {
    const { organizationId, ownerId } = await organizationWithOwner();
    const { email } = await invite(organizationId, ownerId);
    expect((await listPendingTeamInvitations(db, organizationId)).map((entry) => entry.email)).toEqual([email]);
    const support = (await listOrganizationsSupport(db)).find((organization) => organization.id === organizationId)!;
    expect(support.pendingInvitations).toEqual([]);
  });
});
