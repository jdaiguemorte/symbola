// Lot 14 (IMP-07) — import de fiches du carnet de prestataires (ADR 0022),
// exposé par service.ts : types et étiquettes créés au besoin (décisions L
// et N), fiches créées ou mises à jour en une transaction, puis placées sur
// la carte comme une saisie à la main (ADR 0031) ; relecture et annulation.
// Une fiche liée depuis à un événement ou à laquelle un fichier a été joint
// n'est jamais supprimée par une annulation ; un type ou une étiquette créés
// par l'import ne sont retirés que s'ils ne servent plus.
import { and, arrayOverlaps, eq, isNull, sql } from "drizzle-orm";
import { sameImportValue, type ImportApplyResult, type ImportApplyRow, type ImportedItem, type ImportUndoItem, type ImportUndoOutcome } from "@symbola/contracts";
import { appDatabase } from "@symbola/db/client";
import { vendorFiles, vendors, vendorTags, vendorTypeLinks, vendorTypes } from "@symbola/db/schema/vendors";
import { withOrganization } from "@symbola/db/with-organization";
import { normalizeVendorImportValues, type VendorsExportRow } from "@symbola/import-engine";
import { planningSoftwareProfile } from "@symbola/starter-templates";
import { typeLinksOf, writeTypeLinks } from "./repository";
import { vendorTypeLabels } from "./type-split";

type Tx = Parameters<Parameters<typeof withOrganization>[2]>[0];
type Values = Record<string, unknown>;

// Lot 71d (HUB-14, I10) : `outer`, la transaction d'organisation de « Retirer toute la reprise… ».
async function inTransaction<T>(organizationId: string, fn: (tx: Tx) => Promise<T>, outer?: Tx): Promise<T> {
  if (outer) return fn(outer);
  const db = appDatabase();
  return await withOrganization(db, organizationId, fn);
}

const same = sameImportValue;
// Couleur d'un type « à classer » (sans famille) sur la carte.
const UNCLASSIFIED_COLOR = "#78716c";
const folded = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLocaleLowerCase("fr").replace(/\s+/g, " ").trim();

// Fiches rapprochables : celles du carnet, hors exemples et archives.
export async function listVendorImportCandidates(organizationId: string): Promise<{ id: string; name: string; city: string | null }[]> {
  return inTransaction(organizationId, (tx) =>
    tx
      .select({ id: vendors.id, name: vendors.name, city: vendors.city })
      .from(vendors)
      .where(and(eq(vendors.isDemo, false), isNull(vendors.archivedAt))),
  );
}

// Lot 71e (R14 ; maquette 11) — l'annuaire d'un programme repris, comparé au carnet : nom, contact et
// téléphone de chaque fiche.
export async function listVendorDirectoryCandidates(organizationId: string): Promise<{ id: string; name: string; contactName: string | null; phone: string | null }[]> {
  return inTransaction(organizationId, (tx) =>
    tx
      .select({ id: vendors.id, name: vendors.name, contactName: vendors.contactName, phone: vendors.phone })
      .from(vendors)
      .where(and(eq(vendors.isDemo, false), isNull(vendors.archivedAt))),
  );
}

// « Ajouter les N téléphones » : complète le téléphone d'une fiche qui n'en a pas ; une fiche qui en a
// déjà un n'est pas touchée. Rend le nombre de fiches complétées.
export async function addVendorPhones(organizationId: string, updates: readonly { vendorId: string; phone: string }[]): Promise<number> {
  return inTransaction(organizationId, async (tx) => {
    let added = 0;
    for (const update of updates) {
      const phone = update.phone.trim();
      if (!phone) continue;
      const changed = await tx
        .update(vendors)
        .set({ phone, updatedAt: new Date() })
        .where(and(eq(vendors.id, update.vendorId), isNull(vendors.phone), eq(vendors.isDemo, false)))
        .returning({ id: vendors.id });
      added += changed.length;
    }
    return added;
  });
}

