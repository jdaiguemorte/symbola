// Lot 35c (RGP-11, ADR 0100) — journal des effacements hors de la base : il se relit, refuse un fichier
// mal formé, et la trace la plus complète gagne quand la base restaurée et le fichier se recoupent.
import { describe, expect, it } from "vitest";
import { mergeClosureTraces, parseClosureTraces, serializeClosureTraces } from "./closure-traces";

const organizationId = "5c3afd20-3a7e-4d97-b925-b227080f486c";
const closedAt = new Date("2026-11-10T14:00:00Z");
const deletionDueAt = new Date("2026-12-09T23:00:00Z");

describe("RGP-11 — Journal des effacements, rejoué après une restauration (lot 35c)", () => {
  it("s'écrit et se relit à l'identique, sans autre donnée qu'un identifiant et des dates", () => {
    const traces = [{ organizationId, closedAt, deletionDueAt, erasedAt: deletionDueAt }];
    const text = serializeClosureTraces(traces);
    expect(Object.keys(JSON.parse(text)[0]).sort()).toEqual(["closedAt", "deletionDueAt", "erasedAt", "organizationId"]);
    expect(parseClosureTraces(text)).toEqual(traces);
  });

  it("refuse un fichier mal formé", () => {
    expect(() => parseClosureTraces('[{"organizationId":"pas-un-identifiant"}]')).toThrow();
  });

  it("la base restaurée (fermeture non effacée) et le fichier (effacée) : l'effacement gagne", () => {
    const restored = [{ organizationId, closedAt, deletionDueAt, erasedAt: null }];
    const file = [{ organizationId, closedAt, deletionDueAt, erasedAt: deletionDueAt }];
    expect(mergeClosureTraces(restored, file)).toEqual(file);
    expect(mergeClosureTraces(file, restored)).toEqual(file);
  });
});
