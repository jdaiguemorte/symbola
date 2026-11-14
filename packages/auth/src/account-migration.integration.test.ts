// Lot 33 (SEC-01, D3, D4) — reprise des comptes chez le fournisseur (doublure de son API), contre
// un vrai PostgreSQL : chaque compte actif est relié, retrouvé ou créé, une seule fois ; la
// double authentification est exigée pour les titulaires et l'Exploitation ; rejouable.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { memberships, users } from "@symbola/db/schema/hub";
import { migrateAccounts } from "./identity/account-migration";
import { IdentityProviderError } from "./identity/management";
import { createOrganization, createUser } from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

function fakeProvider(known: Record<string, string>) {
  const created: string[] = [];
  const required: string[] = [];
  return {
    created,
    required,
    findUserByEmail: async (email: string) => (known[email] ? { id: known[email]!, primaryEmail: email } : null),
    createUser: async (email: string) => {
      created.push(email);
      return { id: `cree-${email}`, primaryEmail: email };
    },
    requireMfa: async (subject: string) => {
      required.push(subject);
    },
  };
}

describe("SEC-01 — Reprise des comptes chez le fournisseur d'identité (D3)", () => {
  it("relie chaque compte actif, retrouvé ou créé par son adresse ; exige la double authentification des titulaires et de l'Exploitation ; rejouable", async () => {
    const organization = await createOrganization(db, `Reprise ${randomUUID()}`);
    const ownerEmail = `titulaire-${randomUUID()}@example.test`;
    const memberEmail = `planner-${randomUUID()}@example.test`;
    const operatorEmail = `exploitation-${randomUUID()}@example.test`;
    const removedEmail = `retire-${randomUUID()}@example.test`;
    const owner = await createUser(db, { organizationId: organization.id, email: ownerEmail, role: "owner" });
    const member = await createUser(db, { organizationId: organization.id, email: memberEmail, role: "member" });
    const operator = await createUser(db, { organizationId: null, email: operatorEmail, role: "admin" });
    const removed = await createUser(db, { organizationId: organization.id, email: removedEmail, role: "member" });
    await db.update(users).set({ disabledAt: new Date() }).where(eq(users.id, removed.id));

    const existing = `sub-titulaire-${randomUUID()}`;
    const provider = fakeProvider({ [ownerEmail]: existing });
    await migrateAccounts(db, provider);
    const subjectOf = async (id: string) => (await db.select({ s: users.idpSubject }).from(users).where(eq(users.id, id)))[0]?.s;
    expect(await subjectOf(owner.id)).toBe(existing);
    expect(await subjectOf(member.id)).toBe(`cree-${memberEmail}`);
    expect(await subjectOf(operator.id)).toBe(`cree-${operatorEmail}`);
    expect(await subjectOf(removed.id)).toBeNull();
    expect(provider.created).toEqual(expect.arrayContaining([memberEmail, operatorEmail]));
    expect(provider.created).not.toContain(ownerEmail);
    expect(provider.required).toEqual(expect.arrayContaining([existing, `cree-${operatorEmail}`]));
    expect(provider.required).not.toContain(`cree-${memberEmail}`);

    // Rejoué : rien n'est recréé.
    const again = fakeProvider({});
    await migrateAccounts(db, again);
    expect(again.created).not.toEqual(expect.arrayContaining([memberEmail]));
    expect(await subjectOf(member.id)).toBe(`cree-${memberEmail}`);
    expect((await db.select().from(memberships).where(eq(memberships.userId, owner.id))).length).toBe(1);
  });

  it("un identifiant inconnu du fournisseur (sa base restaurée plus ancienne) : le compte est relié de nouveau par son adresse", async () => {
    const organization = await createOrganization(db, `Restaurée ${randomUUID()}`);
    const email = `titulaire-${randomUUID()}@example.test`;
    const owner = await createUser(db, { organizationId: organization.id, email, role: "owner" });
    const lost = `sub-perdu-${randomUUID()}`;
    const found = `sub-retrouve-${randomUUID()}`;
    await db.update(users).set({ idpSubject: lost }).where(eq(users.id, owner.id));
    const provider = fakeProvider({ [email]: found });
    const requireMfa = provider.requireMfa;
    provider.requireMfa = async (subject: string) => {
      if (subject === lost) throw new IdentityProviderError("/api/users/x/logto-configs", 404, "entity.not_found");
      await requireMfa(subject);
    };
    const report = await migrateAccounts(db, provider);
    expect(report.relinked).toBeGreaterThanOrEqual(1);
    expect((await db.select({ s: users.idpSubject }).from(users).where(eq(users.id, owner.id)))[0]?.s).toBe(found);
    expect(provider.required).toContain(found);
  });
});
