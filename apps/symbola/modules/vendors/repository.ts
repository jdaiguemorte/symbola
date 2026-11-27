// Accès aux données du module vendors — jamais importé hors de
// modules/vendors/ (ADR 0011). Chaque requête passe par withOrganization
// (RLS, CLAUDE.md § 5).
import { and, asc, desc, eq, gte, inArray, isNotNull, isNull, or, sql, type SQL } from "drizzle-orm";
import { appDatabase } from "@symbola/db/client";
import { foldedColumn, likeWord } from "@symbola/db/search";
import { vendorDocuments, vendorFiles, vendors, vendorSettings, vendorTagGroups, vendorTags, vendorTypeFields, vendorTypeLinks, vendorTypes } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import type { VendorAround, VendorFieldFilter, VendorFieldKind, VendorFieldValue, VendorFileKind, VendorSettings, VendorSocialLink } from "@symbola/contracts";
import { EARTH_RADIUS_KM } from "./travel";
import type { TagPlan } from "./tag-arrangement";

export type VendorTypeRow = typeof vendorTypes.$inferSelect;
export type VendorTypeFieldRow = typeof vendorTypeFields.$inferSelect;
export type VendorTagRow = typeof vendorTags.$inferSelect;
export type VendorTagGroupRow = typeof vendorTagGroups.$inferSelect;
// Lot 63e (PRE-01, ADR 0105) : une fiche et ses métiers (vendor_type_links), le principal en
// premier ; primaryTypeId est nul pour une fiche sans métier.
export type VendorRow = typeof vendors.$inferSelect & { typeIds: string[]; primaryTypeId: string | null };
export type VendorFileRow = typeof vendorFiles.$inferSelect;
type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

// Lot 63e (PRE-01, ADR 0105) — métiers des fiches, lus d'un bloc : le principal d'abord, puis l'ordre
// choisi.
export async function typeLinksOf(tx: Tx, vendorIds: string[]): Promise<Map<string, { typeIds: string[]; primaryTypeId: string | null }>> {
  const result = new Map<string, { typeIds: string[]; primaryTypeId: string | null }>();
  if (vendorIds.length === 0) return result;
  const links = await tx
    .select({ vendorId: vendorTypeLinks.vendorId, typeId: vendorTypeLinks.typeId, isPrimary: vendorTypeLinks.isPrimary })
    .from(vendorTypeLinks)
    .where(inArray(vendorTypeLinks.vendorId, [...new Set(vendorIds)]))
    .orderBy(desc(vendorTypeLinks.isPrimary), asc(vendorTypeLinks.position), asc(vendorTypeLinks.createdAt));
  for (const link of links) {
    const entry = result.get(link.vendorId) ?? { typeIds: [], primaryTypeId: null };
    entry.typeIds.push(link.typeId);
    if (link.isPrimary) entry.primaryTypeId = link.typeId;
    result.set(link.vendorId, entry);
  }
  return result;
}

export async function withTypeLinks(tx: Tx, rows: (typeof vendors.$inferSelect)[]): Promise<VendorRow[]> {
  const links = await typeLinksOf(tx, rows.map((row) => row.id));
  return rows.map((row) => ({ ...row, typeIds: links.get(row.id)?.typeIds ?? [], primaryTypeId: links.get(row.id)?.primaryTypeId ?? null }));
}

