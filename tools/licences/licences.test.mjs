// Lot 40a (JUR-18, décision D8, ADR 0075) — inventaire et respect des licences : chaque
// bibliothèque et chaque service a une licence connue ; une licence à copyleft a son usage écrit ;
// le document de conformité suit l'inventaire.
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { checkFiles, checkLicences, checkServices, classify, listPackages, listServiceImages, loadJson, normalizeName, repoRoot } from "./licences.mjs";

const allowed = loadJson("autorisees.json");
const services = loadJson("services.json");
const files = loadJson("fichiers.json");

describe("JUR-18 — Inventaire et respect des licences", () => {
  it("chaque bibliothèque installée a une licence permissive, ou à copyleft justifiée dans autorisees.json", () => {
    expect(checkLicences(listPackages(), allowed)).toEqual([]);
  }, 60_000);

  it("chaque service du Compose et des scripts d'exploitation a sa licence et son usage", () => {
    expect(checkServices(listServiceImages(), services)).toEqual([]);
  });

  it("le document de conformité cite chaque licence à copyleft, chaque service et chaque point à valider", () => {
    const document = readFileSync(resolve(repoRoot, "docs/conformite/licences.md"), "utf8");
    for (const line of allowed) expect(document, line.paquet).toContain(`\`${line.paquet}\``);
    for (const line of services) {
      expect(document, line.image).toContain(`\`${line.image}\``);
      if (line.aValider) expect(document, line.image).toContain(line.aValider);
    }
  });

  it("classe les licences : permissive, à copyleft ou inconnue, expressions SPDX comprises", () => {
    expect(classify("MIT")).toBe("permissive");
    expect(classify("(MIT OR Apache-2.0)")).toBe("permissive");
    expect(classify("Apache-2.0 AND MIT")).toBe("permissive");
    expect(classify("MPL-2.0")).toBe("copyleft");
    expect(classify("AGPL-3.0-only")).toBe("copyleft");
    expect(classify("(GPL-3.0-only OR MIT)")).toBe("permissive");
    expect(classify("LGPL-3.0-or-later AND MIT")).toBe("copyleft");
    expect(classify("SEE LICENSE IN LICENSE.md")).toBe("inconnue");
    expect(classify("UNLICENSED")).toBe("inconnue");
    expect(classify("")).toBe("inconnue");
  });

  it("refuse une licence inconnue, un copyleft sans ligne ou d'une autre licence, et une ligne qui ne sert plus", () => {
    const packages = [
      { name: "paquet-libre", licence: "MIT" },
      { name: "paquet-maison", licence: "SEE LICENSE IN LICENSE" },
      { name: "paquet-gpl", licence: "GPL-3.0-only" },
      { name: "paquet-mpl", licence: "MPL-2.0" },
    ];
    const lines = [
      { paquet: "paquet-mpl", licence: "LGPL-3.0-only", usage: "exemple" },
      { paquet: "paquet-disparu", licence: "MPL-2.0", usage: "exemple" },
    ];
    expect(checkLicences(packages, lines)).toEqual([
      "paquet-maison : licence inconnue (« SEE LICENSE IN LICENSE »)",
      "paquet-gpl : licence GPL-3.0-only à copyleft, sans ligne justifiée dans tools/licences/autorisees.json",
      "paquet-mpl : licence MPL-2.0, mais LGPL-3.0-only dans autorisees.json",
      "paquet-disparu : dans autorisees.json, mais plus installé",
    ]);
  });

  it("ramène les paquets propres à une plateforme à une seule entrée, la même sur le Mac et en CI", () => {
    expect(normalizeName("lightningcss-darwin-arm64")).toBe("lightningcss-<plateforme>");
    expect(normalizeName("lightningcss-linux-x64-gnu")).toBe("lightningcss-<plateforme>");
    expect(normalizeName("@img/sharp-libvips-linuxmusl-x64")).toBe("@img/sharp-libvips-<plateforme>");
    expect(normalizeName("@esbuild/darwin-arm64")).toBe("@esbuild/<plateforme>");
    expect(normalizeName("lightningcss")).toBe("lightningcss");
    expect(normalizeName("next")).toBe("next");
  });

  it("lot 41 : chaque fichier tiers du dépôt et chaque outil de la CI a sa licence et son usage, cités dans le document", () => {
    expect(checkFiles(files)).toEqual([]);
    const document = readFileSync(resolve(repoRoot, "docs/conformite/licences.md"), "utf8");
    for (const line of files) expect(document, line.nom).toContain(line.nom);
    expect(checkFiles([{ nom: "Police maison", licence: "Propriétaire", chemin: "absent/police.ttf" }])).toEqual([
      "Police maison : licence inconnue (« Propriétaire »)",
      "Police maison : absent/police.ttf introuvable",
    ]);
  });

  it("refuse un service sans ligne, de licence inconnue, ou une ligne qui ne sert plus", () => {
    const lines = [
      { image: "postgres", licence: "PostgreSQL", mode: "base" },
      { image: "outil/maison", licence: "Propriétaire", mode: "exemple" },
      { image: "ancien/service", licence: "MIT", mode: "exemple" },
    ];
    expect(checkServices(["postgres", "outil/maison", "nouveau/service"], lines)).toEqual([
      "outil/maison : licence inconnue (« Propriétaire »)",
      "nouveau/service : service sans ligne dans tools/licences/services.json",
      "ancien/service : dans services.json, mais plus employé",
    ]);
  });
});
