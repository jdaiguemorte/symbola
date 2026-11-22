// Lot 65c (HUB-08, UX-01 ; maquette M15) — « À traiter en premier » : sept lignes au plus, par nature.
import { describe, expect, it } from "vitest";
import { rankToday, type TodayItem, type TodayItemKind } from "./rank";
import { HOME_FIRST_COUNT, natureOf, todayParts } from "./parts";

const TODAY = "2026-11-23";
const item = (key: string, kind: TodayItemKind, dueOn: string | null, eventId: string | null = "e1"): TodayItem => ({
  key,
  kind,
  eventId,
  eventNames: null,
  title: key,
  dueOn,
  since: null,
  actor: { kind: "you" },
  href: `/x/${key}`,
});

describe("HUB-08, UX-01 — À traiter en premier : sept lignes au plus, découpées par nature (lot 65c)", () => {
  it("sept lignes au plus, les plus urgentes ; chaque partie compte tous ses éléments", () => {
    const items = [
      ...Array.from({ length: 6 }, (_, index) => item(`t${index}`, "task", `2026-11-1${index}`)),
      item("relance", "vendor_contract", null),
      item("paiement", "client_payment", "2026-11-25"),
      item("tache-loin", "task", "2026-11-30"),
    ];
    const parts = todayParts(rankToday(items, TODAY), { quotes: true, events: true });
    expect(parts.flatMap((part) => part.items)).toHaveLength(HOME_FIRST_COUNT);
    const tasks = parts.find((part) => part.nature === "tasks")!;
    expect(tasks.items).toHaveLength(6);
    expect(tasks.total).toBe(7);
    expect(tasks.link).toEqual({ kind: "tasks", href: "/taches" });
    expect(parts.find((part) => part.nature === "follow_ups")?.items.map((entry) => entry.key)).toEqual(["relance"]);
    // Le paiement est au-delà des sept : sa partie n'apparaît pas.
    expect(parts.find((part) => part.nature === "payments")).toBeUndefined();
  });

  it("l'ordre des parties suit leur élément le plus urgent ; une partie vide n'apparaît pas", () => {
    const parts = todayParts(rankToday([item("p", "client_payment", "2026-11-20"), item("t", "task", "2026-11-24")], TODAY), { quotes: true, events: true });
    expect(parts.map((part) => part.nature)).toEqual(["payments", "tasks"]);
    expect(parts[0]!.link).toEqual({ kind: "payments", href: "/devis/encaissements" });
  });

  it("relances et décisions mènent à l'évènement quand elles sont toutes du même ; sinon pas de lien de partie", () => {
    const same = todayParts(rankToday([item("a", "vendor_contract", null, "e1"), item("b", "quote_follow_up", null, "e1")], TODAY), { quotes: true, events: true });
    expect(same[0]!.link).toEqual({ kind: "event", href: "/events/e1" });
    const mixed = todayParts(rankToday([item("a", "decision", null, "e1"), item("b", "vendor_choice", null, "e2")], TODAY), { quotes: true, events: true });
    expect(mixed[0]!.link).toBeNull();
  });

  it("sans le module Devis, la partie des paiements n'a pas de lien (dégradation propre, ARC-06)", () => {
    expect(todayParts(rankToday([item("p", "vendor_payment", null)], TODAY), { quotes: false, events: true })[0]!.link).toBeNull();
  });

  it("chaque sorte d'élément a sa nature : tâches, relances, paiements, décisions, prospects, à regarder", () => {
    expect(natureOf("client_task")).toBe("tasks");
    expect(natureOf("vendor_contract")).toBe("follow_ups");
    expect(natureOf("transfer_declaration")).toBe("payments");
    expect(natureOf("vendor_answer")).toBe("decisions");
    expect(natureOf("prospect_request")).toBe("prospects");
    expect(natureOf("appointment")).toBe("others");
  });
});
