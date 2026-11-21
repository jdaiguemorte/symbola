// Lot 16 (L16-PRE-14, L16-PRE-15, ADR 0040) — accès aux données des familles de types
// et opérations de rangement des types (fusion, suppression avec
// déplacement des fiches, données de départ). Jamais importé hors de
// modules/vendors/ (ADR 0011) : service.ts en est la porte d'entrée. Chaque
// requête passe par withOrganization (RLS, CLAUDE.md § 5).
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { VENDORS_VENDOR_TYPE_MERGED, VENDORS_VENDOR_TYPE_MERGED_VERSION, type StarterVendorCatalogInput, type VendorTypeMergedPayload } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { emitDomainEvent } from "@symbola/db/events/emit";
import { foldSearchText } from "@symbola/db/search";
import { vendorFamilies, vendors, vendorSettings, vendorTypeFields, vendorTypeLinks, vendorTypes } from "@symbola/db/schema/vendors";
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

// Nombre de fiches (hors archives) par type ; typeId nul : fiches sans type. Lot 63e (ADR 0105) : une
// fiche compte pour chacun de ses métiers.
export function countVendorsByTypeRows(organizationId: string): Promise<{ typeId: string | null; count: number }[]> {
  return inOrganization(organizationId, async (tx) => {
    const typed = await tx
      .select({ typeId: vendorTypeLinks.typeId, count: sql<number>`count(distinct ${vendors.id})::int` })
      .from(vendorTypeLinks)
      .innerJoin(vendors, eq(vendors.id, vendorTypeLinks.vendorId))
      .where(isNull(vendors.archivedAt))
      .groupBy(vendorTypeLinks.typeId);
    const [untyped] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(vendors)
      .where(and(isNull(vendors.archivedAt), sql`not exists (select 1 from ${vendorTypeLinks} where ${vendorTypeLinks.vendorId} = ${vendors.id})`));
    return [...typed.map((row) => ({ typeId: row.typeId as string | null, count: row.count })), ...((untyped?.count ?? 0) > 0 ? [{ typeId: null, count: untyped!.count }] : [])];
  });
}

// Lot 63e : nombre de fiches (hors archives) par famille, chaque fiche une seule fois même si
// plusieurs de ses métiers sont de la famille ; familyId nul : « à classer » (un métier sans
// famille, ou aucun métier).
export function countVendorsByFamilyRows(organizationId: string): Promise<{ total: number; families: { familyId: string | null; count: number }[] }> {
  return inOrganization(organizationId, async (tx) => {
    const byFamily = await tx
      .select({ familyId: vendorTypes.familyId, count: sql<number>`count(distinct ${vendors.id})::int` })
      .from(vendorTypeLinks)
      .innerJoin(vendors, eq(vendors.id, vendorTypeLinks.vendorId))
      .innerJoin(vendorTypes, eq(vendorTypes.id, vendorTypeLinks.typeId))
      .where(isNull(vendors.archivedAt))
      .groupBy(vendorTypes.familyId);
    const [untyped] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(vendors)
      .where(and(isNull(vendors.archivedAt), sql`not exists (select 1 from ${vendorTypeLinks} where ${vendorTypeLinks.vendorId} = ${vendors.id})`));
    const unclassified = (byFamily.find((row) => row.familyId === null)?.count ?? 0) + (untyped?.count ?? 0);
    const [all] = await tx.select({ count: sql<number>`count(*)::int` }).from(vendors).where(isNull(vendors.archivedAt));
    return { total: all?.count ?? 0, families: [...byFamily.filter((row) => row.familyId !== null), ...(unclassified > 0 ? [{ familyId: null, count: unclassified }] : [])] };
  });
}

