// Accès aux données du module hello — jamais importé hors de modules/hello/
// (ADR 0011).
//
// findGreetingText() reste en mémoire (SOC-01) : c'est le message
// d'accueil statique de la page, pas une donnée persistée.
//
// createGreetingRow() écrit dans la vraie table hello.greetings (SOC-05)
// et publie hello.greeting.created dans la même transaction (SOC-06,
// motif outbox).
import { createAppConnection } from "@symbola/db/client";
import { greetings } from "@symbola/db/schema/hello";
import { withOrganization } from "@symbola/db/with-organization";
import { emitDomainEvent } from "@symbola/db/events/emit";
import { HELLO_GREETING_CREATED, HELLO_GREETING_CREATED_VERSION } from "@symbola/contracts";

const DEFAULT_GREETING = "Bonjour depuis Symbola";

export function findGreetingText(): string {
  return DEFAULT_GREETING;
}

export async function createGreetingRow(input: { organizationId: string; message: string }) {
  const { sql, db } = createAppConnection();
  try {
    return await withOrganization(db, input.organizationId, async (tx) => {
      const [row] = await tx
        .insert(greetings)
        .values({ organizationId: input.organizationId, message: input.message })
        .returning();
      if (!row) throw new Error("création de la salutation échouée");

      await emitDomainEvent(tx, {
        organizationId: input.organizationId,
        name: HELLO_GREETING_CREATED,
        version: HELLO_GREETING_CREATED_VERSION,
        payload: { greetingId: row.id, message: row.message },
      });

      return row;
    });
  } finally {
    await sql.end();
  }
}
