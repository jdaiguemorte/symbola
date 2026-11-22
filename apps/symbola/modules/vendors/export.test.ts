// Lot 63e (PRE-01, HUB-13 ; ADR 0105) — une archive d'avant le lot (type de chaque fiche dans
// vendors.typeId, aucun métier) se reprend : ce type devient le métier principal de la fiche.
import { describe, expect, it } from "vitest";
import type { ExportRow } from "@symbola/contracts";
import { withLegacyTypeLinks } from "./export";

describe("HUB-13, PRE-01 — Reprise d'une archive d'avant le lot 63e", () => {
  it("le type d'une fiche devient son métier principal ; une archive qui a déjà ses métiers ne change pas", () => {
    const rows = new Map<string, ExportRow[]>([
      ["vendors", [{ id: "v1", typeId: "t1", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-02-01T00:00:00.000Z" }, { id: "v2", typeId: null }]],
    ]);
    const links = withLegacyTypeLinks(rows).get("vendor_type_links")!;
    expect(links).toHaveLength(1);
    expect(links[0]).toMatchObject({ vendorId: "v1", typeId: "t1", isPrimary: true, position: 0, createdAt: "2026-01-01T00:00:00.000Z" });
    const current = new Map<string, ExportRow[]>([...rows, ["vendor_type_links", [{ id: "l1", vendorId: "v1", typeId: "t2", isPrimary: true, position: 0 }]]]);
    expect(withLegacyTypeLinks(current)).toBe(current);
  });
});
