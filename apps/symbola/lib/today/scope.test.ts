// Lot 72a (HUB-08, PAR-10, EVT-06 ; J3 ; critère 5) — la portée « Moi » d'une agence, sans base : les
// tâches confiées à la personne ; les autres lignes des évènements dont elle est planner principale, ou
// sans planner principal (J3, chez tous) ; les tâches hors évènement à elle ou à personne. Seule, tout.
import { describe, expect, it } from "vitest";
import type { TaskLineSource } from "@/lib/tasks/task-line";
import type { TodayItem } from "./rank";
import { meScope } from "./scope";

const CAMILLE = "camille";
const BASTIEN = "bastien";

function task(key: string, eventId: string | null, assigneeUserId: string | null): TodayItem {
  const source: TaskLineSource = { id: key, eventId, event: eventId ? { id: eventId, names: eventId } : null, label: key, dueDate: "2026-11-26", responsible: "planner", vendorCandidateId: null, assigneeUserId, priority: "normal", done: false };
  return { key, kind: "task", eventId, eventNames: eventId, title: key, dueOn: "2026-11-26", since: null, actor: { kind: "you" }, href: `/x/${key}`, task: source };
}

function line(key: string, eventId: string | null, kind: TodayItem["kind"] = "client_payment"): TodayItem {
  return { key, kind, eventId, eventNames: eventId, title: key, dueOn: "2026-11-27", since: null, actor: { kind: "client" }, href: `/x/${key}` };
}

const items = [
  task("tâche-de-camille", "mariage-camille", CAMILLE),
  task("tâche-de-bastien", "mariage-camille", BASTIEN),
  task("tâche-sans-personne", "mariage-camille", null),
  line("paiement-camille", "mariage-camille"),
  line("paiement-sans-planner", "mariage-libre"),
  line("relance-bastien", "mariage-bastien", "quote_follow_up"),
  task("hors-évènement-camille", null, CAMILLE),
  task("hors-évènement-personne", null, null),
  line("doublons", null, "contact_duplicates"),
];
const leads = new Map<string, string>([
  ["mariage-camille", CAMILLE],
  ["mariage-bastien", BASTIEN],
]);
const keys = (list: TodayItem[]) => list.map((entry) => entry.key);

describe("HUB-08, PAR-10 — La portée « Moi » dans une agence (lot 72a, J3, critère 5)", () => {
  it("à Bastien : ni les tâches confiées à Camille, ni les paiements d'un mariage dont Camille est planner principale ; ceux d'un mariage sans planner principal, oui", () => {
    expect(keys(meScope(items, { userId: BASTIEN, activeMembers: 2, leads }))).toEqual(["tâche-de-bastien", "paiement-sans-planner", "relance-bastien", "hors-évènement-personne", "doublons"]);
  });

  it("à Camille : ses tâches, les lignes non confiées de son mariage, celles d'un mariage sans planner principal", () => {
    expect(keys(meScope(items, { userId: CAMILLE, activeMembers: 2, leads }))).toEqual(["tâche-de-camille", "tâche-sans-personne", "paiement-camille", "paiement-sans-planner", "hors-évènement-camille", "hors-évènement-personne", "doublons"]);
  });

  it("une planner seule voit tout", () => {
    expect(meScope(items, { userId: BASTIEN, activeMembers: 1, leads })).toHaveLength(items.length);
  });
});