// Les métiers d'une fiche remplacés par la liste donnée, le premier principal. Seuls les liens qui
// changent sont écrits (une suppression va au journal d'audit) ; le principal est d'abord retiré,
// pour ne jamais avoir deux principaux.
export async function writeTypeLinks(tx: Tx, organizationId: string, vendorId: string, typeIds: string[]): Promise<void> {
  const wanted = [...new Set(typeIds)];
  const current = await tx.select().from(vendorTypeLinks).where(eq(vendorTypeLinks.vendorId, vendorId));
  const removed = current.filter((link) => !wanted.includes(link.typeId)).map((link) => link.id);
  if (removed.length > 0) await tx.delete(vendorTypeLinks).where(inArray(vendorTypeLinks.id, removed));
  const kept = current.filter((link) => wanted.includes(link.typeId));
  const primary = kept.find((link) => link.isPrimary);
  if (primary && primary.typeId !== wanted[0]) await tx.update(vendorTypeLinks).set({ isPrimary: false }).where(eq(vendorTypeLinks.id, primary.id));
  for (const [position, typeId] of wanted.entries()) {
    const link = kept.find((candidate) => candidate.typeId === typeId);
    const isPrimary = position === 0;
    if (!link) {
      await tx.insert(vendorTypeLinks).values({ organizationId, vendorId, typeId, isPrimary, position });
    } else if (link.position !== position || link.isPrimary !== isPrimary) {
      await tx.update(vendorTypeLinks).set({ isPrimary, position }).where(eq(vendorTypeLinks.id, link.id));
    }
  }
}

// Condition « la fiche a l'un de ces métiers ».
export function hasAnyTypeSql(typeIds: string[]): SQL {
  if (typeIds.length === 0) return sql`false`;
  return sql`exists (select 1 from ${vendorTypeLinks} where ${vendorTypeLinks.vendorId} = ${vendors.id} and ${inArray(vendorTypeLinks.typeId, typeIds)})`;
}

export function hasNoTypeSql(): SQL {
  return sql`not exists (select 1 from ${vendorTypeLinks} where ${vendorTypeLinks.vendorId} = ${vendors.id})`;
}

// Libellés des métiers d'une fiche, pour la recherche par mot (« vidéaste » trouve la fiche).
function typeLabelsSql(): SQL {
  return sql`(select string_agg(${vendorTypes.label}, ' ') from ${vendorTypeLinks} join ${vendorTypes} on ${vendorTypes.id} = ${vendorTypeLinks.typeId} where ${vendorTypeLinks.vendorId} = ${vendors.id})`;
}

// L11-PRE-02 — types et champs.

export function findVendorTypes(organizationId: string): Promise<{ type: VendorTypeRow; fields: VendorTypeFieldRow[] }[]> {
  return inOrganization(organizationId, async (tx) => {
    const types = await tx.select().from(vendorTypes).orderBy(asc(vendorTypes.position), asc(vendorTypes.createdAt));
    const fields = await tx.select().from(vendorTypeFields).orderBy(asc(vendorTypeFields.position), asc(vendorTypeFields.createdAt));
    return types.map((type) => ({ type, fields: fields.filter((field) => field.typeId === type.id) }));
  });
}

export function insertVendorType(organizationId: string, label: string, color: string, familyId: string | null = null): Promise<VendorTypeRow> {
  return inOrganization(organizationId, async (tx) => {
    const [{ next } = { next: 0 }] = await tx.select({ next: sql<number>`coalesce(max(${vendorTypes.position}) + 1, 0)::int` }).from(vendorTypes);
    const [row] = await tx.insert(vendorTypes).values({ organizationId, label, color, familyId, position: next }).returning();
    if (!row) throw new Error("insertion du type échouée");
    return row;
  });
}

export function updateVendorTypeRow(organizationId: string, typeId: string, label: string, color: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) => (await tx.update(vendorTypes).set({ label, color }).where(eq(vendorTypes.id, typeId)).returning()).length > 0);
}

export function insertVendorTypeField(
  organizationId: string,
  input: { typeId: string; label: string; kind: VendorFieldKind; choices: string[]; isFilter: boolean },
): Promise<VendorTypeFieldRow | null> {
  return inOrganization(organizationId, async (tx) => {
    const [type] = await tx.select({ id: vendorTypes.id }).from(vendorTypes).where(eq(vendorTypes.id, input.typeId));
    if (!type) return null;
    const [{ next } = { next: 0 }] = await tx
      .select({ next: sql<number>`coalesce(max(${vendorTypeFields.position}) + 1, 0)::int` })
      .from(vendorTypeFields)
      .where(eq(vendorTypeFields.typeId, input.typeId));
    const [row] = await tx.insert(vendorTypeFields).values({ organizationId, ...input, position: next }).returning();
    return row ?? null;
  });
}

