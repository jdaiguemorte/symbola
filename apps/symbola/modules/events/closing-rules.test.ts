import { describe, expect, it } from "vitest";
import { closingDue } from "./lifecycle";
import { cleanCheckedSteps, cleanLessons, cleanOwnExpenses, closingChecklist, closingComplete, parseHours, type ClosingFacts } from "./closing-rules";

const facts: ClosingFacts = { balanceToInvoice: 1, vendorPaymentsLeft: 2, commissionsToInvoice: 0, vendorsToEvaluate: 3, timeSpentMinutes: null, lessons: 0, reviewRequested: false, checked: [] };

describe("PAR-09 — Clôturer et capitaliser : la liste de clôture (lot 58)", () => {
  it("la clôture se propose à J+1 dans le fuseau de l'évènement, pas la veille ni le jour même (heure d'été comprise)", () => {
    const event = { status: "confirmed" as const, eventDate: "2027-03-27", timeZone: "Europe/Paris" };
    // 27 mars 2027 23:30 à Paris (22:30 UTC) : encore le jour J.
    expect(closingDue(event, new Date("2027-03-27T22:30:00Z"))).toBe(false);
    // 28 mars 2027 00:30 à Paris (passage à l'heure d'été : 23:30 UTC le 27).
    expect(closingDue(event, new Date("2027-03-27T23:30:00Z"))).toBe(true);
    // À New York, le 28 à 00:30 UTC est encore le 27.
    expect(closingDue({ ...event, timeZone: "America/New_York" }, new Date("2027-03-28T00:30:00Z"))).toBe(false);
    expect(closingDue({ ...event, status: "option" }, new Date("2027-04-10T10:00:00Z"))).toBe(false);
  });

  it("chaque étape est faite, à faire ou indisponible (module non souscrit) ; le temps passé reste facultatif, jamais « à faire »", () => {
    expect(closingChecklist(facts)).toEqual([
      { step: "balance_invoice", status: "todo", count: 1 },
      { step: "vendor_payments", status: "todo", count: 2 },
      { step: "commissions", status: "done", count: 0 },
      { step: "evaluations", status: "todo", count: 3 },
      { step: "time_spent", status: "optional", count: null },
      { step: "lessons", status: "todo", count: 0 },
      { step: "review_request", status: "todo", count: null },
    ]);
    const unavailable = closingChecklist({ ...facts, balanceToInvoice: null, commissionsToInvoice: null });
    expect(unavailable[0]).toEqual({ step: "balance_invoice", status: "unavailable", count: null });
    expect(closingComplete(unavailable)).toBe(false);
  });

  it("une étape cochée à la main est faite ; sans temps passé la clôture est complète", () => {
    const items = closingChecklist({ ...facts, checked: ["balance_invoice", "vendor_payments", "evaluations", "review_request"], lessons: 2 });
    expect(closingComplete(items)).toBe(true);
    expect(items.find((item) => item.step === "time_spent")!.status).toBe("optional");
    expect(() => cleanCheckedSteps(["time_spent"])).toThrow();
    expect(() => cleanCheckedSteps(["nothing"])).toThrow();
  });

  it("trois leçons au plus, vides écartées ; frais propres libellés et en centimes entiers", () => {
    expect(cleanLessons(["  Prévoir un plan B pluie ", "", "Confirmer le traiteur à J-7"], 3)).toEqual(["Prévoir un plan B pluie", "Confirmer le traiteur à J-7"]);
    expect(() => cleanLessons(["a", "b", "c", "d"], 3)).toThrow();
    expect(cleanOwnExpenses([{ label: " Déplacements ", amountCents: 12050 }], 30)).toEqual([{ label: "Déplacements", amountCents: 12050 }]);
    expect(() => cleanOwnExpenses([{ label: "Péage", amountCents: 12.5 }], 30)).toThrow();
    expect(() => cleanOwnExpenses([{ label: "", amountCents: 100 }], 30)).toThrow();
  });

  it("le temps passé se saisit en heures décimales ou en heures et minutes, ou se laisse vide", () => {
    expect(parseHours("")).toBeNull();
    expect(parseHours("12,5")).toBe(750);
    expect(parseHours("12:30")).toBe(750);
    expect(parseHours("3h05")).toBe(185);
    expect(() => parseHours("douze")).toThrow();
    expect(() => parseHours("2:75")).toThrow();
  });
});
