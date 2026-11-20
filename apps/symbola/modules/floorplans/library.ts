// Lot 60 (L60-PLA-02, partie B) — bibliothèque d'éléments de l'organisation : tables de toutes
// formes et installations de soirée, copiées des données de départ (HUB-20), que la planner masque,
// ajoute et règle (dimensions et besoins par défaut).
import { and, eq } from "drizzle-orm";
import { elementTypes } from "@symbola/db/schema/floorplans";
import type { FloorplanElementType, FloorplanElementTypeInput } from "@symbola/contracts";
import { starterFloorplanElementLabel } from "@symbola/starter-templates";
import { FloorplanInvalidError, FloorplanNotFoundError } from "./errors";
import { elementTypeInputSchema } from "./inputs";
import { ensureElementTypes, inOrganization, UUID, type ElementTypeRow } from "./repository";

export type FloorplanLocale = "fr" | "en";

export function typeLabel(row: Pick<ElementTypeRow, "starterKey" | "label">, locale: FloorplanLocale): string {
  return row.starterKey ? (starterFloorplanElementLabel(row.starterKey, locale) ?? row.starterKey) : (row.label ?? "");
}

function toType(row: ElementTypeRow, locale: FloorplanLocale): FloorplanElementType {
  return {
    id: row.id,
    starterKey: row.starterKey,
    label: typeLabel(row, locale),
    category: row.category,
    shape: row.shape,
    seatRule: row.seatRule,
    widthCm: row.widthCm,
    depthCm: row.depthCm,
    powerOutlets: row.powerOutlets,
    powerAmps: row.powerAmps,
    needsWater: row.needsWater,
    hidden: row.hidden,
  };
}

export async function listElementTypes(organizationId: string, locale: FloorplanLocale): Promise<FloorplanElementType[]> {
  return (await inOrganization(organizationId, (tx) => ensureElementTypes(tx, organizationId))).map((row) => toType(row, locale));
}

function parse(input: FloorplanElementTypeInput) {
  const parsed = elementTypeInputSchema.safeParse(input);
  if (!parsed.success) throw new FloorplanInvalidError("element_type");
  return parsed.data;
}

export async function addElementType(organizationId: string, input: FloorplanElementTypeInput): Promise<string> {
  const value = parse(input);
  return inOrganization(organizationId, async (tx) => {
    const rows = await ensureElementTypes(tx, organizationId);
    const position = rows.reduce((max, row) => Math.max(max, row.position + 1), 0);
    const [created] = await tx.insert(elementTypes).values({ organizationId, ...value, position }).returning({ id: elementTypes.id });
    return created!.id;
  });
}

// Dimensions et besoins par défaut d'une entrée (une entrée de départ garde son libellé traduit).
export async function updateElementType(organizationId: string, typeId: string, input: FloorplanElementTypeInput): Promise<void> {
  const value = parse(input);
  await inOrganization(organizationId, async (tx) => {
    if (!UUID.test(typeId)) throw new FloorplanNotFoundError();
    const [row] = await tx.select().from(elementTypes).where(eq(elementTypes.id, typeId));
    if (!row) throw new FloorplanNotFoundError();
    await tx
      .update(elementTypes)
      .set({
        label: row.starterKey ? null : value.label,
        category: value.category,
        shape: value.shape,
        seatRule: value.seatRule,
        widthCm: value.widthCm,
        depthCm: value.depthCm,
        powerOutlets: value.powerOutlets,
        powerAmps: value.powerAmps,
        needsWater: value.needsWater,
        updatedAt: new Date(),
      })
      .where(eq(elementTypes.id, typeId));
  });
}

export async function setElementTypeHidden(organizationId: string, typeId: string, hidden: boolean): Promise<void> {
  await inOrganization(organizationId, async (tx) => {
    if (!UUID.test(typeId)) throw new FloorplanNotFoundError();
    const changed = await tx.update(elementTypes).set({ hidden, updatedAt: new Date() }).where(and(eq(elementTypes.id, typeId))).returning({ id: elementTypes.id });
    if (changed.length === 0) throw new FloorplanNotFoundError();
  });
}
