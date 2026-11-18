// Lot 50 (INV-05, INV-06 ; D1 à D5) — règles pures du plan de table : qui se place à un temps fort,
// noms des tables ajoutées en série, alertes (contraintes « ensemble » et « séparés », capacité)
// signalées sans jamais bloquer, type de repas par défaut tiré de l'âge. Sans base ni React.
import type { GuestAgeRange, GuestKind, SeatingAlert, SeatingConstraintKind, SeatingGuestStatus } from "@symbola/contracts";

// Présent : se place ; sans réponse : se place, marqué « en attente » ; décliné : n'apparaît pas.
export function seatEligibility(input: { invited: boolean; attending: boolean | undefined }): SeatingGuestStatus | null {
  if (!input.invited || input.attending === false) return null;
  return input.attending === true ? "present" : "pending";
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// « 12 tables rondes de 10 » : Table 1 à Table 12, à la suite du plus grand numéro déjà pris.
export function seriesNames(existing: readonly string[], count: number, prefix: string): string[] {
  const pattern = new RegExp(`^${escapeRegExp(prefix.trim())}\\s+(\\d+)$`, "i");
  const last = existing.reduce((max, name) => {
    const match = pattern.exec(name.trim());
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  return Array.from({ length: count }, (_, index) => `${prefix.trim()} ${last + index + 1}`);
}

type AlertInput = {
  tables: readonly { id: string; name: string; capacity: number }[];
  seats: readonly { guestId: string; tableId: string }[];
  constraints: readonly { id: string; kind: SeatingConstraintKind; guestIds: readonly string[] }[];
  names: ReadonlyMap<string, string>;
};

// D4 : « ensemble » non tenu dès que ses membres placés sont à deux tables ou plus ; « séparés »
// non tenu sur chaque table qui en réunit deux ; capacité dépassée. Ordre : contraintes, puis tables.
export function seatingAlerts(input: AlertInput): Extract<SeatingAlert, { kind: "together" | "apart" | "capacity" }>[] {
  const tableOf = new Map(input.seats.map((seat) => [seat.guestId, seat.tableId]));
  const order = new Map(input.tables.map((table, index) => [table.id, index]));
  const byOrder = (a: string, b: string) => (order.get(a) ?? 0) - (order.get(b) ?? 0);
  const nameOf = (id: string) => input.names.get(id) ?? "";
  const alerts: Extract<SeatingAlert, { kind: "together" | "apart" | "capacity" }>[] = [];
  for (const constraint of input.constraints) {
    const placed = constraint.guestIds.filter((id) => tableOf.has(id));
    if (constraint.kind === "together") {
      const tableIds = [...new Set(placed.map((id) => tableOf.get(id)!))].sort(byOrder);
      if (tableIds.length > 1) alerts.push({ kind: "together", constraintId: constraint.id, tableIds, guestNames: constraint.guestIds.map(nameOf) });
      continue;
    }
    const byTable = new Map<string, string[]>();
    for (const id of placed) byTable.set(tableOf.get(id)!, [...(byTable.get(tableOf.get(id)!) ?? []), id]);
    for (const tableId of [...byTable.keys()].sort(byOrder)) {
      const together = byTable.get(tableId)!;
      if (together.length > 1) alerts.push({ kind: "apart", constraintId: constraint.id, tableId, guestNames: together.map(nameOf) });
    }
  }
  for (const table of input.tables) {
    const occupied = input.seats.filter((seat) => seat.tableId === table.id).length;
    if (occupied > table.capacity) alerts.push({ kind: "capacity", tableId: table.id, occupied, capacity: table.capacity });
  }
  return alerts;
}

// D5 : adulte → « adult » ; enfant → « child », ou « baby » pour la tranche 0-2 ans (clés des
// données de départ meal-types.json).
export function defaultMealTypeKey(person: { kind: GuestKind; ageRange: GuestAgeRange | null }): "adult" | "child" | "baby" {
  if (person.kind === "adult") return "adult";
  return person.ageRange === "0-2" ? "baby" : "child";
}

// Le type choisi pour la personne, s'il existe encore ; sinon la valeur par défaut de l'organisation.
export function resolveMealType(
  person: { kind: GuestKind; ageRange: GuestAgeRange | null; mealTypeId: string | null },
  types: readonly { id: string; starterKey: string | null }[],
): { id: string | null; chosen: boolean } {
  if (person.mealTypeId && types.some((type) => type.id === person.mealTypeId)) return { id: person.mealTypeId, chosen: true };
  const key = defaultMealTypeKey(person);
  return { id: types.find((type) => type.starterKey === key)?.id ?? null, chosen: false };
}
