// Lot 73b (PRE-01, UX-07, UX-15 ; spécification du lot 73, § 5.2, critères 7 et 9 ; P13) — les actions en
// lot du carnet contre un vrai PostgreSQL (RLS) : étiquette et archivage de plusieurs fiches, avec leur
// « Annuler », classement de plusieurs fiches (écran « Classer » et « Revoir ») ; tests d'abus : une fiche,
// une étiquette ou un métier d'une autre organisation fait refuser tout le lot, sans rien écrire.
import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { createOrganization } from "@symbola/auth";
import { createAppConnection, type AppDatabase } from "@symbola/db/client";
import {
  archiveVendors,
  createVendor,
  createVendorFamily,
  createVendorTag,
  createVendorTagGroup,
  createVendorType,
  findVendors,
  getVendor,
  restoreVendorsTags,
  setVendorsPrimaryType,
  tagVendors,
  unarchiveVendors,
  VendorNotFoundError,
  VendorTagNotFoundError,
} from "./service";

async function withDb<T>(fn: (db: AppDatabase) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

async function newOrganization(): Promise<string> {
  return (await withDb((db) => createOrganization(db, `Org ${randomUUID()}`))).id;
}

async function vendor(organizationId: string, name: string, typeIds: string[] = []): Promise<string> {
  return (await createVendor(organizationId, { name, typeIds })).vendor.id;
}

describe("PRE-01, UX-07 — Étiquette et archivage de plusieurs fiches, avec « Annuler » (lot 73b, critère 7)", () => {
  it("« Ajouter une étiquette… » pose l'étiquette sur les fiches choisies seulement, et « Annuler » rend l'état d'avant", async () => {
    const org = await newOrganization();
    const tag = await createVendorTag(org, "Bohème");
    const [a, b, c] = [await vendor(org, "Atelier Papier"), await vendor(org, "Iris Beauté"), await vendor(org, "Studio Lumière")];
    const result = await tagVendors(org, [a, b], tag.id);
    expect(result.changed).toBe(2);
    expect((await getVendor(org, a))!.tagIds).toEqual([tag.id]);
    expect((await getVendor(org, b))!.tagIds).toEqual([tag.id]);
    expect((await getVendor(org, c))!.tagIds).toEqual([]);
    // Une fiche qui l'avait déjà n'est pas comptée.
    expect((await tagVendors(org, [a, c], tag.id)).changed).toBe(1);
    await restoreVendorsTags(org, result.previous);
    expect((await getVendor(org, a))!.tagIds).toEqual([]);
    expect((await getVendor(org, b))!.tagIds).toEqual([]);
  });

  it("dans un groupe « palier » (un seul choix), l'étiquette remplace l'autre palier du groupe", async () => {
    const org = await newOrganization();
    const group = await createVendorTagGroup(org, { label: "Capacité", exclusive: true });
    const small = await createVendorTag(org, "Moins de 100", { groupId: group.id });
    const large = await createVendorTag(org, "Plus de 200", { groupId: group.id });
    const id = await vendor(org, "Manoir des Aulnes");
    await tagVendors(org, [id], small.id);
    const result = await tagVendors(org, [id], large.id);
    expect((await getVendor(org, id))!.tagIds).toEqual([large.id]);
    await restoreVendorsTags(org, result.previous);
    expect((await getVendor(org, id))!.tagIds).toEqual([small.id]);
  });

  it("« Archiver… » en lot retire les fiches du carnet ; « Annuler » ne rend que celles que le geste a archivées", async () => {
    const org = await newOrganization();
    const [a, b, c] = [await vendor(org, "Alpha"), await vendor(org, "Bravo"), await vendor(org, "Charlie")];
    expect(await archiveVendors(org, [a])).toEqual([a]);
    const archived = await archiveVendors(org, [a, b]);
    expect(archived).toEqual([b]);
    expect((await findVendors({ organizationId: org })).map((item) => item.id)).toEqual([c]);
    expect(await unarchiveVendors(org, archived)).toBe(1);
    expect((await findVendors({ organizationId: org })).map((item) => item.id).sort()).toEqual([b, c].sort());
  });

  it("abus : une fiche ou une étiquette d'une autre organisation fait refuser tout le lot, sans rien écrire", async () => {
    const [orgA, orgB] = [await newOrganization(), await newOrganization()];
    const tagA = await createVendorTag(orgA, "Bohème");
    const tagB = await createVendorTag(orgB, "Champêtre");
    const mine = await vendor(orgA, "Atelier Papier");
    const theirs = await vendor(orgB, "Fleurs du Causse");
    await expect(tagVendors(orgA, [mine, theirs], tagA.id)).rejects.toBeInstanceOf(VendorNotFoundError);
    await expect(tagVendors(orgA, [mine], tagB.id)).rejects.toBeInstanceOf(VendorTagNotFoundError);
    expect((await getVendor(orgA, mine))!.tagIds).toEqual([]);
    await expect(archiveVendors(orgA, [mine, theirs])).rejects.toBeInstanceOf(VendorNotFoundError);
    expect((await getVendor(orgA, mine))!.archived).toBe(false);
    expect((await getVendor(orgB, theirs))!.archived).toBe(false);
    // L'« Annuler » d'une autre organisation ne touche rien non plus.
    await archiveVendors(orgB, [theirs]);
    await expect(unarchiveVendors(orgA, [theirs])).rejects.toBeInstanceOf(VendorNotFoundError);
    expect((await getVendor(orgB, theirs))!.archived).toBe(true);
    await expect(restoreVendorsTags(orgA, [{ id: theirs, tagIds: [] }])).rejects.toBeInstanceOf(VendorNotFoundError);
  });

  it("abus : un identifiant mal formé ou un lot vide est refusé comme inexistant", async () => {
    const org = await newOrganization();
    await expect(archiveVendors(org, ["pas-un-id"])).rejects.toBeInstanceOf(VendorNotFoundError);
    await expect(archiveVendors(org, [])).rejects.toBeInstanceOf(VendorNotFoundError);
  });
});

describe("PRE-01, HUB-14 — Classer plusieurs fiches d'un coup (lot 73b, critère 9 ; P13)", () => {
  it("une fiche « à classer » prend le métier comme principal ; une fiche déjà classée le prend en plus", async () => {
    const org = await newOrganization();
    const family = await createVendorFamily(org, { label: "Traiteurs", color: "#b45309", icon: "other" });
    const caterer = await createVendorType(org, "Traiteur", "#b45309", { familyId: family.id });
    const photographer = await createVendorType(org, "Photographe", "#0f766e", { familyId: family.id });
    const loose = await createVendorType(org, "Baby-sitter", "#78716c");
    const untyped = await vendor(org, "Belle Époque Traiteur");
    const unclassified = await vendor(org, "Les Doigts de Fée", [loose.id]);
    const classified = await vendor(org, "Studio Lumière", [photographer.id]);
    const changed = await setVendorsPrimaryType(org, [
      { vendorId: untyped, typeId: caterer.id },
      { vendorId: unclassified, typeId: caterer.id },
      { vendorId: classified, typeId: caterer.id },
    ]);
    expect(changed.sort()).toEqual([untyped, unclassified, classified].sort());
    expect((await getVendor(org, untyped))!.typeIds).toEqual([caterer.id]);
    expect((await getVendor(org, unclassified))!.typeIds).toEqual([caterer.id, loose.id]);
    expect((await getVendor(org, classified))!.typeIds).toEqual([photographer.id, caterer.id]);
    // « À classer » compte une fiche pour chacun de ses métiers (lot 63e) : celle qui garde « Baby-sitter »,
    // métier sans famille, y reste aussi ; la fiche sans métier n'y est plus.
    expect((await findVendors({ organizationId: org, unclassified: true })).map((item) => item.id)).toEqual([unclassified]);
  });

  it("« Revoir » : un métier changé là remplace celui qui venait d'être enregistré, et devient principal", async () => {
    const org = await newOrganization();
    const family = await createVendorFamily(org, { label: "Fleurs", color: "#be185d", icon: "other" });
    const florist = await createVendorType(org, "Fleuriste", "#be185d", { familyId: family.id });
    const decorator = await createVendorType(org, "Décoration", "#be185d", { familyId: family.id });
    const id = await vendor(org, "Élodie Perrin Fleurs");
    await setVendorsPrimaryType(org, [{ vendorId: id, typeId: florist.id }]);
    await setVendorsPrimaryType(org, [{ vendorId: id, typeId: decorator.id, replaces: florist.id }]);
    expect((await getVendor(org, id))!.typeIds).toEqual([decorator.id]);
  });

  it("abus : une fiche ou un métier d'une autre organisation fait refuser tout le classement", async () => {
    const [orgA, orgB] = [await newOrganization(), await newOrganization()];
    const typeA = await createVendorType(orgA, "Traiteur", "#b45309");
    const typeB = await createVendorType(orgB, "Fleuriste", "#be185d");
    const mine = await vendor(orgA, "Belle Époque Traiteur");
    const theirs = await vendor(orgB, "Calèches du Marais");
    await expect(
      setVendorsPrimaryType(orgA, [
        { vendorId: mine, typeId: typeA.id },
        { vendorId: theirs, typeId: typeA.id },
      ]),
    ).rejects.toBeInstanceOf(VendorNotFoundError);
    await expect(setVendorsPrimaryType(orgA, [{ vendorId: mine, typeId: typeB.id }])).rejects.toBeInstanceOf(VendorNotFoundError);
    expect((await getVendor(orgA, mine))!.typeIds).toEqual([]);
    expect((await getVendor(orgB, theirs))!.typeIds).toEqual([]);
  });
});
