// Enveloppe commune des événements internes (SOC-06, ADR 0014). Mêmes
// conventions que les futurs événements NATS (CLAUDE.md §5) : seul le
// transport change le jour où NATS devient nécessaire.
import { z } from "zod";

export const domainEventEnvelopeSchema = z.object({
  id: z.string().uuid(),
  organizationId: z.string().uuid(),
  name: z.string().min(1),
  version: z.number().int().positive(),
  occurredAt: z.coerce.date(),
  payload: z.unknown(),
});

export type DomainEventEnvelope = z.infer<typeof domainEventEnvelopeSchema>;
