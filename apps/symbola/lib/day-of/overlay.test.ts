// Lot 51 (ARC-09, JRJ-08 ; ADR 0091) — un téléphone hors ligne voit au moins ses propres actions :
// l'état reçu du serveur, plus les actions encore en file (marquées « en attente »).
import { describe, expect, it } from "vitest";
import type { DayHandover, DayState } from "@symbola/contracts";
import { overlayDayState } from "./overlay";

const empty: DayState = { eventId: "e", checkpoints: [], actuals: [], shifts: [], incidents: [], checklists: [{ id: "l", keyMomentId: null, name: "Installation", phase: "setup", position: 0, items: [{ id: "c1", label: "Chaises", position: 0, checkedAt: null, checkedBy: null, photos: [] }] }], people: [] };
const items = [
  { id: "i1", startTime: "16:00", endTime: "16:45", keyMomentId: "m" },
  { id: "i2", startTime: "17:00", endTime: null, keyMomentId: "m" },
];
const handovers: DayHandover[] = [{ paymentId: "p1", eventId: "e", vendorName: "Traiteur", slotLabel: "Traiteur", label: "Solde", amountCents: 100, method: null, by: null, handedOverAt: null, handedOverBy: null, receiptPhotoId: null }];

describe("ARC-09 — ce que montre un téléphone hors ligne", () => {
  it("ses pointages, incidents, cases, remises et décalages en file s'ajoutent à l'état reçu, marqués en attente", () => {
    const view = overlayDayState({
      state: empty,
      items,
      handovers,
      userId: "camille",
      pending: [
        { actionId: "a1", eventId: "e", userId: "camille", createdAt: "", action: { kind: "checkpoint", actionId: "a1", deviceAt: "2027-06-12T14:20:00Z", itemId: "i1", checkpoint: "started" } },
        { actionId: "a2", eventId: "e", userId: "camille", createdAt: "", action: { kind: "incident", actionId: "a2", deviceAt: "2027-06-12T14:41:00Z", body: "Portail bloqué", severity: "urgent", keyMomentId: null } },
        { actionId: "a3", eventId: "e", userId: "camille", createdAt: "", action: { kind: "check", actionId: "a3", deviceAt: "2027-06-12T12:00:00Z", checklistItemId: "c1" } },
        { actionId: "a4", eventId: "e", userId: "camille", createdAt: "", action: { kind: "handover", actionId: "a4", deviceAt: "2027-06-12T21:30:00Z", paymentId: "p1" } },
        { actionId: "a5", eventId: "e", userId: "camille", createdAt: "", action: { kind: "shift", actionId: "a5", deviceAt: "2027-06-12T14:21:00Z", keyMomentId: "m", lateItemId: "i1", minutes: 20, itemIds: ["i1", "i2"], vendorSlotIds: ["s1", "s2", "s3"] } },
      ],
    });
    expect(view.actuals).toEqual([{ itemId: "i1", startedAt: "2027-06-12T14:20:00.000Z", startedBy: "camille", finishedAt: null, finishedBy: null, count: 1 }]);
    expect(view.pendingCheckpoints).toEqual(new Set(["i1:started"]));
    expect(view.incidents[0]).toMatchObject({ body: "Portail bloqué", pending: true });
    expect(view.checklists[0]!.items[0]).toMatchObject({ checkedBy: "camille", pending: true });
    expect(view.handovers![0]).toMatchObject({ handedOverBy: "camille", pending: true });
    expect(view.items).toEqual([
      { id: "i1", startTime: "16:20", endTime: "17:05", keyMomentId: "m" },
      { id: "i2", startTime: "17:20", endTime: null, keyMomentId: "m" },
    ]);
    expect(view.pendingShiftVendors).toBe(3);
  });

  it("une action déjà dans l'état reçu n'est pas comptée deux fois", () => {
    const state: DayState = { ...empty, incidents: [{ id: "x", actionId: "a2", keyMomentId: null, body: "Portail bloqué", severity: null, deviceAt: "2027-06-12T14:41:00Z", userId: "camille", photos: [] }] };
    const view = overlayDayState({ state, items, handovers: null, userId: "camille", pending: [{ actionId: "a2", eventId: "e", userId: "camille", createdAt: "", action: { kind: "incident", actionId: "a2", deviceAt: "2027-06-12T14:41:00Z", body: "Portail bloqué", severity: null, keyMomentId: null } }] });
    expect(view.incidents).toHaveLength(1);
    expect(view.handovers).toBeNull();
  });
});