// Lot 63e — les liens d'un type passent à un autre : une fiche qui a déjà l'autre garde un seul lien,
// principal si l'un des deux l'était. Les autres métiers de la fiche ne bougent pas.
async function moveTypeLinks(tx: Tx, sourceTypeId: string, targetTypeId: string): Promise<string[]> {
  const sourceLinks = await tx.select().from(vendorTypeLinks).where(eq(vendorTypeLinks.typeId, sourceTypeId));
  if (sourceLinks.length === 0) return [];
  const targetLinks = await tx
    .select()
    .from(vendorTypeLinks)
    .where(and(eq(vendorTypeLinks.typeId, targetTypeId), inArray(vendorTypeLinks.vendorId, sourceLinks.map((link) => link.vendorId))));
  for (const link of sourceLinks) {
    const existing = targetLinks.find((candidate) => candidate.vendorId === link.vendorId);
    if (!existing) {
      await tx.update(vendorTypeLinks).set({ typeId: targetTypeId }).where(eq(vendorTypeLinks.id, link.id));
      continue;
    }
    await tx.delete(vendorTypeLinks).where(eq(vendorTypeLinks.id, link.id));
    if (link.isPrimary && !existing.isPrimary) await tx.update(vendorTypeLinks).set({ isPrimary: true, position: Math.min(existing.position, link.position) }).where(eq(vendorTypeLinks.id, existing.id));
  }
  return sourceLinks.map((link) => link.vendorId);
}

// Lot 63e — fiche qui perd son métier principal : le suivant (ordre choisi) devient principal.
async function promoteNextPrimary(tx: Tx, vendorIds: string[]): Promise<void> {
  if (vendorIds.length === 0) return;
  const links = await tx.select().from(vendorTypeLinks).where(inArray(vendorTypeLinks.vendorId, vendorIds)).orderBy(asc(vendorTypeLinks.position), asc(vendorTypeLinks.createdAt));
  for (const vendorId of new Set(vendorIds)) {
    const own = links.filter((link) => link.vendorId === vendorId);
    if (own.length === 0 || own.some((link) => link.isPrimary)) continue;
    await tx.update(vendorTypeLinks).set({ isPrimary: true }).where(eq(vendorTypeLinks.id, own[0]!.id));
  }
}

// L16-PRE-15 — fusion : les fiches du type fusionné passent au type gardé ; un
// champ propre (libellé absent du type gardé) le suit, un champ de même
// libellé reprend les valeurs sans écraser celles déjà saisies. Journalisée
// par un événement interne dans la même transaction (outbox, ADR 0014).
export function mergeVendorTypeRows(organizationId: string, sourceTypeId: string, targetTypeId: string): Promise<{ movedVendors: number; movedFields: number } | null> {
  return inOrganization(organizationId, (tx) => mergeTypesInTransaction(tx, organizationId, sourceTypeId, targetTypeId));
}

async function mergeTypesInTransaction(tx: Tx, organizationId: string, sourceTypeId: string, targetTypeId: string): Promise<{ movedVendors: number; movedFields: number } | null> {
  {
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
    // Lot 63e (ADR 0105) : les fiches qui avaient le métier fusionné ont le métier gardé.
    const movedIds = await moveTypeLinks(tx, sourceTypeId, targetTypeId);
    const moving = movedIds.length > 0 ? await tx.select({ id: vendors.id, fieldValues: vendors.fieldValues }).from(vendors).where(inArray(vendors.id, movedIds)) : [];
    for (const vendor of moving) {
      const values = { ...vendor.fieldValues };
      for (const [from, to] of renamed) {
        if (!(from in values)) continue;
        if (!(to in values)) values[to] = values[from]!;
        delete values[from];
      }
      await tx.update(vendors).set({ fieldValues: values, updatedAt: new Date() }).where(eq(vendors.id, vendor.id));
    }
    await tx.delete(vendorTypes).where(eq(vendorTypes.id, sourceTypeId));
    const payload: VendorTypeMergedPayload = { sourceTypeId, targetTypeId, movedVendorCount: moving.length, movedFieldCount: movedFields };
    await emitDomainEvent(tx, { organizationId, name: VENDORS_VENDOR_TYPE_MERGED, version: VENDORS_VENDOR_TYPE_MERGED_VERSION, payload });
    return { movedVendors: moving.length, movedFields };
  }
}

