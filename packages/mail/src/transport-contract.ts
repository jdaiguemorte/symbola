// Lot 40b (ARC-12, décision D10, ADR 0076) — suite de contrat commune aux adaptateurs d'e-mail :
// chacun la passe (le double en mémoire dans transport.test.ts, SMTP contre Mailpit dans
// mailer.integration.test.ts). Changer de fournisseur = écrire un adaptateur qui la passe.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import type { MailTransport } from "./transport";

export type ReceivedMail = { subject: string; text: string; html: string | null; replyTo: string | null; attachments: string[] };

export type MailTransportDriver = {
  transport: MailTransport;
  // Ce que le destinataire a reçu (null : rien), et le nombre de messages reçus.
  received(to: string): Promise<{ count: number; mail: ReceivedMail | null }>;
  // Un adaptateur du même genre, dont le serveur est injoignable.
  broken(): MailTransport;
};

export function mailTransportContract(name: string, makeDriver: () => MailTransportDriver): void {
  describe(`ARC-12 — Adaptateur d'e-mail « ${name} » (contrat commun)`, () => {
    it("remet le message une fois, au bon destinataire, avec son sujet et son texte", async () => {
      const driver = makeDriver();
      const to = `contrat-${randomUUID()}@symbola.test`;
      const subject = `Contrat ${randomUUID()}`;
      await driver.transport.send({ to, subject, text: "Corps du message." });
      const { count, mail } = await driver.received(to);
      expect(count).toBe(1);
      expect(mail?.subject).toBe(subject);
      expect(mail?.text.trim()).toBe("Corps du message.");
    });

    it("garde la version HTML, l'adresse de réponse et les pièces jointes", async () => {
      const driver = makeDriver();
      const to = `contrat-${randomUUID()}@symbola.test`;
      await driver.transport.send({
        to,
        subject: "Pièce jointe",
        text: "Texte.",
        html: "<p>HTML.</p>",
        replyTo: "contact@atelier.test",
        attachments: [{ filename: "contrat.pdf", content: Buffer.from("%PDF-1.4\n%%EOF\n", "latin1"), contentType: "application/pdf" }],
      });
      const { mail } = await driver.received(to);
      expect(mail?.html).toContain("HTML.");
      expect(mail?.replyTo).toBe("contact@atelier.test");
      expect(mail?.attachments).toEqual(["contrat.pdf"]);
    });

    it("rejette quand le serveur est injoignable, sans échec silencieux", async () => {
      const driver = makeDriver();
      await expect(driver.broken().send({ to: `contrat-${randomUUID()}@symbola.test`, subject: "Perdu ?", text: "Non." })).rejects.toThrow();
    });
  });
}
