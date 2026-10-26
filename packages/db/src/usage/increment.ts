// Incrément des compteurs d'usage (SOC-13, ADR 0017) : upsert
// atomique — une ligne par organisation et par jour, jamais de
// lecture-puis-écriture qui perdrait des incréments concurrents.
import { sql } from "drizzle-orm";
import type { AppDatabase } from "../client";
import { usageCounters } from "../schema/core";

export async function incrementUsageCounters(
  db: AppDatabase,
  input: { organizationId: string; date: string; requests: number; bytes: number },
): Promise<void> {
  await db
    .insert(usageCounters)
    .values({
      organizationId: input.organizationId,
      date: input.date,
      requestCount: input.requests,
      responseBytes: input.bytes,
    })
    .onConflictDoUpdate({
      target: [usageCounters.organizationId, usageCounters.date],
      set: {
        requestCount: sql`${usageCounters.requestCount} + ${input.requests}`,
        responseBytes: sql`${usageCounters.responseBytes} + ${input.bytes}`,
      },
    });
}