// Lot 63e (PRE-01, HUB-20 ; ADR 0105) — types de l'organisation et nombre de fiches (archives
// comprises) qui les portent, pour planifier la reprise des types combinés.
export function findTypesWithVendorCounts(organizationId: string): Promise<{ id: string; label: string; familyId: string | null; starterKey: string | null; vendorCount: number }[]> {
  return inOrganization(organizationId, async (tx) => {
    const types = await tx.select({ id: vendorTypes.id, label: vendorTypes.label, familyId: vendorTypes.familyId, starterKey: vendorTypes.starterKey }).from(vendorTypes).orderBy(asc(vendorTypes.position), asc(vendorTypes.createdAt));
    const counts = await tx.select({ typeId: vendorTypeLinks.typeId, n: sql<number>`count(*)::int` }).from(vendorTypeLinks).groupBy(vendorTypeLinks.typeId);
    const byType = new Map(counts.map((row) => [row.typeId, row.n]));
    return types.map((type) => ({ ...type, vendorCount: byType.get(type.id) ?? 0 }));
  });
}

export type TypeSplitApplyStep = {
  typeId: string;
  first: { action: "merge"; intoTypeId: string } | { action: "rename"; key: string; label: string };
  // Métiers suivants : type existant, ou créé depuis son type de départ (une seule fois par clé).
  others: { key: string; existingTypeId: string | null }[];
};

export type TypeSplitOutcome = { typeId: string; vendors: number; createdTypes: string[] };

// Lot 63e — reprise des types combinés, en une transaction : chaque fiche du type combiné garde son
// premier métier (fusion du lot 16, journalisée par vendors.vendor_type.merged, ou type renommé) et
// reçoit les suivants, après ses métiers actuels. Rejouable : un type déjà repris n'est plus combiné.
export function applyTypeSplitRows(organizationId: string, steps: TypeSplitApplyStep[], catalog: StarterVendorCatalogInput): Promise<TypeSplitOutcome[]> {
  return inOrganization(organizationId, async (tx) => {
    const outcomes: TypeSplitOutcome[] = [];
    const created = new Map<string, string>();
    const families = await tx.select({ id: vendorFamilies.id, starterKey: vendorFamilies.starterKey, color: vendorFamilies.color }).from(vendorFamilies);
    const starter = (key: string) => {
      for (const family of catalog) {
        const type = family.types.find((candidate) => candidate.key === key);
        if (type) return { type, family, orgFamily: families.find((candidate) => candidate.starterKey === family.key) ?? null };
      }
      return null;
    };
    let position = (await tx.select({ next: sql<number>`coalesce(max(${vendorTypes.position}) + 1, 0)::int` }).from(vendorTypes))[0]?.next ?? 0;
    const typeFor = async (key: string, existingTypeId: string | null, outcome: TypeSplitOutcome): Promise<string | null> => {
      if (existingTypeId) return existingTypeId;
      const known = created.get(key) ?? (await tx.select({ id: vendorTypes.id }).from(vendorTypes).where(eq(vendorTypes.starterKey, key)))[0]?.id;
      if (known) return known;
      const found = starter(key);
      if (!found) return null;
      const [row] = await tx
        .insert(vendorTypes)
        .values({ organizationId, label: found.type.label, color: found.orgFamily?.color ?? found.family.color, familyId: found.orgFamily?.id ?? null, starterKey: key, position: position++ })
        .returning({ id: vendorTypes.id });
      if (!row) throw new Error("création du type échouée");
      for (const [index, field] of found.type.fields.entries()) {
        await tx.insert(vendorTypeFields).values({ organizationId, typeId: row.id, label: field.label, kind: field.kind, choices: field.kind === "choice" ? (field.choices ?? []) : [], isFilter: field.isFilter ?? false, ruleKey: field.ruleKey ?? null, position: index });
      }
      created.set(key, row.id);
      outcome.createdTypes.push(found.type.label);
      return row.id;
    };
    for (const step of steps) {
      const [combined] = await tx.select().from(vendorTypes).where(eq(vendorTypes.id, step.typeId));
      if (!combined) continue;
      const outcome: TypeSplitOutcome = { typeId: step.typeId, vendors: 0, createdTypes: [] };
      const vendorIds = [...new Set((await tx.select({ vendorId: vendorTypeLinks.vendorId }).from(vendorTypeLinks).where(eq(vendorTypeLinks.typeId, step.typeId))).map((link) => link.vendorId))];
      let firstTypeId = step.typeId;
      if (step.first.action === "merge") {
        if (!(await mergeTypesInTransaction(tx, organizationId, step.typeId, step.first.intoTypeId))) continue;
        firstTypeId = step.first.intoTypeId;
      } else {
        const found = starter(step.first.key);
        await tx
          .update(vendorTypes)
          .set({ label: step.first.label, starterKey: step.first.key, familyId: combined.familyId ?? found?.orgFamily?.id ?? null })
          .where(eq(vendorTypes.id, step.typeId));
      }
      const others: string[] = [];
      for (const part of step.others) {
        const id = await typeFor(part.key, part.existingTypeId, outcome);
        if (id && id !== firstTypeId && !others.includes(id)) others.push(id);
      }
      if (vendorIds.length > 0 && others.length > 0) {
        const links = await tx.select().from(vendorTypeLinks).where(inArray(vendorTypeLinks.vendorId, vendorIds));
        for (const vendorId of vendorIds) {
          const own = links.filter((link) => link.vendorId === vendorId);
          let next = own.reduce((max, link) => Math.max(max, link.position + 1), 0);
          for (const typeId of others) {
            if (own.some((link) => link.typeId === typeId)) continue;
            await tx.insert(vendorTypeLinks).values({ organizationId, vendorId, typeId, isPrimary: false, position: next++ });
          }
        }
      }
      outcome.vendors = vendorIds.length;
      outcomes.push(outcome);
    }
    return outcomes;
  });
}

