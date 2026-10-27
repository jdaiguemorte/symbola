// Schémas des événements internes du module quotes (DEV-02, ADR 0014).
// Nommage <module>.<entité>.<action> au passé (CLAUDE.md §5). Aucune donnée
// personnelle dans la charge utile (pas de nom ni d'e-mail de signataire).
import { z } from "zod";

export const QUOTES_QUOTE_SIGNED = "quotes.quote.signed";
export const QUOTES_QUOTE_SIGNED_VERSION = 1;

export const quoteSignedPayloadSchema = z.object({
  quoteId: z.string().uuid(),
  eventId: z.string().uuid(),
  version: z.number().int().positive(),
  totalTtcCents: z.number().int().nonnegative(),
  currency: z.literal("EUR"),
  signedAt: z.string().datetime(),
});

export type QuoteSignedPayload = z.infer<typeof quoteSignedPayloadSchema>;
