// SOC-06 — « hello publie l'événement via domain_events ; un consommateur
// de test le reçoit une seule fois même en cas de rejeu (idempotence). »
// Test générique au niveau du worker (packages/db), avec un événement de
// démonstration — le module hello l'exerce réellement dans
// apps/symbola/modules/hello/events.integration.test.ts.
//
// Chaque test utilise un nom d'événement unique (généré) en plus d'un
// consommateur unique : le worker filtre déjà par nom (voir worker.ts),
// mais un nom unique par test évite toute pollution si deux tests
// partageaient un jour le même nom d'événement.
import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { createAppConnection } from "../client";
import { withOrganization } from "../with-organization";
import { emitDomainEvent } from "./emit";
import { processPendingEvents } from "./worker";

const { sql, db } = createAppConnection();

afterAll(async () => {
  await sql.end();
});

describe("SOC-06 — Worker d'événements internes (idempotence, PostgreSQL réel)", () => {
  it("ne livre un événement qu'une seule fois, même en cas de rejeu du worker", async () => {
    const organizationId = randomUUID();
    const consumerName = `test-consumer-${randomUUID()}`;
    const eventName = `test.demo.happened.${randomUUID()}`;
    let callCount = 0;

    await withOrganization(db, organizationId, (tx) =>
      emitDomainEvent(tx, {
        organizationId,
        name: eventName,
        version: 1,
        payload: { ok: true },
      }),
    );

    const firstRun = await processPendingEvents(db, consumerName, {
      [eventName]: async () => {
        callCount += 1;
      },
    });
    expect(firstRun.processed).toBe(1);
    expect(callCount).toBe(1);

    // Rejeu : le worker retourne sans redéclencher le gestionnaire.
    const secondRun = await processPendingEvents(db, consumerName, {
      [eventName]: async () => {
        callCount += 1;
      },
    });
    expect(secondRun.processed).toBe(0);
    expect(callCount).toBe(1);
  });

  it("ne livre pas deux fois le même événement en cas d'exécutions concurrentes du même consommateur", async () => {
    const organizationId = randomUUID();
    const consumerName = `race-consumer-${randomUUID()}`;
    const eventName = `test.demo.happened.${randomUUID()}`;

    const eventId = await withOrganization(db, organizationId, (tx) =>
      emitDomainEvent(tx, {
        organizationId,
        name: eventName,
        version: 1,
        payload: {},
      }),
    );

    let calls = 0;
    const [resultA, resultB] = await Promise.all([
      processPendingEvents(db, consumerName, {
        [eventName]: async () => {
          calls += 1;
        },
      }),
      processPendingEvents(db, consumerName, {
        [eventName]: async () => {
          calls += 1;
        },
      }),
    ]);

    expect(resultA.processed + resultB.processed).toBe(1);
    expect(calls).toBe(1);
    expect(eventId).toBeTruthy();
  });
});