// Lot 71d (HUB-14, PRE-01 ; maquette 08) — « Ce n'est pas la même : créer une fiche » : une fiche du
// carnet par prestataire nommé dans un budget, sous le nom du fichier, avec son métier quand l'orchestrateur
// en a trouvé un du carnet (sinon « à classer »). Journalisée comme une fiche importée : le retrait de
// l'import la retire, sauf si elle a été retouchée ou retenue ailleurs depuis.
// Lot 71e (PRE-01) : les coordonnées lues dans un PDF de prestataires retenus ou dans l'annuaire d'un
// programme (contact, e-mail, téléphone) vont sur la fiche créée.
export type NamedVendorDetails = { contactName?: string | null; email?: string | null; phone?: string | null };

export async function importNamedVendors(organizationId: string, list: readonly ({ name: string; typeId: string | null } & NamedVendorDetails)[]): Promise<{ items: ImportedItem[]; idByName: Map<string, string> }> {
  return inTransaction(organizationId, async (tx) => {
    const items: ImportedItem[] = [];
    const idByName = new Map<string, string>();
    const typeIds = new Set((await tx.select({ id: vendorTypes.id }).from(vendorTypes)).map((type) => type.id));
    for (const entry of list) {
      const name = entry.name.trim();
      if (!name || idByName.has(name)) continue;
      const details = { contactName: entry.contactName?.trim() || null, email: entry.email?.trim() || null, phone: entry.phone?.trim() || null };
      const [created] = await tx
        .insert(vendors)
        .values({ organizationId, name, ...Object.fromEntries(Object.entries(details).filter(([, value]) => value !== null)) })
        .returning({ id: vendors.id });
      if (!created) throw new Error("création de la fiche échouée");
      // Un métier qui n'est pas de l'organisation n'est pas posé (la fiche reste « à classer »).
      if (entry.typeId && typeIds.has(entry.typeId)) await writeTypeLinks(tx, organizationId, created.id, [entry.typeId]);
      idByName.set(name, created.id);
      items.push({ rowIndex: null, module: "vendors", kind: "vendor", elementId: created.id, action: "created", previous: null, written: (await vendorState(tx, created.id)) ?? {} });
    }
    return { items, idByName };
  });
}

// Valeurs d'une ligne remises en état (entités HTML, code postal, téléphones,
// critères), quelle que soit l'origine du fichier.
export function vendorImportRecord(values: ImportApplyRow["values"]): VendorsExportRow | null {
  return normalizeVendorImportValues(values, planningSoftwareProfile().vendors.listSeparator);
}