export function updateVendorTypeFieldFilter(organizationId: string, fieldId: string, isFilter: boolean): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    await tx.update(vendorTypeFields).set({ isFilter }).where(eq(vendorTypeFields.id, fieldId));
  });
}

export function deleteVendorTypeField(organizationId: string, fieldId: string): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    await tx.delete(vendorTypeFields).where(eq(vendorTypeFields.id, fieldId));
  });
}

// Étiquettes.

export function findVendorTags(organizationId: string): Promise<VendorTagRow[]> {
  return inOrganization(organizationId, (tx) => tx.select().from(vendorTags).orderBy(asc(vendorTags.position), asc(vendorTags.label)));
}

export function insertVendorTag(
  organizationId: string,
  label: string,
  options: { groupId?: string | null; familyIds?: string[]; position?: number } = {},
): Promise<VendorTagRow> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx
      .insert(vendorTags)
      .values({ organizationId, label, groupId: options.groupId ?? null, familyIds: options.familyIds ?? [], position: options.position ?? 0 })
      .returning();
    if (!row) throw new Error("insertion de l'étiquette échouée");
    return row;
  });
}

// Lot 20 (décision 5, ADR 0049) — étiquettes rangées par groupe.
export function updateVendorTagRow(organizationId: string, tagId: string, values: { label: string; groupId: string | null; familyIds: string[] }): Promise<number> {
  return inOrganization(organizationId, async (tx) => (await tx.update(vendorTags).set(values).where(eq(vendorTags.id, tagId)).returning({ id: vendorTags.id })).length);
}

export function setVendorTagsGroup(organizationId: string, groupId: string, tags: { id: string; position: number }[]): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    for (const tag of tags) await tx.update(vendorTags).set({ groupId, position: tag.position }).where(eq(vendorTags.id, tag.id));
  });
}

export function findVendorTagGroups(organizationId: string): Promise<VendorTagGroupRow[]> {
  return inOrganization(organizationId, (tx) => tx.select().from(vendorTagGroups).orderBy(asc(vendorTagGroups.position), asc(vendorTagGroups.label)));
}

export function insertVendorTagGroup(organizationId: string, values: { label: string; exclusive: boolean; position: number }): Promise<VendorTagGroupRow> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.insert(vendorTagGroups).values({ organizationId, ...values }).returning();
    if (!row) throw new Error("insertion du groupe d'étiquettes échouée");
    return row;
  });
}

export function updateVendorTagGroupRow(organizationId: string, groupId: string, values: { label: string; exclusive: boolean }): Promise<number> {
  return inOrganization(organizationId, async (tx) => (await tx.update(vendorTagGroups).set(values).where(eq(vendorTagGroups.id, groupId)).returning({ id: vendorTagGroups.id })).length);
}

// Les étiquettes du groupe passent dans « Autres » (clé étrangère « set null »).
export function deleteVendorTagGroup(organizationId: string, groupId: string): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    await tx.delete(vendorTagGroups).where(eq(vendorTagGroups.id, groupId));
  });
}

// Lot 21 (L21-PRE-18, L21-PRE-19, ADR 0050) — fiches (archivées comprises) et leurs
// étiquettes, pour ranger les étiquettes d'après les prestataires qui les portent.
export function findVendorTagCarriers(organizationId: string): Promise<{ id: string; name: string; typeIds: string[]; tagIds: string[] }[]> {
  return inOrganization(organizationId, async (tx) => {
    const rows = await tx.select({ id: vendors.id, name: vendors.name, tagIds: vendors.tagIds }).from(vendors);
    const links = await typeLinksOf(tx, rows.map((row) => row.id));
    return rows.map((row) => ({ ...row, typeIds: links.get(row.id)?.typeIds ?? [] }));
  });
}

