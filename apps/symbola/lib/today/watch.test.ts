// Lot 72a (HUB-08, GC-02 ; critère 6) — une alerte du radar devient une ligne « À regarder » : sa règle en
// une phrase, l'écran où agir, son évènement ; comptée dans les points. Sans alerte, aucune ligne.
import { describe, expect, it } from "vitest";
import type { RiskAlert } from "@symbola/contracts";
import { rankToday } from "./rank";
import { watchItems } from "./watch";

const alert: RiskAlert = { rule: "milestone_late", key: "milestone_late:t1", eventId: "e1", eventNames: "Léa & Maxime", label: "Réserver le lieu", facts: { task: "Réserver le lieu", daysLate: 4 }, thresholdDays: 3, href: "/events/e1?onglet=taches&tache=t1" };
const words = (entry: RiskAlert) => ({ title: `Jalon en retard : ${entry.label}`, detail: `${entry.facts.daysLate} jours de retard` });

describe("HUB-08, GC-02 — Une alerte du radar est une ligne « À regarder » (lot 72a, critère 6)", () => {
  it("une ligne de l'évènement, qui mène à l'écran où agir, comptée dans les points", () => {
    const [watch] = watchItems([alert], words);
    expect(watch).toMatchObject({ key: "watch:milestone_late:t1", kind: "watch", eventId: "e1", eventNames: "Léa & Maxime", title: "Jalon en retard : Réserver le lieu", detail: "4 jours de retard", href: alert.href, dueOn: null, actor: { kind: "you" } });
    expect(rankToday(watchItems([alert], words), "2026-11-25").points).toBe(1);
  });

  it("sans alerte, aucune ligne", () => {
    expect(watchItems([], words)).toEqual([]);
  });
});
