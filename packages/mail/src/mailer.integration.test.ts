// Vérifie l'envoi réel via Mailpit (socle de dev/CI), pas un mock : l'e-mail
// est effectivement reçu, avec le bon destinataire et le bon sujet.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { parseEnv } from "@symbola/env";
import { sendMail } from "./mailer";
import { mailTransportContract } from "./transport-contract";
import { smtpTransport } from "./transport";

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

  it("MSG-04, MSG-05 (lot 55) — l'adresse d'expédition de l'organisation et l'identifiant du message arrivent tels quels", async () => {
    const to = `destinataire-${randomUUID()}@symbola.test`;
    const reference = `${randomUUID()}.${randomUUID()}@envoi.symbola.test`;
    await sendMail({ to, subject: `Expéditeur ${randomUUID()}`, text: "Texte.", fromName: "Atelier Camille", fromAddress: "atelier-camille@envoi.symbola.test", replyTo: "contact@atelier.test", messageId: `<${reference}>`, headers: { "X-Symbola-Delivery": reference } });
    const search = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await search.json()) as { messages: Array<{ ID: string; MessageID: string }> };
    const message = (await (await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}`)).json()) as { From: { Name: string; Address: string }; ReplyTo: { Address: string }[]; MessageID: string };
    expect(message.From).toEqual({ Name: "Atelier Camille", Address: "atelier-camille@envoi.symbola.test" });
    expect(message.ReplyTo.map((entry) => entry.Address)).toEqual(["contact@atelier.test"]);
    expect(message.MessageID).toBe(reference);
    // Lot 55 (Scaleway) : l'en-tête recopié dans les évènements de TEM, par lequel le webhook retrouve l'envoi.
    const headers = (await (await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}/headers`)).json()) as Record<string, string[]>;
    expect(headers["X-Symbola-Delivery"]).toEqual([reference]);
  });
});

// Lot 40b (ARC-12, ADR 0076) : l'adaptateur SMTP passe la même suite de contrat que le double en
// mémoire, contre le vrai Mailpit.
mailTransportContract("SMTP (Mailpit)", () => ({
  transport: smtpTransport(),
  async received(to) {
    const search = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`);
    const { messages } = (await search.json()) as { messages: Array<{ ID: string }> };
    if (messages.length === 0) return { count: 0, mail: null };
    const message = (await (await fetch(`${MAILPIT_API}/message/${messages[0]!.ID}`)).json()) as {
      Subject: string;
      Text: string;
      HTML: string;
      ReplyTo: { Address: string }[];
      Attachments: { FileName: string }[];
    };
    return {
      count: messages.length,
      mail: { subject: message.Subject, text: message.Text, html: message.HTML || null, replyTo: message.ReplyTo[0]?.Address ?? null, attachments: message.Attachments.map((part) => part.FileName) },
    };
  },
  broken() {
    return smtpTransport({ env: { ...parseEnv(process.env), SMTP_PORT: 1 } });
  },
}));
