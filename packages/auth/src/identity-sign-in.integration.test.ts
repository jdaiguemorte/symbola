// Lot 33 (SEC-01, HUB-01, HUB-02, HUB-03 ; D4, D6 ; ADR 0067) — ouverture de session après le
// fournisseur d'identité, contre un vrai PostgreSQL : inscription (compte, organisation,
// Propriétaire), reprise d'un compte existant par son adresse, plusieurs organisations,
// adhésion retirée, double authentification de la Propriétaire et de l'Exploitation.
import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { memberships, organizations, users } from "@symbola/db/schema/hub";
import {
  addMembership,
  createOrganization,
  createUser,
  findSessionActor,
  listOrganizations,
  PROVISIONAL_ORGANIZATION_NAME,
  requireUser,
  signInWithIdentity,
  switchOrganization,
} from "./service";
import { removeMember } from "./team";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

const later = () => new Date(Date.now() + 2 * 60 * 1000);
const claimsFor = (email: string, mfa = false) => ({ subject: `sub-${randomUUID()}`, email, mfa });

async function signedIn(email: string, mfa: boolean, now?: Date, preferredOrganizationId?: string) {
  const outcome = await signInWithIdentity(db, { ...claimsFor(email, mfa), subject: (await subjectOf(email)) ?? `sub-${randomUUID()}` }, { now: now ?? new Date(), preferredOrganizationId: preferredOrganizationId ?? null });
  if (outcome.outcome !== "signed_in") throw new Error("session attendue");
  return outcome;
}

async function subjectOf(email: string): Promise<string | null> {
  const [user] = await db.select({ idpSubject: users.idpSubject }).from(users).where(eq(users.email, email));
  return user?.idpSubject ?? null;
}

describe("HUB-01 — Inscription par le fournisseur d'identité : une seule donnée, l'adresse", () => {
  it("une adresse inconnue crée le compte, son organisation provisoire et son adhésion de Propriétaire", async () => {
    const email = `nouvelle-${randomUUID()}@example.test`;
    const outcome = await signInWithIdentity(db, claimsFor(email));
    expect(outcome.outcome).toBe("signed_in");
    if (outcome.outcome !== "signed_in") return;
    expect(outcome.isNewAccount).toBe(true);
    const [membership] = await db
      .select({ role: memberships.role, name: organizations.name })
      .from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(eq(memberships.userId, outcome.userId));
    expect(membership).toEqual({ role: "owner", name: PROVISIONAL_ORGANIZATION_NAME });
    expect(outcome.organizationId).not.toBeNull();
  });

  it("D4 — la séance ouverte par l'inscription n'exige pas encore la double authentification ; la suivante, si", async () => {
    const email = `grace-${randomUUID()}@example.test`;
    const first = await signInWithIdentity(db, claimsFor(email));
    if (first.outcome !== "signed_in") throw new Error("session attendue");
    expect((await requireUser(db, first.sessionToken)).status).toBe("authenticated");
    const next = await signedIn(email, false, later());
    expect(await requireUser(db, next.sessionToken)).toMatchObject({ status: "mfa_required", role: "owner" });
    const withMfa = await signedIn(email, true, later());
    expect(await requireUser(db, withMfa.sessionToken)).toMatchObject({ status: "authenticated", user: { role: "owner", mfaEnabled: true } });
  });
});

describe("SEC-01 — Reprise d'un compte existant par son adresse vérifiée", () => {
  it("relie le compte Symbola au compte du fournisseur, sans créer d'organisation", async () => {
    const organization = await createOrganization(db, `Reprise ${randomUUID()}`);
    const email = `reprise-${randomUUID()}@example.test`;
    const user = await createUser(db, { organizationId: organization.id, email, role: "member" });
    const subject = `sub-${randomUUID()}`;
    const outcome = await signInWithIdentity(db, { subject, email: email.toUpperCase(), mfa: false });
    expect(outcome).toMatchObject({ outcome: "signed_in", userId: user.id, organizationId: organization.id, isNewAccount: false });
    expect(await subjectOf(email)).toBe(subject);
  });

  it("refuse une adresse déjà reliée à un autre compte du fournisseur", async () => {
    const email = `relie-${randomUUID()}@example.test`;
    await signInWithIdentity(db, claimsFor(email));
    expect(await signInWithIdentity(db, claimsFor(email))).toEqual({ outcome: "refused" });
  });
});

