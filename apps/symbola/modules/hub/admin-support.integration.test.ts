// Lot 9 (ADR 0029) — assistance de l'Admin et statistiques d'usage, contre un
// vrai PostgreSQL : état des comptes d'équipe, nouvel envoi d'invitation,
// réinitialisation de la double authentification, nombres mensuels sans
// aucun contenu et essais exclus.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createUser, login, MfaResetNotAllowedError, requireUser } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { auditLog, users } from "@symbola/db/schema/hub";
import { createProspect, createProspectSource, startEventsTrial } from "@/modules/events/service";
import { createQuote } from "@/modules/quotes/service";
import {
  acceptInvitation,
  createOrganizationWithInvitation,
  getOrganizationsActivity,
  InvitationNotPendingError,
  lastMonths,
  listOrganizationsSupport,
  resendInvitation,
  resetTeamAccountMfa,
} from "./service";

const { sql, db } = createAppConnection();
afterAll(async () => {
  await sql.end();
});

async function admin(): Promise<string> {
  return (await createUser(db, { organizationId: null, email: `admin-${randomUUID()}@symbola.test`, password: "mot-de-passe-admin", role: "admin" })).id;
}

async function organizationWithInvitation(adminUserId: string) {
  const email = `titulaire-${randomUUID()}@symbola.test`;
  const created = await createOrganizationWithInvitation(db, {
    adminUserId,
    name: `Org lot 9 ${randomUUID()}`,
    language: "fr",
    siret: null,
    titulaireEmail: email,
  });
  return { ...created, email };
}

describe("Lot 9 — État des comptes et des invitations (Admin)", () => {
  it("montre l'invitation en attente, puis le compte d'équipe et son état ; jamais un compte marié", async () => {
    const adminUserId = await admin();
    const org = await organizationWithInvitation(adminUserId);
    let view = (await listOrganizationsSupport(db)).find((candidate) => candidate.id === org.organizationId)!;
    expect(view.accounts).toEqual([]);
    expect(view.pendingInvitations).toEqual([expect.objectContaining({ email: org.email, expired: false })]);

    expect(await acceptInvitation(db, { token: org.invitationToken, password: "mot-de-passe-titulaire" })).toMatchObject({ outcome: "success" });
    const coupleEmail = `marie-${randomUUID()}@symbola.test`;
    await createUser(db, { organizationId: org.organizationId, email: coupleEmail, password: "mot-de-passe-du-marie", role: "client" });

    view = (await listOrganizationsSupport(db)).find((candidate) => candidate.id === org.organizationId)!;
    expect(view.pendingInvitations).toEqual([]);
    expect(view.accounts).toEqual([expect.objectContaining({ email: org.email, role: "owner", mfaConfigured: false, lockedUntil: null })]);
    expect(JSON.stringify(view)).not.toContain(coupleEmail);
  });

  it("un nouvel envoi remplace le lien : l'ancien ne marche plus, le nouveau oui ; l'action est journalisée", async () => {
    const adminUserId = await admin();
    const org = await organizationWithInvitation(adminUserId);
    const resent = await resendInvitation(db, { adminUserId, invitationId: org.invitationId });
    expect(resent).toMatchObject({ email: org.email, organizationId: org.organizationId, language: "fr" });

    expect(await acceptInvitation(db, { token: org.invitationToken, password: "mot-de-passe-titulaire" })).toEqual({ outcome: "invalid_or_expired" });
    expect(await acceptInvitation(db, { token: resent.token, password: "mot-de-passe-titulaire" })).toMatchObject({ outcome: "success" });
    await expect(resendInvitation(db, { adminUserId, invitationId: org.invitationId })).rejects.toBeInstanceOf(InvitationNotPendingError);

    const logged = await db
      .select()
      .from(auditLog)
      .where(and(eq(auditLog.adminUserId, adminUserId), eq(auditLog.action, "hub.invitation.resent")));
    expect(logged).toHaveLength(1);
  });

  it("réinitialise la double authentification d'un compte d'équipe, journalise le compte visé, refuse un marié", async () => {
    const adminUserId = await admin();
    const org = await organizationWithInvitation(adminUserId);
    await acceptInvitation(db, { token: org.invitationToken, password: "mot-de-passe-titulaire" });
    const [owner] = await db.select().from(users).where(eq(users.email, org.email));
    await db.update(users).set({ totpSecret: "SECRETDEJACONFIGURE", mfaEnabled: true }).where(eq(users.id, owner!.id));
    const session = await login(db, org.email, "mot-de-passe-titulaire");
    if (session.outcome !== "success") throw new Error("connexion attendue");

    expect(await resetTeamAccountMfa(db, { adminUserId, userId: owner!.id })).toMatchObject({ email: org.email });
    expect((await requireUser(db, session.sessionToken)).status).toBe("unauthenticated");
    const [reset] = await db.select().from(users).where(eq(users.id, owner!.id));
    expect(reset).toMatchObject({ totpSecret: null, mfaEnabled: false });
    const [entry] = await db.select().from(auditLog).where(and(eq(auditLog.adminUserId, adminUserId), eq(auditLog.action, "hub.user.mfa_reset")));
    expect(entry).toMatchObject({ targetUserId: owner!.id, targetOrganizationId: org.organizationId });

    const couple = await createUser(db, { organizationId: org.organizationId, email: `marie-${randomUUID()}@symbola.test`, password: "mot-de-passe-du-marie", role: "client" });
    await expect(resetTeamAccountMfa(db, { adminUserId, userId: couple.id })).rejects.toBeInstanceOf(MfaResetNotAllowedError);
  });
});

