// HUB-01 — « 5 mots de passe faux d'affilée bloquent le compte
// temporairement et le titulaire reçoit un e-mail. » Contre un vrai
// PostgreSQL et un vrai Mailpit (socle de dev/CI), pas des mocks.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { users } from "@symbola/db/schema/hub";
import { createOrganization, createUser, login } from "./service";

const { sql, db } = createAppConnection();
const MAILPIT_API = "http://localhost:8025/api/v1";

afterAll(async () => {
  await sql.end();
});

async function waitForEmailTo(to: string, attempts = 20): Promise<{ Subject: string }[]> {
  for (let i = 0; i < attempts; i++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await response.json()) as { messages: { Subject: string }[] };
    if (messages.length > 0) return messages;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return [];
}

describe("HUB-01 — Verrouillage de compte après 5 échecs", () => {
  it("bloque après le 5e mot de passe faux et avertit le titulaire par e-mail", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const email = `lockout-${randomUUID()}@symbola.test`;
    const password = "le-bon-mot-de-passe";
    await createUser(db, { organizationId: organization.id, email, password, role: "member" });

    for (let i = 0; i < 4; i++) {
      const result = await login(db, email, "mauvais-mot-de-passe");
      expect(result.outcome).toBe("invalid_credentials");
    }

    const fifthAttempt = await login(db, email, "mauvais-mot-de-passe");
    expect(fifthAttempt.outcome).toBe("locked");

    // Même avec le bon mot de passe, le compte reste bloqué.
    const withCorrectPassword = await login(db, email, password);
    expect(withCorrectPassword.outcome).toBe("locked");

    const messages = await waitForEmailTo(email);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.Subject).toContain("verrouillé");
  });

  it("remet le compteur à zéro après une connexion réussie", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const email = `reset-${randomUUID()}@symbola.test`;
    const password = "le-bon-mot-de-passe";
    await createUser(db, { organizationId: organization.id, email, password, role: "member" });

    await login(db, email, "mauvais-mot-de-passe");
    await login(db, email, "mauvais-mot-de-passe");
    await login(db, email, "mauvais-mot-de-passe");

    const success = await login(db, email, password);
    expect(success.outcome).toBe("success");

    // Après la remise à zéro, 4 nouveaux échecs ne suffisent pas à bloquer.
    for (let i = 0; i < 4; i++) {
      const result = await login(db, email, "mauvais-mot-de-passe");
      expect(result.outcome).toBe("invalid_credentials");
    }
  });

  it("le verrouillage expire après sa durée", async () => {
    const organization = await createOrganization(db, `Org ${randomUUID()}`);
    const email = `expire-${randomUUID()}@symbola.test`;
    const password = "le-bon-mot-de-passe";
    await createUser(db, { organizationId: organization.id, email, password, role: "member" });

    for (let i = 0; i < 5; i++) {
      await login(db, email, "mauvais-mot-de-passe");
    }
    expect((await login(db, email, password)).outcome).toBe("locked");

    // Simule l'expiration du verrouillage plutôt que d'attendre 15 min.
    await db.update(users).set({ lockedUntil: new Date(Date.now() - 1000) }).where(eq(users.email, email));

    const result = await login(db, email, password);
    expect(result.outcome).toBe("success");
  });
});