// Un plan de rangement appliqué d'un bloc : groupes créés, étiquettes placées
// ou créées, fiches ramenées à une tranche par palier.
export function applyVendorTagPlan(organizationId: string, plan: TagPlan): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    const created = new Map<string, string>();
    for (const group of plan.newGroups) {
      const [row] = await tx.insert(vendorTagGroups).values({ organizationId, label: group.label, exclusive: group.exclusive, position: group.position }).returning({ id: vendorTagGroups.id });
      if (!row) throw new Error("création du groupe d'étiquettes échouée");
      created.set(group.key, row.id);
    }
    const groupId = (ref: { id: string } | { key: string } | null): string | null => {
      if (!ref) return null;
      if ("id" in ref) return ref.id;
      const id = created.get(ref.key);
      if (!id) throw new Error("groupe d'étiquettes inconnu");
      return id;
    };
    for (const update of plan.tagUpdates) {
      await tx.update(vendorTags).set({ groupId: groupId(update.group), familyIds: update.familyIds, position: update.position }).where(eq(vendorTags.id, update.id));
    }
    for (const tag of plan.newTags) {
      await tx.insert(vendorTags).values({ organizationId, label: tag.label, groupId: groupId(tag.group), familyIds: tag.familyIds, position: tag.position });
    }
    for (const vendor of plan.vendorUpdates) {
      await tx.update(vendors).set({ tagIds: vendor.tagIds, updatedAt: new Date() }).where(eq(vendors.id, vendor.id));
    }
  });
}

// L'étiquette disparaît aussi des fiches qui la portaient.
export function deleteVendorTag(organizationId: string, tagId: string): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    await tx.update(vendors).set({ tagIds: sql`array_remove(${vendors.tagIds}, ${tagId}::uuid)` }).where(sql`${tagId}::uuid = any(${vendors.tagIds})`);
    await tx.delete(vendorTags).where(eq(vendorTags.id, tagId));
  });
}

// L11-PRE-01 — fiches.

export type VendorWrite = {
  // Lot 63e (ADR 0105) : les métiers de la fiche, le principal en premier (vide : aucun métier).
  typeIds: string[];
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  internalNote: string | null;
  rating: number | null;
  indicativePrices: string | null;
  website: string | null;
  socialLinks: VendorSocialLink[];
  siret: string | null;
  fieldValues: Record<string, VendorFieldValue>;
  tagIds: string[];
  location?: { latitude: number; longitude: number; source: "geocoded" | "manual" } | null | undefined;
  isDemo?: boolean;
};

function locationColumns(location: VendorWrite["location"]) {
  if (location === undefined) return {};
  return {
    latitude: location?.latitude ?? null,
    longitude: location?.longitude ?? null,
    locationSource: location?.source ?? null,
  };
}

export function insertVendor(organizationId: string, input: VendorWrite): Promise<VendorRow> {
  return inOrganization(organizationId, async (tx) => {
    const { location, typeIds, ...columns } = input;
    const [row] = await tx
      .insert(vendors)
      .values({ organizationId, ...columns, ...locationColumns(location) })
      .returning();
    if (!row) throw new Error("insertion de la fiche échouée");
    await writeTypeLinks(tx, organizationId, row.id, typeIds);
    return (await withTypeLinks(tx, [row]))[0]!;
  });
}

export function updateVendorRow(organizationId: string, vendorId: string, input: VendorWrite): Promise<VendorRow | null> {
  return inOrganization(organizationId, async (tx) => {
    // Une fiche ne devient jamais exemple (ni l'inverse) par une modification.
    const { location, typeIds, ...columns } = input;
    delete columns.isDemo;
    const [row] = await tx
      .update(vendors)
      .set({ ...columns, ...locationColumns(location), updatedAt: new Date() })
      .where(eq(vendors.id, vendorId))
      .returning();
    if (!row) return null;
    await writeTypeLinks(tx, organizationId, row.id, typeIds);
    return (await withTypeLinks(tx, [row]))[0]!;
  });
}

