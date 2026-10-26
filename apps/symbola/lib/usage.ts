// Collecte des compteurs d'usage (SOC-13, ADR 0017) — séparé de
// auth-context.ts pour rester testable sans runtime Next.js (ce fichier
// n'importe pas next/headers).
import { createAppConnection } from "@symbola/db/client";
import { incrementUsageCounters } from "@symbola/db/usage/increment";

export async function recordUsage(organizationId: string): Promise<void> {
  const { sql, db } = createAppConnection();
  try {
    await incrementUsageCounters(db, {
      organizationId,
      date: new Date().toISOString().slice(0, 10),
      requests: 1,
      // Octets de réponse non connus à ce stade — voir ADR 0017.
      bytes: 0,
    });
  } catch {
    // La collecte d'usage ne doit jamais faire échouer la requête.
  } finally {
    await sql.end();
  }
}
