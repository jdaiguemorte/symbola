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

  it("MSG-01, HUB-18 (lot 38a) — HTML et texte, nom de l'organisation affiché, réponses vers son adresse, logo joint en ligne", async () => {
    const to = `destinataire-${randomUUID()}@symbola.test`;
    const subject = `Sujet HTML ${randomUUID()}`;
    const logo = Buffer.from("89504e470d0a1a0a", "hex");
    await sendMail({
      to,
      subject,
      text: "Version texte.",
      html: '<p>Version <img src="cid:logo@symbola"> HTML.</p>',
      fromName: "Atelier Camille R.",
      replyTo: "contact@atelier.test",
      attachments: [{ filename: "logo.png", content: logo, contentType: "image/png", cid: "logo@symbola" }],
    });
    const search = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await search.json()) as { messages: Array<{ ID: string }> };
    const message = (await (await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}`)).json()) as {
      From: { Name: string; Address: string };
      ReplyTo: { Address: string }[];
      HTML: string;
      Text: string;
      Inline: { FileName: string; ContentID: string }[];
    };
    expect(message.From.Name).toBe("Atelier Camille R.");
    expect(message.ReplyTo.map((entry) => entry.Address)).toEqual(["contact@atelier.test"]);
    expect(message.HTML).toContain("Version");
    expect(message.Text.trim()).toBe("Version texte.");
    expect(message.Inline.map((part) => part.ContentID)).toEqual(["logo@symbola"]);
  });
});

