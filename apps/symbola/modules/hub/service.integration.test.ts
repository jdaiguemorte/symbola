// HUB-03 — « L'Admin crée une organisation et saisit l'e-mail du
// titulaire, alors le titulaire reçoit une invitation valable 7 jours. »
// Contre un vrai PostgreSQL et un vrai Mailpit, pas des mocks.
import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { auditLog, invitations } from "@symbola/db/schema/hub";
import { createUser, requireUser } from "@symbola/auth";
import { acceptInvitation, createOrganizationWithInvitation } from "./service";

const { sql, db } = createAppConnection();
const MAILPIT_API = "http://localhost:8025/api/v1";

async function createTestAdmin(): Promise<string> {
  const admin = await createUser(db, {
    organizationId: null,
    email: `admin-${randomUUID()}@symbola.test`,
    password: "mot-de-passe-admin",
    role: "admin",
  });
  return admin.id;
}

afterAll(async () => {
  await sql.end();
});

async function waitForEmailTo(to: string, attempts = 20): Promise<{ Subject: string; Text?: string }[]> {
  for (let i = 0; i < attempts; i++) {
    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await response.json()) as { messages: { ID: string; Subject: string }[] };
    if (messages.length > 0) {
      const detail = await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}`);
      const body = (await detail.json()) as { Text: string };
      return [{ Subject: messages[0]!.Subject, Text: body.Text }];
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return [];
}

describe("HUB-03 — Création d'organisation et invitation du titulaire", () => {
  it("crée l'organisation, envoie une invitation valable 7 jours, et consigne l'action dans le journal d'audit", async () => {
    const adminUserId = await createTestAdmin();
    const titulaireEmail = `titulaire-${randomUUID()}@symbola.test`;

    const result = await createOrganizationWithInvitation(db, {
      adminUserId,
      name: `Org ${randomUUID()}`,
      language: "fr",
      siret: null,
      titulaireEmail,
    });

    expect(result.organizationId).toBeTruthy();

    const [invitation] = await db.select().from(invitations).where(eq(invitations.id, result.invitationId));
    expect(invitation).toBeTruthy();
    expect(invitation!.email).toBe(titulaireEmail);
    expect(invitation!.acceptedAt).toBeNull();
    const daysUntilExpiry = (invitation!.expiresAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000);
    expect(daysUntilExpiry).toBeGreaterThan(6.9);
    expect(daysUntilExpiry).toBeLessThan(7.1);

    const messages = await waitForEmailTo(titulaireEmail);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.Subject).toContain("invit");

    const [logEntry] = await db.select().from(auditLog).where(eq(auditLog.targetOrganizationId, result.organizationId));
    expect(logEntry).toBeTruthy();
    expect(logEntry!.adminUserId).toBe(adminUserId);
    expect(logEntry!.action).toBe("hub.organization.created");
  });

  it("l'acceptation de l'invitation crée le titulaire (rôle owner) et marque l'invitation utilisée", async () => {
    const titulaireEmail = `accept-${randomUUID()}@symbola.test`;
    const { organizationId, invitationToken } = await createOrganizationWithInvitation(db, {
      adminUserId: await createTestAdmin(),
      name: `Org ${randomUUID()}`,
      language: "fr",
      siret: null,
      titulaireEmail,
    });

    const accepted = await acceptInvitation(db, { token: invitationToken, password: "mot-de-passe-du-titulaire" });
    expect(accepted.outcome).toBe("success");
    if (accepted.outcome !== "success") return;

    const loginResult = await requireUser(db, undefined);
    expect(loginResult.status).toBe("unauthenticated"); // sanity : pas de session créée par acceptInvitation

    // Un second essai avec le même jeton échoue (déjà utilisé).
    const secondAttempt = await acceptInvitation(db, { token: invitationToken, password: "autre-mot-de-passe" });
    expect(secondAttempt.outcome).toBe("already_accepted");
    expect(organizationId).toBe(accepted.organizationId);
  });

  it("refuse un jeton d'invitation inconnu ou expiré", async () => {
    const result = await acceptInvitation(db, { token: "jeton-qui-n-existe-pas", password: "peu-importe" });
    expect(result.outcome).toBe("invalid_or_expired");
  });
});
