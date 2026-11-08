// Lot 16 (PRE-14, PRE-15, ADR 0040) — accès aux données des familles de types
// et opérations de rangement des types (fusion, suppression avec
// déplacement des fiches, données de départ). Jamais importé hors de
// modules/vendors/ (ADR 0011) : service.ts en est la porte d'entrée. Chaque
// requête passe par withOrganization (RLS, CLAUDE.md § 5).
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { VENDORS_VENDOR_TYPE_MERGED, VENDORS_VENDOR_TYPE_MERGED_VERSION, type StarterVendorCatalogInput, type VendorTypeMergedPayload } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { emitDomainEvent } from "@symbola/db/events/emit";
import { foldSearchText } from "@symbola/db/search";
import { vendorFamilies, vendors, vendorSettings, vendorTypeFields, vendorTypes } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
export type VendorFamilyRow = typeof vendorFamilies.$inferSelect;

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

const folded = (label: string) => foldSearchText(label).replace(/\s+/g, " ").trim();

// Familles.

export function findVendorFamilies(organizationId: string): Promise<VendorFamilyRow[]> {
  return inOrganization(organizationId, (tx) => tx.select().from(vendorFamilies).orderBy(asc(vendorFamilies.position), asc(vendorFamilies.createdAt)));
}

export function insertVendorFamily(organizationId: string, input: { label: string; color: string; icon: string }): Promise<VendorFamilyRow> {
  return inOrganization(organizationId, async (tx) => {
    const [{ next } = { next: 0 }] = await tx.select({ next: sql<number>`coalesce(max(${vendorFamilies.position}) + 1, 0)::int` }).from(vendorFamilies);
    const [row] = await tx.insert(vendorFamilies).values({ organizationId, ...input, position: next }).returning();
    if (!row) throw new Error("insertion de la famille échouée");
    return row;
  });
}

export function updateVendorFamilyRow(organizationId: string, familyId: string, input: { label: string; color: string; icon: string }): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => (await tx.update(vendorFamilies).set(input).where(eq(vendorFamilies.id, familyId)).returning()).length > 0);
}

// Échange avec la voisine, puis positions renumérotées (0, 1, 2…).
export function moveVendorFamilyRow(organizationId: string, familyId: string, direction: "up" | "down"): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => {
    const ordered = await tx.select({ id: vendorFamilies.id }).from(vendorFamilies).orderBy(asc(vendorFamilies.position), asc(vendorFamilies.createdAt));
    const index = ordered.findIndex((family) => family.id === familyId);
    if (index < 0) return false;
    const other = direction === "up" ? index - 1 : index + 1;
    if (other >= 0 && other < ordered.length) [ordered[index], ordered[other]] = [ordered[other]!, ordered[index]!];
    for (const [position, family] of ordered.entries()) await tx.update(vendorFamilies).set({ position }).where(eq(vendorFamilies.id, family.id));
    return true;
  });
}

export function deleteVendorFamilyRow(organizationId: string, familyId: string): Promise<"deleted" | "not_found" | "not_empty"> {
  return inOrganization(organizationId, async (tx) => {
    const [family] = await tx.select({ id: vendorFamilies.id }).from(vendorFamilies).where(eq(vendorFamilies.id, familyId));
    if (!family) return "not_found";
    const [used] = await tx.select({ n: sql<number>`count(*)::int` }).from(vendorTypes).where(eq(vendorTypes.familyId, familyId));
    if ((used?.n ?? 0) > 0) return "not_empty";
    await tx.delete(vendorFamilies).where(eq(vendorFamilies.id, familyId));
    return "deleted";
  });
}

export function updateVendorTypeFamilyRow(organizationId: string, typeId: string, familyId: string | null): Promise<"updated" | "type_not_found" | "family_not_found"> {
  return inOrganization(organizationId, async (tx) => {
    const [type] = await tx.select({ id: vendorTypes.id }).from(vendorTypes).where(eq(vendorTypes.id, typeId));
    if (!type) return "type_not_found";
    if (familyId) {
      const [family] = await tx.select({ id: vendorFamilies.id }).from(vendorFamilies).where(eq(vendorFamilies.id, familyId));
      if (!family) return "family_not_found";
    }
    await tx.update(vendorTypes).set({ familyId }).where(eq(vendorTypes.id, typeId));
    return "updated";
  });
}