describe("Lot 9 — Statistiques d'usage par organisation (Admin)", () => {
  it("compte événements et devis réels du mois, sans les essais ni les données d'une autre organisation", async () => {
    const adminUserId = await admin();
    const orgA = await organizationWithInvitation(adminUserId);
    const orgB = await organizationWithInvitation(adminUserId);
    await acceptInvitation(db, { token: orgA.invitationToken, password: "mot-de-passe-titulaire" });
    const [owner] = await db.select().from(users).where(eq(users.email, orgA.email));
    await login(db, orgA.email, "mot-de-passe-titulaire");

    const source = await createProspectSource(orgA.organizationId, "Salon");
    const event = await createProspect({ organizationId: orgA.organizationId, createdByUserId: owner!.id, prospectSourceId: source.id, clients: [{ firstName: "Inès" }] });
    await createProspect({ organizationId: orgA.organizationId, createdByUserId: owner!.id, prospectSourceId: source.id, clients: [{ firstName: "Lou" }] });
    await createQuote({ organizationId: orgA.organizationId, eventId: event.id, createdByUserId: owner!.id });
    await startEventsTrial({ organizationId: orgA.organizationId, userId: owner!.id, locale: "fr" });
    const sourceB = await createProspectSource(orgB.organizationId, "Salon");
    await createProspect({ organizationId: orgB.organizationId, createdByUserId: owner!.id, prospectSourceId: sourceB.id, clients: [{ firstName: "Zoé" }] });

    const activity = await getOrganizationsActivity(db, { organizationIds: [orgA.organizationId, orgB.organizationId] });
    const a = activity.find((candidate) => candidate.id === orgA.organizationId)!;
    const thisMonth = a.months.at(-1)!;
    expect(a.months).toHaveLength(6);
    expect(a.events.find((row) => row.month === thisMonth)?.count).toBe(2);
    expect(a.quotes.find((row) => row.month === thisMonth)?.count).toBe(1);
    expect(a.invoices.every((row) => row.count === 0)).toBe(true);
    expect(a).toMatchObject({ teamAccounts: 1, clientAccounts: 0, activeAccounts: 1 });
    expect(a.lastLoginAt).not.toBeNull();
    // Rien qui ressemble à un contenu : ni prénom, ni source.
    expect(JSON.stringify(a)).not.toMatch(/Inès|Lou|Salon/);

    const b = activity.find((candidate) => candidate.id === orgB.organizationId)!;
    expect(b.events.find((row) => row.month === thisMonth)?.count).toBe(1);
    expect(b).toMatchObject({ teamAccounts: 0, activeAccounts: 0, lastLoginAt: null });
  });

  it("les mois suivent le calendrier de Paris, passage d'année compris", () => {
    expect(lastMonths(new Date("2027-01-15T12:00:00Z"), 3)).toEqual(["2026-11", "2026-12", "2027-01"]);
    // 31 décembre 23 h 30 UTC = déjà le 1er janvier à Paris.
    expect(lastMonths(new Date("2026-12-31T23:30:00Z"), 2)).toEqual(["2026-12", "2027-01"]);
  });
});