export function updateVendorLocation(organizationId: string, vendorId: string, latitude: number, longitude: number): Promise<boolean> {
  return inOrganization(
    organizationId,
    async (tx) =>
      (await tx.update(vendors).set({ latitude, longitude, locationSource: "manual", updatedAt: new Date() }).where(eq(vendors.id, vendorId)).returning())
        .length > 0,
  );
}

export function archiveVendorRow(organizationId: string, vendorId: string): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    await tx.update(vendors).set({ archivedAt: new Date(), updatedAt: new Date() }).where(eq(vendors.id, vendorId));
  });
}

// Lot 39a (UX-07 ; D6 ; ADR 0073) : « Annuler » après l'archivage remet la fiche au carnet.
export function unarchiveVendorRow(organizationId: string, vendorId: string): Promise<boolean> {
  return inOrganization(organizationId, async (tx) =>
    (await tx.update(vendors).set({ archivedAt: null, updatedAt: new Date() }).where(and(eq(vendors.id, vendorId), isNotNull(vendors.archivedAt))).returning({ id: vendors.id })).length > 0,
  );
}

export function findVendor(organizationId: string, vendorId: string): Promise<{ vendor: VendorRow; files: VendorFileRow[] } | null> {
  return inOrganization(organizationId, async (tx) => {
    const [vendor] = await tx.select().from(vendors).where(eq(vendors.id, vendorId));
    if (!vendor) return null;
    const files = await tx.select().from(vendorFiles).where(eq(vendorFiles.vendorId, vendorId)).orderBy(asc(vendorFiles.createdAt));
    return { vendor: (await withTypeLinks(tx, [vendor]))[0]!, files };
  });
}

export function findVendorsByIds(organizationId: string, vendorIds: string[]): Promise<VendorRow[]> {
  if (vendorIds.length === 0) return Promise.resolve([]);
  return inOrganization(organizationId, async (tx) => withTypeLinks(tx, await tx.select().from(vendors).where(inArray(vendors.id, vendorIds))));
}

// Distance à vol d'oiseau calculée par la base (haversine, ADR 0031 § 4).
function distanceSql(around: { latitude: number; longitude: number }): SQL<number> {
  return sql<number>`(2 * ${EARTH_RADIUS_KM} * asin(least(1, sqrt(
    power(sin(radians(${vendors.latitude} - ${around.latitude}) / 2), 2)
    + cos(radians(${around.latitude})) * cos(radians(${vendors.latitude}))
    * power(sin(radians(${vendors.longitude} - ${around.longitude}) / 2), 2)))))`;
}

// Filtre sur un champ du type, appliqué par la base (ADR 0031 § 3) : le
// service a déjà vérifié que le filtre convient au format du champ.
function fieldFilterSql(filter: VendorFieldFilter & { kind: VendorFieldKind }): SQL {
  const raw = sql`(${vendors.fieldValues} ->> ${filter.fieldId})`;
  if (filter.op === "eq") return sql`${raw} = ${String(filter.value)}`;
  const comparator = filter.op === "gte" ? sql`>=` : sql`<=`;
  if (filter.kind === "time") return sql`${raw} ${comparator} ${String(filter.value)}`;
  return sql`(jsonb_typeof(${vendors.fieldValues} -> ${filter.fieldId}) = 'number' and ${raw}::numeric ${comparator} ${Number(filter.value)})`;
}