// Nombre de fiches (hors archives) par type ; typeId nul : fiches sans type.
export function countVendorsByTypeRows(organizationId: string): Promise<{ typeId: string | null; count: number }[]> {
  return inOrganization(organizationId, (tx) =>
    tx
      .select({ typeId: vendors.typeId, count: sql<number>`count(*)::int` })
      .from(vendors)
      .where(isNull(vendors.archivedAt))
      .groupBy(vendors.typeId),
  );
}

// PRE-15 — fusion : les fiches du type fusionné passent au type gardé ; un
// champ propre (libellé absent du type gardé) le suit, un champ de même
// libellé reprend les valeurs sans écraser celles déjà saisies. Journalisée
// par un événement interne dans la même transaction (outbox, ADR 0014).
export function mergeVendorTypeRows(organizationId: string, sourceTypeId: string, targetTypeId: string): Promise<{ movedVendors: number; movedFields: number } | null> {
  return inOrganization(organizationId, async (tx) => {
    const found = await tx.select({ id: vendorTypes.id }).from(vendorTypes).where(inArray(vendorTypes.id, [sourceTypeId, targetTypeId]));
    if (found.length !== 2) return null;
    const fields = await tx.select().from(vendorTypeFields).where(inArray(vendorTypeFields.typeId, [sourceTypeId, targetTypeId])).orderBy(asc(vendorTypeFields.position));
    const targetByLabel = new Map(fields.filter((field) => field.typeId === targetTypeId).map((field) => [folded(field.label), field.id]));
    let position = fields.filter((field) => field.typeId === targetTypeId).reduce((max, field) => Math.max(max, field.position + 1), 0);
    const renamed = new Map<string, string>();
    let movedFields = 0;
    for (const field of fields.filter((candidate) => candidate.typeId === sourceTypeId)) {
      const same = targetByLabel.get(folded(field.label));
      if (same) {
        renamed.set(field.id, same);
        continue;
      }
      await tx.update(vendorTypeFields).set({ typeId: targetTypeId, position: position++ }).where(eq(vendorTypeFields.id, field.id));
      movedFields++;
    }
    const moving = await tx.select({ id: vendors.id, fieldValues: vendors.fieldValues }).from(vendors).where(eq(vendors.typeId, sourceTypeId));
    for (const vendor of moving) {
      const values = { ...vendor.fieldValues };
      for (const [from, to] of renamed) {
        if (!(from in values)) continue;
        if (!(to in values)) values[to] = values[from]!;
        delete values[from];
      }
      await tx.update(vendors).set({ typeId: targetTypeId, fieldValues: values, updatedAt: new Date() }).where(eq(vendors.id, vendor.id));
    }
    await tx.delete(vendorTypes).where(eq(vendorTypes.id, sourceTypeId));
    const payload: VendorTypeMergedPayload = { sourceTypeId, targetTypeId, movedVendorCount: moving.length, movedFieldCount: movedFields };
    await emitDomainEvent(tx, { organizationId, name: VENDORS_VENDOR_TYPE_MERGED, version: VENDORS_VENDOR_TYPE_MERGED_VERSION, payload });
    return { movedVendors: moving.length, movedFields };
  });
}

// PRE-15 — suppression d'un type : s'il a des fiches (hors archives), elles
// vont vers le type choisi, ou « à classer » (null) si c'est le choix
// explicite ; sans choix, rien n'est supprimé. Les valeurs des champs
// propres au type supprimé disparaissent avec eux.
export function deleteVendorTypeMovingRows(
  organizationId: string,
  typeId: string,
  moveVendorsTo: string | null | undefined,
): Promise<"deleted" | "not_found" | "in_use" | "target_not_found"> {
  return inOrganization(organizationId, async (tx) => {
    const [type] = await tx.select({ id: vendorTypes.id }).from(vendorTypes).where(eq(vendorTypes.id, typeId));
    if (!type) return "not_found";
    const [active] = await tx.select({ n: sql<number>`count(*)::int` }).from(vendors).where(and(eq(vendors.typeId, typeId), isNull(vendors.archivedAt)));
    if ((active?.n ?? 0) > 0 && moveVendorsTo === undefined) return "in_use";
    const target = moveVendorsTo ?? null;
    if (target) {
      const [found] = await tx.select({ id: vendorTypes.id }).from(vendorTypes).where(eq(vendorTypes.id, target));
      if (!found || target === typeId) return "target_not_found";
    }
    const ownFields = new Set((await tx.select({ id: vendorTypeFields.id }).from(vendorTypeFields).where(eq(vendorTypeFields.typeId, typeId))).map((field) => field.id));
    const moving = await tx.select({ id: vendors.id, fieldValues: vendors.fieldValues }).from(vendors).where(eq(vendors.typeId, typeId));
    for (const vendor of moving) {
      const values = Object.fromEntries(Object.entries(vendor.fieldValues).filter(([fieldId]) => !ownFields.has(fieldId)));
      await tx.update(vendors).set({ typeId: target, fieldValues: values, updatedAt: new Date() }).where(eq(vendors.id, vendor.id));
    }
    await tx.delete(vendorTypes).where(eq(vendorTypes.id, typeId));
    return "deleted";
  });
}

