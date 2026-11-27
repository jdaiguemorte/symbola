import { describe, expect, it } from "vitest";
import { quickCreateEntries } from "./entries";

const all = { events: true, quotes: true, budget: true, vendors: true };

describe("HUB-07 — « + Créer » : six entrées dans l'ordre de la journée (lot 70e, M7)", () => {
  it("propose les six entrées quand tout est souscrit, dans l'ordre : évènement, tâche, prestataire, contact, devis, dépense", () => {
    expect(quickCreateEntries(all).map((entry) => entry.key)).toEqual(["event", "task", "vendor", "contact", "quote", "expense"]);
  });

  it("« Prospect » n'existe plus (A12) : « Nouvel évènement › Une demande en cours » le remplace", () => {
    expect(quickCreateEntries(all).map((entry) => entry.key)).not.toContain("prospect");
  });

  it("un module non souscrit retire ses entrées, sans erreur (ARC-06, HUB-06)", () => {
    expect(quickCreateEntries({ ...all, vendors: false }).map((entry) => entry.key)).not.toContain("vendor");
    expect(quickCreateEntries({ ...all, quotes: false }).map((entry) => entry.key)).not.toContain("quote");
    expect(quickCreateEntries({ ...all, budget: false }).map((entry) => entry.key)).not.toContain("expense");
    // Sans le module des évènements : plus d'évènement, de tâche, de devis ni de dépense.
    expect(quickCreateEntries({ events: false, quotes: true, budget: true, vendors: true }).map((entry) => entry.key)).toEqual(["vendor", "contact"]);
  });

  it("les contacts sont dans le noyau du hub : l'entrée reste quand tout le reste est retiré", () => {
    expect(quickCreateEntries({ events: false, quotes: false, budget: false, vendors: false }).map((entry) => entry.key)).toEqual(["contact"]);
  });

  it("évènement, prestataire et contact mènent à leur écran ; tâche, devis et dépense ouvrent une fenêtre", () => {
    const byKey = Object.fromEntries(quickCreateEntries(all).map((entry) => [entry.key, entry]));
    expect(byKey.event).toMatchObject({ action: "link", href: "/events/new" });
    expect(byKey.vendor).toMatchObject({ action: "link", href: "/prestataires/nouveau" });
    expect(byKey.contact).toMatchObject({ action: "link", href: "/contacts?nouveau=1" });
    expect(byKey.task?.action).toBe("dialog");
    expect(byKey.quote?.action).toBe("dialog");
    expect(byKey.expense?.action).toBe("dialog");
  });

  it("seules la tâche, le devis et la dépense disent le mariage en cours", () => {
    const contextual = quickCreateEntries(all).filter((entry) => entry.contextual).map((entry) => entry.key);
    expect(contextual).toEqual(["task", "quote", "expense"]);
  });
});
