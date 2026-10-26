// Schéma de l'événement hello.greeting.created (SOC-06). Nommage
// <module>.<entité>.<action> au passé (CLAUDE.md §5). Une modification
// incompatible de ce schéma doit faire échouer
// events.test.ts (exemple figé validé contre le schéma courant).
import { z } from "zod";

export const HELLO_GREETING_CREATED = "hello.greeting.created";
export const HELLO_GREETING_CREATED_VERSION = 1;

export const helloGreetingCreatedPayloadSchema = z.object({
  greetingId: z.string().uuid(),
  message: z.string().min(1),
});

export type HelloGreetingCreatedPayload = z.infer<typeof helloGreetingCreatedPayloadSchema>;
