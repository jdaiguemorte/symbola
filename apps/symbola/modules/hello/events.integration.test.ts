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
    const consumerName = `hello-test-consumer-${randomUUID()}`;
    const receivedPayloads: unknown[] = [];

    const greeting = await createGreeting({ organizationId, message: "bonjour depuis le test SOC-06" });

    const run = async () =>
      processPendingEvents(db, consumerName, {
        [HELLO_GREETING_CREATED]: async (event) => {
          receivedPayloads.push(helloGreetingCreatedPayloadSchema.parse(event.payload));
        },
      });

    const first = await run();
    expect(first.processed).toBe(1);
    expect(receivedPayloads).toEqual([{ greetingId: greeting.id, message: greeting.message }]);

    const second = await run();
    expect(second.processed).toBe(0);
    expect(receivedPayloads).toHaveLength(1); // toujours une seule réception
  });
});
