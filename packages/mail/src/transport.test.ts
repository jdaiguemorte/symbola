// Lot 40b (ARC-12, ADR 0076) — le double en mémoire passe la suite de contrat des adaptateurs.
import { describe, expect, it } from "vitest";
import { mailTransportContract } from "./transport-contract";
import { configureMailTransport, currentMailTransport, memoryTransport } from "./transport";

mailTransportContract("mémoire", () => {
  const transport = memoryTransport();
  return {
    transport,
    async received(to) {
      const mails = transport.sent.filter((mail) => mail.to === to);
      const mail = mails[0];
      return {
        count: mails.length,
        mail: mail ? { subject: mail.subject, text: mail.text, html: mail.html ?? null, replyTo: mail.replyTo ?? null, attachments: (mail.attachments ?? []).map((attachment) => attachment.filename) } : null,
      };
    },
    broken() {
      const failing = memoryTransport();
      failing.failNext();
      return failing;
    },
  };
});

describe("ARC-12 — Adaptateur en service", () => {
  it("SMTP par défaut ; un test pose le double, puis revient au défaut", () => {
    expect(currentMailTransport().name).toBe("smtp");
    const memory = memoryTransport();
    configureMailTransport(memory);
    expect(currentMailTransport()).toBe(memory);
    configureMailTransport(null);
    expect(currentMailTransport().name).toBe("smtp");
  });
});
