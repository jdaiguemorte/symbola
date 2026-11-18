// Lot 50 (INV-06 ; D5) — types de repas de l'organisation : copiés des données de départ
// (meal-types.json), renommés (le libellé remplace celui de départ ; la clé reste pour la valeur par
// défaut), ajoutés, masqués (masquer n'efface rien) ; type choisi pour un invité (adolescent servi en
// adulte), sinon la valeur par défaut tirée de l'âge. Exposé seulement par service.ts (ADR 0011).
import { and, eq } from "drizzle-orm";
import { guests, mealTypes } from "@symbola/db/schema/guests";
import { starterMealTypeLabel } from "@symbola/starter-templates";
import type { GuestLocale, MealTypeView } from "@symbola/contracts";
import { assertGuestsReady, eventContext } from "./households";
import { ensureMealTypes, inOrganization, UUID, type MealTypeRow } from "./repository";
import { SeatingInvalidError, SeatingNotFoundError } from "./seating-errors";

export function mealTypeLabel(row: Pick<MealTypeRow, "label" | "starterKey">, locale: GuestLocale): string {
  return row.label ?? (row.starterKey ? (starterMealTypeLabel(row.starterKey, locale) ?? row.starterKey) : "");
}

function view(row: MealTypeRow, locale: GuestLocale): MealTypeView {
  return { id: row.id, starterKey: row.starterKey, label: mealTypeLabel(row, locale), hidden: row.hidden };
}

function cleanLabel(label: string): string {
  const clean = label.replace(/\s+/g, " ").trim();
  if (!clean || clean.length > 60) throw new SeatingInvalidError("meal_label");
  return clean;
}

export async function listMealTypes(organizationId: string, locale: GuestLocale): Promise<MealTypeView[]> {
  const rows = await inOrganization(organizationId, (tx) => ensureMealTypes(tx, organizationId));
  return rows.map((row) => view(row, locale));
}

export async function addMealType(organizationId: string, label: string, locale: GuestLocale): Promise<MealTypeView> {
  const clean = cleanLabel(label);
  return inOrganization(organizationId, async (tx) => {
    const existing = await ensureMealTypes(tx, organizationId);
    const position = existing.reduce((max, row) => Math.max(max, row.position + 1), 0);
    const [row] = await tx.insert(mealTypes).values({ organizationId, starterKey: null, label: clean, position }).returning();
    return view(row!, locale);
  });
}

// null : un type de départ reprend son libellé traduit.
export async function renameMealType(organizationId: string, mealTypeId: string, label: string | null): Promise<void> {
  if (!UUID.test(mealTypeId)) throw new SeatingNotFoundError();
  const clean = label === null || label.trim() === "" ? null : cleanLabel(label);
  await inOrganization(organizationId, async (tx) => {
    const [row] = await tx.select().from(mealTypes).where(eq(mealTypes.id, mealTypeId));
    if (!row) throw new SeatingNotFoundError();
    if (clean === null && !row.starterKey) throw new SeatingInvalidError("meal_label");
    await tx.update(mealTypes).set({ label: clean, updatedAt: new Date() }).where(eq(mealTypes.id, mealTypeId));
  });
}

export async function setMealTypeHidden(organizationId: string, mealTypeId: string, hidden: boolean): Promise<void> {
  if (!UUID.test(mealTypeId)) return;
  await inOrganization(organizationId, (tx) => tx.update(mealTypes).set({ hidden, updatedAt: new Date() }).where(eq(mealTypes.id, mealTypeId)));
}

// null : la valeur par défaut tirée de l'âge.
export async function setGuestMealType(organizationId: string, eventId: string, guestId: string, mealTypeId: string | null): Promise<void> {
  await assertGuestsReady(organizationId);
  await eventContext(organizationId, eventId);
  if (!UUID.test(guestId) || (mealTypeId !== null && !UUID.test(mealTypeId))) throw new SeatingNotFoundError();
  await inOrganization(organizationId, async (tx) => {
    if (mealTypeId) {
      const [type] = await tx.select({ id: mealTypes.id }).from(mealTypes).where(eq(mealTypes.id, mealTypeId));
      if (!type) throw new SeatingNotFoundError();
    }
    const updated = await tx.update(guests).set({ mealTypeId, updatedAt: new Date() }).where(and(eq(guests.id, guestId), eq(guests.eventId, eventId))).returning({ id: guests.id });
    if (updated.length === 0) throw new SeatingNotFoundError();
  });
}