// PRE-14 — données de départ du métier, posées une seule fois par
// organisation (repère families_seeded_at) : familles absentes créées, types
// et champs de départ créés si l'organisation n'a encore aucun type, puis
// chaque type sans famille rangé par ses synonymes ; le reste reste « à
// classer ». Aucune fiche ne change de type. Verrou transactionnel : deux
// pages ouvertes en même temps ne posent pas deux fois les familles.
export function seedStarterCatalogRows(
  organizationId: string,
  catalog: StarterVendorCatalogInput,
  options: { withTypes: boolean; explicit?: boolean | undefined },
): Promise<{ families: number; types: number; classified: number }> {
  return inOrganization(organizationId, async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${`vendors.families:${organizationId}`}))`);
    const [settings] = await tx.select({ seededAt: vendorSettings.familiesSeededAt }).from(vendorSettings);
    if (settings?.seededAt && !options.explicit) return { families: 0, types: 0, classified: 0 };

    const existing = await tx.select().from(vendorFamilies);
    const familyByKey = new Map(existing.filter((family) => family.starterKey).map((family) => [family.starterKey!, family.id]));
    let familyPosition = existing.reduce((max, family) => Math.max(max, family.position + 1), 0);
    let families = 0;
    for (const family of catalog) {
      if (familyByKey.has(family.key)) continue;
      const [row] = await tx
        .insert(vendorFamilies)
        .values({ organizationId, label: family.label, color: family.color, icon: family.icon, starterKey: family.key, position: familyPosition++ })
        .returning({ id: vendorFamilies.id });
      if (!row) throw new Error("insertion de la famille échouée");
      familyByKey.set(family.key, row.id);
      families++;
    }

    const existingTypes = await tx.select({ id: vendorTypes.id, label: vendorTypes.label, familyId: vendorTypes.familyId }).from(vendorTypes);
    let types = 0;
    if (options.withTypes && existingTypes.length === 0) {
      for (const family of catalog) {
        for (const type of family.types) {
          const [row] = await tx
            .insert(vendorTypes)
            .values({ organizationId, label: type.label, color: family.color, familyId: familyByKey.get(family.key) ?? null, starterKey: type.key, position: types++ })
            .returning({ id: vendorTypes.id });
          if (!row) throw new Error("insertion du type échouée");
          for (const [position, field] of type.fields.entries()) {
            const choices = field.kind === "choice" ? [...new Set((field.choices ?? []).map((choice) => choice.trim()).filter(Boolean))] : [];
            await tx.insert(vendorTypeFields).values({ organizationId, typeId: row.id, label: field.label, kind: field.kind, choices, isFilter: field.isFilter ?? false, position });
          }
        }
      }
    }

    const match = new Map<string, { typeKey: string; familyKey: string }>();
    for (const family of catalog) for (const type of family.types) for (const label of type.synonyms) match.set(folded(label), { typeKey: type.key, familyKey: family.key });
    let classified = 0;
    for (const type of existingTypes.filter((candidate) => candidate.familyId === null)) {
      const known = match.get(folded(type.label));
      const familyId = known ? familyByKey.get(known.familyKey) : undefined;
      if (!known || !familyId) continue;
      await tx.update(vendorTypes).set({ familyId, starterKey: known.typeKey }).where(eq(vendorTypes.id, type.id));
      classified++;
    }

    const now = new Date();
    await tx
      .insert(vendorSettings)
      .values({ organizationId, familiesSeededAt: now })
      .onConflictDoUpdate({ target: vendorSettings.organizationId, set: { familiesSeededAt: now, updatedAt: now } });
    return { families, types, classified };
  });
}