export function findVendorRows(
  organizationId: string,
  input: {
    words: string[];
    typeIds?: string[] | undefined;
    // Lot 16 (L16-PRE-14) : types d'une famille, ou « à classer » (avec les fiches sans type).
    typeScope?: { typeIds: string[]; includeUntyped: boolean } | undefined;
    tagIds?: string[] | undefined;
    fieldFilters: (VendorFieldFilter & { kind: VendorFieldKind })[];
    onlyIds?: string[] | undefined;
    unplacedOnly?: boolean | undefined;
    minRating?: number | undefined;
    around?: VendorAround | undefined;
    includeArchived: boolean;
    // Lot 73a : tri fait par la base (nom, métier principal, évaluation, distance) et son sens ; le nom
    // départage toujours.
    sort?: "name" | "type" | "rating" | "distance";
    direction?: "asc" | "desc";
    limit: number;
  },
): Promise<{ vendor: VendorRow; distanceKm: number | null }[]> {
  return inOrganization(organizationId, async (tx) => {
    const conditions: SQL[] = [];
    if (!input.includeArchived) conditions.push(isNull(vendors.archivedAt));
    if (input.unplacedOnly) conditions.push(isNull(vendors.latitude));
    if (input.minRating !== undefined) conditions.push(gte(vendors.rating, input.minRating));
    // Lot 63e (PRE-01, PRE-11) : une fiche est trouvée par n'importe lequel de ses métiers.
    if (input.typeIds && input.typeIds.length > 0) conditions.push(hasAnyTypeSql(input.typeIds));
    if (input.typeScope) {
      const scope = [
        ...(input.typeScope.typeIds.length > 0 ? [hasAnyTypeSql(input.typeScope.typeIds)] : []),
        ...(input.typeScope.includeUntyped ? [hasNoTypeSql()] : []),
      ];
      conditions.push(scope.length > 0 ? or(...scope)! : sql`false`);
    }
    if (input.tagIds && input.tagIds.length > 0) conditions.push(sql`${vendors.tagIds} @> array[${sql.join(input.tagIds.map((id) => sql`${id}`), sql`, `)}]::uuid[]`);
    if (input.onlyIds) conditions.push(input.onlyIds.length > 0 ? inArray(vendors.id, input.onlyIds) : sql`false`);
    const haystack = foldedColumn(sql`concat_ws(' ', ${vendors.name}, ${vendors.city}, ${vendors.postalCode}, ${typeLabelsSql()})`);
    for (const word of input.words) conditions.push(sql`${haystack} like ${likeWord(word)}`);
    for (const filter of input.fieldFilters) conditions.push(fieldFilterSql(filter));
    const distance = input.around ? distanceSql(input.around) : null;
    if (input.around && distance) {
      conditions.push(sql`${vendors.latitude} is not null and ${distance} <= ${input.around.radiusKm}`);
    }
    const rows = await tx
      .select({ vendor: vendors, distanceKm: distance ?? sql<null>`null` })
      .from(vendors)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(...vendorOrder(input.sort ?? (distance ? "distance" : "name"), input.direction ?? "asc", distance))
      .limit(input.limit);
    const typed = await withTypeLinks(tx, rows.map((row) => row.vendor));
    return rows.map((row, index) => ({ vendor: typed[index]!, distanceKm: row.distanceKm === null ? null : Number(row.distanceKm) }));
  });
}

// Lot 73a : l'ordre du carnet. Une fiche sans métier ou sans évaluation vient après les autres, dans les
// deux sens ; le nom départage.
function vendorOrder(sort: "name" | "type" | "rating" | "distance", direction: "asc" | "desc", distance: SQL<number> | null): SQL[] {
  const way = direction === "desc" ? sql`desc` : sql`asc`;
  const name = sql`${vendors.name} ${way}`;
  if (sort === "type") return [sql`(select ${vendorTypes.label} from ${vendorTypeLinks} join ${vendorTypes} on ${vendorTypes.id} = ${vendorTypeLinks.typeId} where ${vendorTypeLinks.vendorId} = ${vendors.id} and ${vendorTypeLinks.isPrimary} limit 1) ${way} nulls last`, asc(vendors.name)];
  if (sort === "rating") return [sql`${vendors.rating} ${way} nulls last`, asc(vendors.name)];
  if (sort === "distance" && distance) return [sql`${distance} ${way}`, asc(vendors.name)];
  return [name];
}

