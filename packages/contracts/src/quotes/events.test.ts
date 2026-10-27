import { describe, expect, it } from "vitest";
import { QUOTES_QUOTE_SIGNED, quoteSignedPayloadSchema } from "./events";

describe("DEV-02 — Événement quotes.quote.signed (schéma versionné)", () => {
  it("suit la convention <module>.<entité>.<action> et refuse une charge incomplète", () => {
    expect(QUOTES_QUOTE_SIGNED).toBe("quotes.quote.signed");
    const payload = {
      quoteId: "4f6c1e9e-3c1b-4a62-9a4c-2f8f8b1d7a10",
      eventId: "6d2b9a14-8f0e-4f3a-b9a1-1c2d3e4f5a6b",
      version: 2,
      totalTtcCents: 300000,
      currency: "EUR",
      signedAt: "2027-04-02T09:30:00.000Z",
    };
    expect(quoteSignedPayloadSchema.parse(payload)).toEqual(payload);
    expect(quoteSignedPayloadSchema.safeParse({ ...payload, totalTtcCents: 1.5 }).success).toBe(false);
  });
});
