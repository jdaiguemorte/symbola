// SOC-06 — hello publie réellement hello.greeting.created dans
// domain_events (même transaction que l'écriture, motif outbox), et un
// consommateur de test le reçoit une seule fois même après rejeu.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "@symbola/db/client";
import { processPendingEvents } from "@symbola/db/events/worker";
import { HELLO_GREETING_CREATED, helloGreetingCreatedPayloadSchema } from "@symbola/contracts";
import { createGreeting } from "./service";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

describe("SOC-06 — hello publie hello.greeting.created (PostgreSQL réel)", () => {
  it("publie l'événement à la création d'une salutation et le worker le consomme une seule fois", async () => {
    const organizationId = randomUUID();
    // Un consommateur tout juste créé reçoit aussi le passif non réclamé
    // d'exécutions précédentes de ce test (comportement correct d'un
    // nouvel abonné) — on ne compte donc pas le total, on vérifie
    // seulement combien de fois NOTRE événement précis a été livré.
    const consumerName = `hello-test-consumer-${randomUUID()}`;
    const receivedPayloads: unknown[] = [];

    const greeting = await createGreeting({ organizationId, message: "bonjour depuis le test SOC-06" });

    const run = async () =>
      processPendingEvents(db, consumerName, {
        [HELLO_GREETING_CREATED]: async (event) => {
          receivedPayloads.push(helloGreetingCreatedPayloadSchema.parse(event.payload));
        },
      });

    await run();
    const occurrences = () =>
      receivedPayloads.filter(
        (payload) => (payload as { greetingId: string }).greetingId === greeting.id,
      );
    expect(occurrences()).toEqual([{ greetingId: greeting.id, message: greeting.message }]);

    await run();
    expect(occurrences()).toHaveLength(1); // toujours une seule réception pour cet événement précis
  });
});
