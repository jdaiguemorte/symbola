// Lot 63e (PRE-01 ; ADR 0105, maquettes M4 et M11) — étiquettes proposées sur une fiche à plusieurs
// métiers.
import { describe, expect, it } from "vitest";
import type { VendorFamily, VendorTag, VendorType } from "@/modules/vendors/service";
import { tagSectionsFor } from "./vendor-trades";

const family = (id: string, label: string): VendorFamily => ({ id, label, color: "#000000", icon: "other", position: 0, starterKey: null });
const type = (id: string, label: string, familyId: string | null): VendorType => ({ id, label, color: "#000000", position: 0, familyId, starterKey: null, fields: [] });
const tag = (id: string, label: string, familyIds: string[] = []): VendorTag => ({ id, label, groupId: null, familyIds, position: 0 });

describe("PRE-01 — Étiquettes de chaque métier, puis pour tous", () => {
  const families = [family("photo", "Photo et vidéo"), family("ceremony", "Cérémonie"), family("venues", "Lieux")];
  const tags = [tag("drone", "Drone", ["photo"]), tag("laic", "Laïque", ["ceremony"]), tag("pmr", "Accès PMR", ["venues"]), tag("en", "Anglais")];

  it("une section par famille des métiers cochés (les métiers d'une même famille ensemble), puis « pour tous » ; jamais les étiquettes d'une autre famille", () => {
    const sections = tagSectionsFor([type("p", "Photographe", "photo"), type("v", "Vidéaste", "photo"), type("o", "Officiante", "ceremony")], families, tags);
    expect(sections.map((section) => [section.kind, section.label, section.tags.map((entry) => entry.id)])).toEqual([
      ["family", "Photographe, Vidéaste", ["drone"]],
      ["family", "Officiante", ["laic"]],
      ["common", "", ["en"]],
    ]);
  });

  it("sans métier, toutes les étiquettes ; un métier « à classer » n'a que les étiquettes pour tous", () => {
    expect(tagSectionsFor([], families, tags)).toEqual([{ key: "any", kind: "any", label: "", tags }]);
    expect(tagSectionsFor([type("x", "Mannequin", null)], families, tags).map((section) => section.kind)).toEqual(["common"]);
  });
});