describe("HUB-02 — Plusieurs organisations, passer de l'une à l'autre", () => {
  it("la session ouvre l'organisation demandée si le compte y a une adhésion ; il passe à l'autre ; jamais à une organisation sans adhésion", async () => {
    const first = await createOrganization(db, `Première ${randomUUID()}`);
    const second = await createOrganization(db, `Seconde ${randomUUID()}`);
    const foreign = await createOrganization(db, `Étrangère ${randomUUID()}`);
    const email = `deux-${randomUUID()}@example.test`;
    const user = await createUser(db, { organizationId: first.id, email, role: "member" });
    await addMembership(db, { userId: user.id, organizationId: second.id, role: "owner" });

    const session = await signedIn(email, true, undefined, second.id);
    expect(session.organizationId).toBe(second.id);
    expect((await listOrganizations(db, user.id)).map((organization) => organization.organizationId).sort()).toEqual([first.id, second.id].sort());
    expect(await requireUser(db, session.sessionToken)).toMatchObject({ user: { organizationId: second.id, role: "owner" } });

    expect(await switchOrganization(db, session.sessionToken, first.id)).toBe(true);
    expect(await requireUser(db, session.sessionToken)).toMatchObject({ user: { organizationId: first.id, role: "member" } });
    // Organisation existante sans adhésion, ou inexistante : même refus, la session ne bouge pas.
    expect(await switchOrganization(db, session.sessionToken, foreign.id)).toBe(false);
    expect(await switchOrganization(db, session.sessionToken, randomUUID())).toBe(false);
    expect(await requireUser(db, session.sessionToken)).toMatchObject({ user: { organizationId: first.id } });
  });

  it("une adhésion retirée coupe l'accès à cette organisation dès la requête suivante, pas aux autres", async () => {
    const shared = await createOrganization(db, `Partagée ${randomUUID()}`);
    const own = await createOrganization(db, `Sienne ${randomUUID()}`);
    const ownerEmail = `titulaire-${randomUUID()}@example.test`;
    const owner = await createUser(db, { organizationId: shared.id, email: ownerEmail, role: "owner" });
    const email = `retiree-${randomUUID()}@example.test`;
    const member = await createUser(db, { organizationId: shared.id, email, role: "member" });
    await addMembership(db, { userId: member.id, organizationId: own.id, role: "owner" });
    const onShared = await signedIn(email, true, undefined, shared.id);
    const ownSession = await signedIn(email, true, undefined, own.id);

    expect(await removeMember(db, { organizationId: shared.id, userId: member.id, removedByUserId: owner.id })).toBe("removed");
    expect(await requireUser(db, onShared.sessionToken)).toEqual({ status: "unauthenticated" });
    expect(await findSessionActor(db, onShared.sessionToken)).toBeNull();
    expect((await requireUser(db, ownSession.sessionToken)).status).toBe("authenticated");
    // Une nouvelle connexion n'ouvre plus que l'organisation restante.
    const again = await signedIn(email, true, undefined, shared.id);
    expect(again.organizationId).toBe(own.id);
  });

  it("un compte sans aucune adhésion active, ou désactivé, est refusé", async () => {
    const organization = await createOrganization(db, `Seule ${randomUUID()}`);
    const email = `seule-${randomUUID()}@example.test`;
    const user = await createUser(db, { organizationId: organization.id, email, role: "member" });
    await db.update(memberships).set({ disabledAt: new Date() }).where(and(eq(memberships.userId, user.id)));
    expect(await signInWithIdentity(db, claimsFor(email))).toEqual({ outcome: "refused" });
  });
});

describe("D4 — Double authentification de la Propriétaire et de l'Exploitation", () => {
  it("la Planner n'en a pas besoin ; la Propriétaire et l'Exploitation, si (sans grâce pour l'Exploitation)", async () => {
    const organization = await createOrganization(db, `MFA ${randomUUID()}`);
    const memberEmail = `planner-${randomUUID()}@example.test`;
    await createUser(db, { organizationId: organization.id, email: memberEmail, role: "member" });
    const member = await signedIn(memberEmail, false, later());
    expect(member.requiresMfa).toBe(false);
    expect(await requireUser(db, member.sessionToken)).toMatchObject({ status: "authenticated", user: { role: "member" } });
    const ownerEmail = `titulaire-${randomUUID()}@example.test`;
    await createUser(db, { organizationId: organization.id, email: ownerEmail, role: "owner" });
    expect((await signedIn(ownerEmail, false, later())).requiresMfa).toBe(true);

    const operatorEmail = `exploitation-${randomUUID()}@example.test`;
    await createUser(db, { organizationId: null, email: operatorEmail, role: "admin" });
    const operator = await signedIn(operatorEmail, false);
    expect(operator.requiresMfa).toBe(true);
    expect(await requireUser(db, operator.sessionToken)).toMatchObject({ status: "mfa_required", role: "admin" });
    expect(await findSessionActor(db, operator.sessionToken)).toBeNull();
    const operatorMfa = await signedIn(operatorEmail, true);
    expect(await requireUser(db, operatorMfa.sessionToken)).toMatchObject({ status: "authenticated", user: { role: "admin", organizationId: null } });
    expect(await findSessionActor(db, operatorMfa.sessionToken)).toEqual({ kind: "admin", id: expect.any(String) });
  });
});