function webAddress(value: string | null): string | null {
  if (!value) return null;
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

// Note interne : la description des prestations, puis les autres numéros.
function noteOf(record: VendorsExportRow): string | null {
  const phones = record.otherPhones.map((phone) => (phone.label ? `${phone.number} (${phone.label})` : phone.number)).join("\n");
  const parts = [record.services, phones].filter((part): part is string => Boolean(part));
  return parts.length > 0 ? parts.join("\n\n") : null;
}

// Lot 63e (ADR 0105) : l'état garde les métiers (typeIds, le principal en premier) et, pour les imports
// journalisés avant le lot, leur métier principal sous l'ancien nom typeId.
async function vendorState(tx: Tx, id: string): Promise<Values | null> {
  const [row] = await tx.select().from(vendors).where(eq(vendors.id, id));
  if (!row) return null;
  const typeIds = (await typeLinksOf(tx, [id])).get(id)?.typeIds ?? [];
  return {
    name: row.name,
    typeIds,
    typeId: typeIds[0] ?? null,
    contactName: row.contactName,
    email: row.email,
    phone: row.phone,
    addressLine: row.addressLine,
    postalCode: row.postalCode,
    city: row.city,
    website: row.website,
    socialLinks: row.socialLinks,
    siret: row.siret,
    internalNote: row.internalNote,
    rating: row.rating,
    indicativePrices: row.indicativePrices,
    tagIds: row.tagIds,
    importedFields: row.importedFields,
  };
}

const ADDRESS_KEYS = ["addressLine", "postalCode", "city"] as const;

// Lot 16 (IMP-12, ADR 0040) — ce que devient un libellé du fichier : un type du
// carnet ; un type de départ de sa famille, créé une seule fois pour tous ses
// synonymes (libellé, famille et couleur fournis par l'appelant) ; un type créé
// sous le libellé du fichier ; ou aucun type (fiche « à classer »).
export type VendorTypeTarget =
  | { kind: "existing"; typeId: string }
  | { kind: "starter"; starterKey: string; typeLabel: string; familyId: string | null; color: string }
  | { kind: "new"; familyId: string | null; color: string }
  | { kind: "none" };

// Sans `target` (imports d'avant le lot 16) : `typeId`, ou un type créé sous le libellé.
export type VendorTypeChoiceInput = { label: string; typeId: string | null; target?: VendorTypeTarget };

export async function importVendorRows(input: {
  organizationId: string;
  rows: ImportApplyRow[];
  // Décision N : type du fichier → type du carnet, ou null pour le créer.
  typeChoices: VendorTypeChoiceInput[];
  // Lot 16 (IMP-12) : intitulé de la colonne des types ; une fiche sans type y
  // garde le libellé du fichier, en champ importé.
  typeColumnHeader?: string | null;
}): Promise<ImportApplyResult> {
  const result = await inTransaction(input.organizationId, async (tx) => {
    const items: ImportedItem[] = [];
    let unchanged = 0;
    const records = input.rows.map((row) => ({ row, record: vendorImportRecord(row.values) }));

    // Types : un type choisi doit exister dans l'organisation ; sinon il est
    // créé, une seule fois (un type de départ sert à tous ses synonymes).
    const existingTypes = await tx
      .select({ id: vendorTypes.id, label: vendorTypes.label, position: vendorTypes.position, starterKey: vendorTypes.starterKey })
      .from(vendorTypes);
    const choices = new Map(input.typeChoices.map((choice) => [folded(choice.label), choice]));
    const typeByLabel = new Map<string, string | null>();
    const typeByStarterKey = new Map(existingTypes.filter((type) => type.starterKey).map((type) => [type.starterKey!, type.id]));
    let position = existingTypes.reduce((max, type) => Math.max(max, type.position + 1), 0);
    const createType = async (values: { label: string; color: string; familyId: string | null; starterKey: string | null }) => {
      const [created] = await tx.insert(vendorTypes).values({ organizationId: input.organizationId, ...values, position: position++ }).returning();
      if (!created) throw new Error("création du type échouée");
      items.push({ rowIndex: null, module: "vendors", kind: "vendor_type", elementId: created.id, action: "created", previous: null, written: { label: created.label } });
      return created.id;
    };
    // Lot 63e (PRE-01, PRE-11) : une valeur combinée (« Photographe et vidéaste ») donne plusieurs
    // métiers, chacun choisi à l'étape « Types » sous son propre libellé.
    const typeLabelsOf = (value: string | null) => (value ? vendorTypeLabels(value) : []);
    for (const label of records.flatMap(({ record }) => typeLabelsOf(record?.type ?? null))) {
      const key = folded(label);
      if (typeByLabel.has(key)) continue;
      const choice = choices.get(key);
      const target: VendorTypeTarget = choice?.target ?? (choice?.typeId ? { kind: "existing", typeId: choice.typeId } : { kind: "new", familyId: null, color: UNCLASSIFIED_COLOR });
      if (target.kind === "existing" && existingTypes.some((type) => type.id === target.typeId)) {
        typeByLabel.set(key, target.typeId);
      } else if (target.kind === "starter") {
        let typeId = typeByStarterKey.get(target.starterKey);
        if (!typeId) {
          typeId = await createType({ label: target.typeLabel, color: target.color, familyId: target.familyId, starterKey: target.starterKey });
          typeByStarterKey.set(target.starterKey, typeId);
        }
        typeByLabel.set(key, typeId);
      } else if (target.kind === "none") {
        typeByLabel.set(key, null);
      } else {
        // Lot 16 (L16-PRE-14) : sans famille choisie, le type part « à classer ».
        const familyId = target.kind === "new" ? target.familyId : null;
        const color = target.kind === "new" ? target.color : UNCLASSIFIED_COLOR;
        typeByLabel.set(key, await createType({ label, color, familyId, starterKey: null }));
      }
    }

    // Étiquettes (décision L) : un critère devient une étiquette, créée si besoin.
    const tagByLabel = new Map((await tx.select({ id: vendorTags.id, label: vendorTags.label }).from(vendorTags)).map((tag) => [folded(tag.label), tag.id]));
    for (const { record } of records) {
      for (const criterion of record?.criteria ?? []) {
        const key = folded(criterion);
        if (tagByLabel.has(key)) continue;
        const [created] = await tx.insert(vendorTags).values({ organizationId: input.organizationId, label: criterion }).returning();
        if (!created) throw new Error("création de l'étiquette échouée");
        tagByLabel.set(key, created.id);
        items.push({ rowIndex: null, module: "vendors", kind: "vendor_tag", elementId: created.id, action: "created", previous: null, written: { label: created.label } });
      }
    }

    for (const { row, record } of records) {
      if (!record) {
        unchanged += 1;
        continue;
      }
      const tagIds = [...new Set(record.criteria.map((criterion) => tagByLabel.get(folded(criterion))).filter((id): id is string => Boolean(id)))];
      const typeIds = [...new Set(typeLabelsOf(record.type).flatMap((label) => typeByLabel.get(folded(label)) ?? []))];
      const wanted: Values = {
        name: record.name,
        typeIds,
        contactName: record.contactName,
        email: record.email,
        phone: record.phone,
        addressLine: record.addressLine,
        postalCode: record.postalCode,
        city: record.city,
        website: webAddress(record.website),
        socialLinks: record.socialLinks.map((link) => ({ network: link.network, url: webAddress(link.url) })),
        siret: record.siret,
        internalNote: noteOf(record),
        // Lot 28c (PRE-01) : évaluation et tarifs indicatifs.
        rating: record.rating,
        indicativePrices: record.indicativePrices,
      };
      // Lot 16 (IMP-12) : sans type, le libellé du fichier reste lisible sur la fiche.
      const keptType = record.type && typeIds.length === 0 && input.typeColumnHeader ? { [input.typeColumnHeader]: record.type } : {};
      const extra = { ...row.importedFields, ...keptType };
      const importedFields = Object.keys(extra).length > 0 ? extra : null;
      const current = row.matchId ? await vendorState(tx, row.matchId) : null;

      if (row.matchId && current) {
        // Une cellule vide ne remplace jamais une valeur existante ; la note
        // et les étiquettes s'ajoutent à celles de la fiche.
        const update: Values = {};
        for (const [key, value] of Object.entries(wanted)) {
          if (value === null || (Array.isArray(value) && value.length === 0)) continue;
          if (key === "internalNote" && typeof current.internalNote === "string" && current.internalNote.includes(value as string)) continue;
          update[key] = key === "internalNote" && current.internalNote ? `${current.internalNote as string}\n\n${value as string}` : value;
        }
        const mergedTags = [...new Set([...((current.tagIds as string[]) ?? []), ...tagIds])];
        update.tagIds = mergedTags;
        // Lot 63e : les métiers du fichier s'ajoutent à ceux de la fiche, qui garde son principal.
        if (typeIds.length > 0) update.typeIds = [...new Set([...((current.typeIds as string[]) ?? []), ...typeIds])];
        if (importedFields) update.importedFields = { ...((current.importedFields as Record<string, string> | null) ?? {}), ...importedFields };
        const keys = Object.keys(update).filter((key) => !same(current[key], update[key]));
        if (keys.length === 0) {
          unchanged += 1;
          continue;
        }
        const written = Object.fromEntries(keys.map((key) => [key, update[key]]));
        await writeVendorValues(tx, input.organizationId, row.matchId, written);
        const previous: Values = Object.fromEntries(keys.map((key) => [key, current[key] ?? null]));
        // Adresse changée : le point d'avant est gardé pour l'annulation.
        if (keys.some((key) => (ADDRESS_KEYS as readonly string[]).includes(key))) {
          const [point] = await tx
            .select({ latitude: vendors.latitude, longitude: vendors.longitude, locationSource: vendors.locationSource })
            .from(vendors)
            .where(eq(vendors.id, row.matchId));
          Object.assign(previous, point ?? {});
        }
        items.push({ rowIndex: row.rowIndex, module: "vendors", kind: "vendor", elementId: row.matchId, action: "updated", previous, written });
        continue;
      }

      const [created] = await tx
        .insert(vendors)
        .values({
          organizationId: input.organizationId,
          name: record.name,
          contactName: record.contactName,
          email: record.email,
          phone: record.phone,
          addressLine: record.addressLine,
          postalCode: record.postalCode,
          city: record.city,
          website: wanted.website as string | null,
          socialLinks: wanted.socialLinks as { network: string; url: string }[],
          siret: record.siret,
          internalNote: wanted.internalNote as string | null,
          rating: record.rating,
          indicativePrices: record.indicativePrices,
          tagIds,
          importedFields,
        })
        .returning();
      if (!created) throw new Error("création de la fiche échouée");
      if (typeIds.length > 0) await writeTypeLinks(tx, input.organizationId, created.id, typeIds);
      items.push({ rowIndex: row.rowIndex, module: "vendors", kind: "vendor", elementId: created.id, action: "created", previous: null, written: (await vendorState(tx, created.id)) ?? {} });
    }
    return { items, unchanged };
  });

  // Lot 15 (GEO-01) : le placement sur la carte se fait ensuite, en tâche de
  // fond (placeVendors), pour ne pas faire attendre la planner.
  return result;
}

// Fiches à placer sur la carte après l'import : créées avec une adresse, ou
// dont l'adresse a changé (lot 15, GEO-01).
export function importedVendorsToPlace(items: Pick<ImportedItem, "kind" | "elementId" | "written">[]): string[] {
  return items.filter((item) => item.kind === "vendor" && ADDRESS_KEYS.some((key) => key in item.written && item.written[key])).map((item) => item.elementId);
}

async function stateOf(tx: Tx, kind: string, id: string): Promise<Values | null> {
  if (kind === "vendor") return vendorState(tx, id);
  if (kind === "vendor_type") {
    const [type] = await tx.select({ label: vendorTypes.label }).from(vendorTypes).where(eq(vendorTypes.id, id));
    return type ? { label: type.label } : null;
  }
  const [tag] = await tx.select({ label: vendorTags.label }).from(vendorTags).where(eq(vendorTags.id, id));
  return tag ? { label: tag.label } : null;
}

// Lot 16 (L16-PRE-15) : le type d'une fiche importée, disparu depuis par une fusion
// ou une suppression (ses fiches déplacées), n'est pas une modification à la
// main ; l'import reste annulable.
function modifiedSince(current: Values, written: Values | null, existingTypeIds: Set<string>): boolean {
  return Object.keys(written ?? {}).some((key) => {
    const value = (written ?? {})[key];
    if (key === "typeId" && typeof value === "string" && !existingTypeIds.has(value)) return false;
    // Lot 63e : seuls comptent les métiers encore au carnet (un type fusionné ou supprimé depuis n'est
    // pas une modification à la main).
    if (key === "typeIds" && Array.isArray(value)) {
      const kept = (value as string[]).filter((id) => existingTypeIds.has(id));
      const currentIds = (current.typeIds as string[] | undefined) ?? [];
      if (kept.length < (value as string[]).length) return !kept.every((id) => currentIds.includes(id));
      return !same(currentIds, value);
    }
    return !same(current[key], value);
  });
}

// Valeurs d'une fiche écrites d'un bloc : colonnes, puis métiers (typeIds, ou l'ancien typeId d'un
// import journalisé avant le lot 63e).
async function writeVendorValues(tx: Tx, organizationId: string, vendorId: string, values: Values): Promise<void> {
  const { typeIds, typeId, ...columns } = values;
  await tx
    .update(vendors)
    .set({ ...(columns as Partial<typeof vendors.$inferInsert>), updatedAt: new Date() })
    .where(eq(vendors.id, vendorId));
  if (Array.isArray(typeIds)) await writeTypeLinks(tx, organizationId, vendorId, (typeIds as string[]).filter((id) => typeof id === "string"));
  else if (typeId !== undefined) await writeTypeLinks(tx, organizationId, vendorId, typeof typeId === "string" ? [typeId] : []);
}

async function typeIdsOf(tx: Tx): Promise<Set<string>> {
  return new Set((await tx.select({ id: vendorTypes.id }).from(vendorTypes)).map((type) => type.id));
}

export async function findModifiedImportedVendorsElements(
  organizationId: string,
  items: Pick<ImportUndoItem, "kind" | "elementId" | "action" | "written">[],
): Promise<boolean[]> {
  return inTransaction(organizationId, async (tx) => {
    const result: boolean[] = [];
    const existingTypeIds = await typeIdsOf(tx);
    for (const item of items) {
      const current = await stateOf(tx, item.kind, item.elementId);
      result.push(current ? modifiedSince(current, item.written, existingTypeIds) : false);
    }
    return result;
  });
}

async function inUse(tx: Tx, kind: string, id: string, linkedVendorIds: Set<string>): Promise<boolean> {
  if (kind === "vendor") {
    if (linkedVendorIds.has(id)) return true;
    const [files] = await tx.select({ n: sql<number>`count(*)::int` }).from(vendorFiles).where(eq(vendorFiles.vendorId, id));
    return (files?.n ?? 0) > 0;
  }
  const [row] =
    kind === "vendor_type"
      ? await tx.select({ n: sql<number>`count(*)::int` }).from(vendorTypeLinks).where(eq(vendorTypeLinks.typeId, id))
      : await tx.select({ n: sql<number>`count(*)::int` }).from(vendors).where(arrayOverlaps(vendors.tagIds, [id]));
  return (row?.n ?? 0) > 0;
}

// `linkedVendorIds` : fiches citées depuis dans un événement (module events,
// lu par service.ts avant l'appel).
export async function undoImportedVendorsElements(organizationId: string, items: ImportUndoItem[], linkedVendorIds: Set<string>, outer?: Tx): Promise<ImportUndoOutcome[]> {
  return inTransaction(organizationId, async (tx) => {
    const outcomes: ImportUndoOutcome[] = [];
    const existingTypeIds = await typeIdsOf(tx);
    for (const item of items) {
      const current = await stateOf(tx, item.kind, item.elementId);
      if (!current) {
        outcomes.push("missing");
        continue;
      }
      if (modifiedSince(current, item.written, existingTypeIds) && !item.force) {
        outcomes.push("kept_modified");
        continue;
      }
      if (item.action === "created") {
        if (await inUse(tx, item.kind, item.elementId, linkedVendorIds)) {
          outcomes.push("kept_in_use");
          continue;
        }
        if (item.kind === "vendor") await tx.delete(vendors).where(eq(vendors.id, item.elementId));
        else if (item.kind === "vendor_type") await tx.delete(vendorTypes).where(eq(vendorTypes.id, item.elementId));
        else await tx.delete(vendorTags).where(eq(vendorTags.id, item.elementId));
      } else if (item.kind === "vendor") {
        const previous = { ...(item.previous ?? {}) } as Values;
        // Un métier disparu depuis (fusion, suppression) ne revient pas.
        if (Array.isArray(previous.typeIds)) previous.typeIds = (previous.typeIds as string[]).filter((id) => existingTypeIds.has(id));
        if (typeof previous.typeId === "string" && !existingTypeIds.has(previous.typeId)) previous.typeId = null;
        await writeVendorValues(tx, organizationId, item.elementId, previous);
      }
      outcomes.push("undone");
    }
    return outcomes;
  }, outer);
}
