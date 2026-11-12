// Lot 27a (POR-02, décisions D2 et D3) — accueil du portail : compte à rebours
// (calendrier de Paris, veille, jour même, passage à l'heure d'été), avancement,
// trois prochaines actions selon les rubriques ouvertes.
import { describe, expect, it } from "vitest";
import { countdown, nextActions, progress } from "./portal-home";

const task = (id: string, dueDate: string, extra: Partial<{ done: boolean; responsible: "clients" | "planner" }> = {}) => ({
  id,
  label: `Tâche ${id}`,
  dueDate,
  done: extra.done ?? false,
  responsible: extra.responsible ?? ("clients" as const),
});
const payment = (id: string, dueOn: string, status: "due" | "overdue" | "declared" | "paid" = "due") => ({
  id,
  slotLabel: "Traiteur",
  vendorName: "Maison Haddad",
  label: "Acompte",
  amountCents: 288000,
  dueOn,
  status,
});
const quote = (quoteId: string, ownStatus: "pending" | "signed" | null = "pending") => ({
  quoteId,
  number: "D-2027-001",
  version: 1,
  status: "pending" as const,
  ownStatus,
  ownSigningUrl: ownStatus === "pending" ? "https://signature.example.test/s/1" : null,
});

describe("POR-02 — Accueil du portail : compte à rebours, avancement, trois prochaines actions", () => {
  it("compte à rebours en jours du calendrier : la veille, le jour même, après, sans date ; le passage à l'heure d'été ne décale rien", () => {
    expect(countdown("2027-06-12", "2026-11-12")).toEqual({ kind: "days", days: 212 });
    expect(countdown("2027-03-29", "2027-03-27")).toEqual({ kind: "days", days: 2 });
    expect(countdown("2027-06-12", "2027-06-11")).toEqual({ kind: "tomorrow" });
    expect(countdown("2027-06-12", "2027-06-12")).toEqual({ kind: "today" });
    expect(countdown("2027-06-12", "2027-06-13")).toEqual({ kind: "past" });
    expect(countdown(null, "2027-06-13")).toEqual({ kind: "unset" });
  });

  it("D3 — avancement sur tout le rétroplanning", () => {
    expect(progress([{ done: true }, { done: false }, { done: true }])).toEqual({ done: 2, total: 3 });
    expect(progress([])).toEqual({ done: 0, total: 0 });
  });

  it("D2 — ses tâches non faites, les devis qu'il signe, ses échéances à régler : les retards d'abord, puis par date, trois au plus", () => {
    const actions = nextActions({
      tasks: [task("a", "2027-03-10"), task("b", "2027-02-01"), task("c", "2027-01-05", { done: true }), task("d", "2027-01-06", { responsible: "planner" })],
      quotes: [quote("q1"), quote("q2", "signed")],
      payments: [payment("p1", "2027-02-20"), payment("p2", "2027-01-01", "declared"), payment("p3", "2027-01-02", "paid")],
      today: "2027-02-15",
    });
    expect(actions.map((action) => `${action.kind}:${action.id}`)).toEqual(["task:b", "quote:q1", "payment:p1"]);
    expect(actions[0]).toMatchObject({ overdue: true });
  });

  it("rubriques fermées : rien de leurs objets ; rien à faire, liste vide", () => {
    expect(nextActions({ tasks: null, quotes: [], payments: [payment("p1", "2027-03-01")], today: "2027-02-15" }).map((action) => action.kind)).toEqual(["payment"]);
    expect(nextActions({ tasks: null, quotes: [], payments: null, today: "2027-02-15" })).toEqual([]);
  });

  it("à date égale : la tâche, puis l'échéance, puis le devis", () => {
    const actions = nextActions({ tasks: [task("t", "2027-02-15")], quotes: [quote("q")], payments: [payment("p", "2027-02-15")], today: "2027-02-15" });
    expect(actions.map((action) => action.kind)).toEqual(["task", "payment", "quote"]);
  });
});
