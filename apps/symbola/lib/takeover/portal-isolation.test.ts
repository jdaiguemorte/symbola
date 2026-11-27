// Lot 71f (POR-10, SEC-14 ; spécification du lot 71, § 5.6, abus) — le portail des mariés (`app/portail`,
// `app/lien`) ne montre ni « À compléter après la reprise », ni la provenance d'une valeur, ni la marque
// « Repris » : aucun de ses fichiers ne lit la reprise ni ses textes. Rien n'est partagé par défaut.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const APP = join(__dirname, "..", "..", "app");

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

describe("POR-10 — Le portail des mariés ne montre rien de la reprise (lot 71f, abus)", () => {
  it("aucun fichier du portail ni des liens personnels ne lit la reprise, ses points ou sa provenance", () => {
    const portal = [...files(join(APP, "portail")), ...files(join(APP, "lien"))];
    expect(portal.length).toBeGreaterThan(0);
    const leaks = portal.filter((path) => /lib\/takeover|TakeoverSheet|takeover-checklist|getEventTakeover|listElementProvenance/.test(readFileSync(path, "utf8")));
    expect(leaks).toEqual([]);
  });
});