// L16-PRE-15 — suppression d'un type : s'il a des fiches (hors archives), elles
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
    const [active] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(vendorTypeLinks)
      .innerJoin(vendors, eq(vendors.id, vendorTypeLinks.vendorId))
      .where(and(eq(vendorTypeLinks.typeId, typeId), isNull(vendors.archivedAt)));
    if ((active?.n ?? 0) > 0 && moveVendorsTo === undefined) return "in_use";
    const target = moveVendorsTo ?? null;
    if (target) {
      const [found] = await tx.select({ id: vendorTypes.id }).from(vendorTypes).where(eq(vendorTypes.id, target));
      if (!found || target === typeId) return "target_not_found";
    }
    const ownFields = new Set((await tx.select({ id: vendorTypeFields.id }).from(vendorTypeFields).where(eq(vendorTypeFields.typeId, typeId))).map((field) => field.id));
    // Lot 63e (ADR 0105) : le métier supprimé passe au type choisi, ou disparaît de la fiche (« à
    // classer » si c'était son seul métier) ; un autre métier devient principal au besoin.
    const affected = (await tx.select({ vendorId: vendorTypeLinks.vendorId }).from(vendorTypeLinks).where(eq(vendorTypeLinks.typeId, typeId))).map((link) => link.vendorId);
    if (target) await moveTypeLinks(tx, typeId, target);
    else await tx.delete(vendorTypeLinks).where(eq(vendorTypeLinks.typeId, typeId));
    await promoteNextPrimary(tx, affected);
    const moving = affected.length > 0 ? await tx.select({ id: vendors.id, fieldValues: vendors.fieldValues }).from(vendors).where(inArray(vendors.id, affected)) : [];
    for (const vendor of moving) {
      const values = Object.fromEntries(Object.entries(vendor.fieldValues).filter(([fieldId]) => !ownFields.has(fieldId)));
      await tx.update(vendors).set({ fieldValues: values, updatedAt: new Date() }).where(eq(vendors.id, vendor.id));
    }
    await tx.delete(vendorTypes).where(eq(vendorTypes.id, typeId));
    return "deleted";
  });
}

// L16-PRE-14 — données de départ du métier, posées une seule fois par
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
            await tx.insert(vendorTypeFields).values({ organizationId, typeId: row.id, label: field.label, kind: field.kind, choices, isFilter: field.isFilter ?? false, ruleKey: field.ruleKey ?? null, position });
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
