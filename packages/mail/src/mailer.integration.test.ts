// Vérifie l'envoi réel via Mailpit (socle de dev/CI), pas un mock : l'e-mail
// est effectivement reçu, avec le bon destinataire et le bon sujet.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { sendMail } from "./mailer";

const MAILPIT_API = "http://localhost:8025/api/v1";

describe("@symbola/mail — sendMail (Mailpit réel)", () => {
  it("envoie un e-mail qui arrive bien dans la boîte de réception", async () => {
    const to = `destinataire-${randomUUID()}@symbola.test`;
    const subject = `Sujet de test ${randomUUID()}`;

    await sendMail({ to, subject, text: "Corps du message de test." });

    const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await response.json()) as { messages: Array<{ Subject: string }> };

    expect(messages).toHaveLength(1);
    expect(messages[0]?.Subject).toBe(subject);
  });
});
