// Lot 51 (ARC-09, JRJ-08 ; ADR 0091) — ce que montre l'écran du jour J : l'état partagé reçu du
// serveur (relu toutes les 15 s en ligne), plus les actions de cet appareil encore en file, marquées
// « en attente ». Un téléphone hors ligne voit ainsi au moins ses propres actions. Fonction pure.
import type { DayChecklist, DayChecklistItem, DayHandover, DayIncident, DayItemActual, DayState } from "@symbola/contracts";
import { MINUTES_PER_DAY, clock, toMinutes } from "@/lib/program-spans";
import type { QueuedDayAction } from "@/lib/offline/action-queue";
import { itemActuals } from "./rules";

export type DayTimes = { id: string; startTime: string; endTime: string | null; keyMomentId: string | null };

export type DayView = {
  items: DayTimes[];
  actuals: DayItemActual[];
  pendingCheckpoints: Set<string>;
  incidents: (DayIncident & { pending?: boolean })[];
  checklists: (Omit<DayChecklist, "items"> & { items: (DayChecklistItem & { pending?: boolean })[] })[];
  handovers: (DayHandover & { pending?: boolean })[] | null;
  // Prestataires que les décalages en file préviendront au retour du réseau.
  pendingShiftVendors: number;
};

function shifted(time: string, minutes: number): string {
  return clock((toMinutes(time) + minutes + MINUTES_PER_DAY) % MINUTES_PER_DAY);
}

export function overlayDayState(input: { state: DayState; items: DayTimes[]; handovers: DayHandover[] | null; pending: QueuedDayAction[]; userId: string }): DayView {
  const known = new Set<string>([...input.state.incidents.map((incident) => incident.actionId)]);
  const checkpoints = [...input.state.checkpoints];
  const pendingCheckpoints = new Set<string>();
  const incidents: DayView["incidents"] = [...input.state.incidents];
  const checks = new Map<string, string>();
  const handedOver = new Map<string, string>();
  let items = input.items;
  let pendingShiftVendors = 0;
  for (const entry of input.pending) {
    const action = entry.action;
    if (!action) continue;
    switch (action.kind) {
      case "checkpoint":
        checkpoints.push({ id: action.actionId, itemId: action.itemId, kind: action.checkpoint, deviceAt: action.deviceAt, userId: entry.userId });
        pendingCheckpoints.add(`${action.itemId}:${action.checkpoint}`);
        break;
      case "incident":
        if (!known.has(action.actionId)) incidents.unshift({ id: action.actionId, actionId: action.actionId, keyMomentId: action.keyMomentId, body: action.body, severity: action.severity, deviceAt: action.deviceAt, userId: entry.userId, photos: [], pending: true });
        break;
      case "check":
        checks.set(action.checklistItemId, action.deviceAt);
        break;
      case "handover":
        handedOver.set(action.paymentId, action.deviceAt);
        break;
      case "shift": {
        const chosen = new Set(action.itemIds);
        items = items.map((item) => (chosen.has(item.id) ? { ...item, startTime: shifted(item.startTime, action.minutes), endTime: item.endTime === null ? null : shifted(item.endTime, action.minutes) } : item));
        pendingShiftVendors += action.vendorSlotIds.length;
        break;
      }
    }
  }
  return {
    items,
    actuals: itemActuals(checkpoints),
    pendingCheckpoints,
    incidents,
    checklists: input.state.checklists.map((list) => ({
      ...list,
      items: list.items.map((item) => (item.checkedAt === null && checks.has(item.id) ? { ...item, checkedAt: new Date(checks.get(item.id)!).toISOString(), checkedBy: input.userId, pending: true } : item)),
    })),
    handovers:
      input.handovers?.map((handover) =>
        handover.handedOverAt === null && handedOver.has(handover.paymentId) ? { ...handover, handedOverAt: new Date(handedOver.get(handover.paymentId)!).toISOString(), handedOverBy: input.userId, pending: true } : handover,
      ) ?? null,
    pendingShiftVendors,
  };
}
