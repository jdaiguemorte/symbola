// Accès aux données du module vendors — jamais importé hors de
// modules/vendors/ (ADR 0011). Chaque requête passe par withOrganization
// (RLS, CLAUDE.md § 5).
import { and, asc, eq, inArray, isNull, or, sql, type SQL } from "drizzle-orm";
import { createAppConnection } from "@symbola/db/client";
import { foldedColumn, likeWord } from "@symbola/db/search";
import { vendorFiles, vendors, vendorSettings, vendorTags, vendorTypeFields, vendorTypes } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import type { VendorAround, VendorFieldFilter, VendorFieldKind, VendorFieldValue, VendorFileKind, VendorSettings, VendorSocialLink } from "@symbola/contracts";
import { EARTH_RADIUS_KM } from "./travel";

export type VendorTypeRow = typeof vendorTypes.$inferSelect;
export type VendorTypeFieldRow = typeof vendorTypeFields.$inferSelect;
export type VendorTagRow = typeof vendorTags.$inferSelect;
export type VendorRow = typeof vendors.$inferSelect;
export type VendorFileRow = typeof vendorFiles.$inferSelect;
type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];

async function inOrganization<T>(organizationId: string, fn: (tx: Tx) => Promise<T>): Promise<T> {
  const { sql: pg, db } = createAppConnection();
  try {
    return await withOrganization(db, organizationId, fn);
  } finally {
    await pg.end();
  }
}

// PRE-02 — types et champs.

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
  return inOrganization(organizationId, (tx) => tx.select().from(vendorTags).orderBy(asc(vendorTags.label)));
}

export function insertVendorTag(organizationId: string, label: string): Promise<VendorTagRow> {
  return inOrganization(organizationId, async (tx) => {
    const [row] = await tx.insert(vendorTags).values({ organizationId, label }).returning();
    if (!row) throw new Error("insertion de l'étiquette échouée");
    return row;
  });
}

// L'étiquette disparaît aussi des fiches qui la portaient.
export function deleteVendorTag(organizationId: string, tagId: string): Promise<void> {
  return inOrganization(organizationId, async (tx) => {
    await tx.update(vendors).set({ tagIds: sql`array_remove(${vendors.tagIds}, ${tagId}::uuid)` }).where(sql`${tagId}::uuid = any(${vendors.tagIds})`);
    await tx.delete(vendorTags).where(eq(vendorTags.id, tagId));
  });
}

// PRE-01 — fiches.

export type VendorWrite = {
  typeId: string | null;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  addressLine: string | null;
  postalCode: string | null;
  city: string | null;
  country: string;
  internalNote: string | null;
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
    const { location, ...columns } = input;
    const [row] = await tx
      .insert(vendors)
      .values({ organizationId, ...columns, ...locationColumns(location) })
      .returning();
    if (!row) throw new Error("insertion de la fiche échouée");
    return row;
  });
}

export function updateVendorRow(organizationId: string, vendorId: string, input: VendorWrite): Promise<VendorRow | null> {
  return inOrganization(organizationId, async (tx) => {
    // Une fiche ne devient jamais exemple (ni l'inverse) par une modification.
    const { location, ...columns } = input;
    delete columns.isDemo;
    const [row] = await tx
      .update(vendors)
      .set({ ...columns, ...locationColumns(location), updatedAt: new Date() })
      .where(eq(vendors.id, vendorId))
      .returning();
    return row ?? null;
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

export function findVendor(organizationId: string, vendorId: string): Promise<{ vendor: VendorRow; files: VendorFileRow[] } | null> {
  return inOrganization(organizationId, async (tx) => {
    const [vendor] = await tx.select().from(vendors).where(eq(vendors.id, vendorId));
    if (!vendor) return null;
    const files = await tx.select().from(vendorFiles).where(eq(vendorFiles.vendorId, vendorId)).orderBy(asc(vendorFiles.createdAt));
    return { vendor, files };
  });
}

export function findVendorsByIds(organizationId: string, vendorIds: string[]): Promise<VendorRow[]> {
  if (vendorIds.length === 0) return Promise.resolve([]);
  return inOrganization(organizationId, (tx) => tx.select().from(vendors).where(inArray(vendors.id, vendorIds)));
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
    // Lot 16 (PRE-14) : types d'une famille, ou « à classer » (avec les fiches sans type).
    typeScope?: { typeIds: string[]; includeUntyped: boolean } | undefined;
    tagIds?: string[] | undefined;
    fieldFilters: (VendorFieldFilter & { kind: VendorFieldKind })[];
    onlyIds?: string[] | undefined;
    unplacedOnly?: boolean | undefined;
    around?: VendorAround | undefined;
    includeArchived: boolean;
    limit: number;
  },
): Promise<{ vendor: VendorRow; distanceKm: number | null }[]> {
  return inOrganization(organizationId, async (tx) => {
    const conditions: SQL[] = [];
    if (!input.includeArchived) conditions.push(isNull(vendors.archivedAt));
    if (input.unplacedOnly) conditions.push(isNull(vendors.latitude));
    if (input.typeIds && input.typeIds.length > 0) conditions.push(inArray(vendors.typeId, input.typeIds));
    if (input.typeScope) {
      const scope = [
        ...(input.typeScope.typeIds.length > 0 ? [inArray(vendors.typeId, input.typeScope.typeIds)] : []),
        ...(input.typeScope.includeUntyped ? [isNull(vendors.typeId)] : []),
      ];
      conditions.push(scope.length > 0 ? or(...scope)! : sql`false`);
    }
    if (input.tagIds && input.tagIds.length > 0) conditions.push(sql`${vendors.tagIds} @> array[${sql.join(input.tagIds.map((id) => sql`${id}`), sql`, `)}]::uuid[]`);
    if (input.onlyIds) conditions.push(input.onlyIds.length > 0 ? inArray(vendors.id, input.onlyIds) : sql`false`);
    const haystack = foldedColumn(sql`concat_ws(' ', ${vendors.name}, ${vendors.city}, ${vendors.postalCode})`);
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
      .orderBy(...(distance ? [asc(distance)] : []), asc(vendors.name))
      .limit(input.limit);
    return rows.map((row) => ({ vendor: row.vendor, distanceKm: row.distanceKm === null ? null : Number(row.distanceKm) }));
  });
}

// Recherche globale (AIDE-08) : jamais les fiches d'exemple ni archivées.
export function searchVendorRows(organizationId: string, words: string[], limit: number): Promise<VendorRow[]> {
  return inOrganization(organizationId, (tx) => {
    const haystack = foldedColumn(sql`concat_ws(' ', ${vendors.name}, ${vendors.city}, ${vendors.contactName})`);
    return tx
      .select()
      .from(vendors)
      .where(and(eq(vendors.isDemo, false), isNull(vendors.archivedAt), ...words.map((word) => sql`${haystack} like ${likeWord(word)}`)))
      .orderBy(asc(vendors.name))
      .limit(limit);
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

// PRE-07 — paramètres du trajet.

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
    await tx.delete(vendors).where(and(inArray(vendors.id, vendorIds), eq(vendors.isDemo, true)));
    return files.map((file) => file.fileKey);
  });
}
