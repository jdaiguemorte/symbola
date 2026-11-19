// Lot 35c (RGP-11 ; D8, Q35 ; ADR 0100) — journal des effacements, hors de la base : avant une
// restauration, l'Exploitation l'exporte dans un fichier (identifiants et dates, aucune donnée
// personnelle) ; après, elle le rejoue. Le format est une liste JSON, lue par un schéma.
import { z } from "zod";

export const closureTraceFileSchema = z.array(
  z.object({
    organizationId: z.guid(),
    closedAt: z.iso.datetime(),
    deletionDueAt: z.iso.datetime(),
    erasedAt: z.iso.datetime().nullable(),
  }),
);

export type ClosureTraceLine = { organizationId: string; closedAt: Date; deletionDueAt: Date; erasedAt: Date | null };

export function serializeClosureTraces(traces: readonly ClosureTraceLine[]): string {
  return `${JSON.stringify(
    traces.map((trace) => ({ organizationId: trace.organizationId, closedAt: trace.closedAt.toISOString(), deletionDueAt: trace.deletionDueAt.toISOString(), erasedAt: trace.erasedAt?.toISOString() ?? null })),
    null,
    2,
  )}\n`;
}

export function parseClosureTraces(text: string): ClosureTraceLine[] {
  return closureTraceFileSchema.parse(JSON.parse(text)).map((line) => ({
    organizationId: line.organizationId,
    closedAt: new Date(line.closedAt),
    deletionDueAt: new Date(line.deletionDueAt),
    erasedAt: line.erasedAt ? new Date(line.erasedAt) : null,
  }));
}

// Traces de la base restaurée et du fichier, sans doublon (la plus complète gagne).
export function mergeClosureTraces(...lists: readonly (readonly ClosureTraceLine[])[]): ClosureTraceLine[] {
  const merged = new Map<string, ClosureTraceLine>();
  for (const trace of lists.flat()) {
    const key = `${trace.organizationId}:${trace.closedAt.toISOString()}`;
    const known = merged.get(key);
    if (!known || (!known.erasedAt && trace.erasedAt)) merged.set(key, trace);
  }
  return [...merged.values()];
}