// Recherche globale (AIDE-08) : jamais les fiches d'exemple ni archivées.
export function searchVendorRows(organizationId: string, words: string[], limit: number): Promise<VendorRow[]> {
  return inOrganization(organizationId, async (tx) => {
    const haystack = foldedColumn(sql`concat_ws(' ', ${vendors.name}, ${vendors.city}, ${vendors.contactName}, ${typeLabelsSql()})`);
    const rows = await tx
      .select()
      .from(vendors)
      .where(and(eq(vendors.isDemo, false), isNull(vendors.archivedAt), ...words.map((word) => sql`${haystack} like ${likeWord(word)}`)))
      .orderBy(asc(vendors.name))
      .limit(limit);
    return withTypeLinks(tx, rows);
  });
}

// Fichiers (plaquettes, RIB).

export function insertVendorFile(
  organizationId: string,
  input: { vendorId: string; kind: VendorFileKind; fileName: string; fileKey: string; mime: string; sizeBytes: number; uploadedByUserId: string },
): Promise<VendorFileRow> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.insert(vendorFiles).values({ organizationId, ...input }).returning();
    if (!row) throw new Error("insertion du fichier échouée");
    return row;
  });
}

export function findVendorFile(organizationId: string, fileId: string): Promise<VendorFileRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.select().from(vendorFiles).where(eq(vendorFiles.id, fileId)))[0] ?? null);
}

export function deleteVendorFileRow(organizationId: string, fileId: string): Promise<VendorFileRow | null> {
  return inOrganization(organizationId, async (tx) => (await tx.delete(vendorFiles).where(eq(vendorFiles.id, fileId)).returning())[0] ?? null);
}

// L11-PRE-07 — paramètres du trajet.

export function findVendorSettings(organizationId: string): Promise<VendorSettings | null> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(vendorSettings);
    return row ? { detourFactorPermille: row.detourFactorPermille, averageSpeedKmh: row.averageSpeedKmh } : null;
  });
}

export function upsertVendorSettings(organizationId: string, settings: VendorSettings): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    await tx
      .insert(vendorSettings)
      .values({ organizationId, ...settings })
      .onConflictDoUpdate({ target: vendorSettings.organizationId, set: { ...settings, updatedAt: new Date() } });
  });
}

// Essais et tutoriels : fiches d'exemple supprimées (fichiers compris).
export function deleteDemoVendors(organizationId: string, vendorIds: string[]): Promise<string[]> {
  if (vendorIds.length === 0) return Promise.resolve([]);
  return inOrganization(organizationId, async (tx) => {
    const files = await tx.select({ fileKey: vendorFiles.fileKey }).from(vendorFiles).where(inArray(vendorFiles.vendorId, vendorIds));
    // Lot 48a (PRE-05) : les pièces d'une fiche d'exemple partent avec elle.
    const documents = await tx.select({ fileKey: vendorDocuments.fileKey }).from(vendorDocuments).where(inArray(vendorDocuments.vendorId, vendorIds));
    await tx.delete(vendors).where(and(inArray(vendors.id, vendorIds), eq(vendors.isDemo, true)));
    return [...files.map((file) => file.fileKey), ...documents.flatMap((document) => (document.fileKey ? [document.fileKey] : []))];
  });
}

// Lot 33b (PAR-01, étape 6) : prestataires réels du carnet (liste de prise en main).
export async function countRealVendors(organizationId: string): Promise<number> {
  return await withOrganization(appDatabase(), organizationId, async (tx) => {
    const [row] = await tx.select({ count: sql<number>`count(*)::int` }).from(vendors).where(eq(vendors.isDemo, false));
    return row?.count ?? 0;
  });
}
