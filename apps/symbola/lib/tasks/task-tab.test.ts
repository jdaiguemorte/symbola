import { describe, expect, it } from "vitest";
import { legacyTaskTabRedirect, TASK_TAB } from "./task-tab";

const EVENT = "00000000-0000-4000-8000-0000000000e1";
const TASK = "00000000-0000-4000-8000-0000000000a1";

describe("EVT-03, CHR-02 — L'onglet « Tâches » de la fiche remplace « Rétroplanning » (lot 70c)", () => {
  it("l'onglet s'appelle « taches » dans l'adresse", () => {
    expect(TASK_TAB).toBe("taches");
  });

  it("l'ancienne adresse ?onglet=retroplanning&tache=<id> ouvre l'onglet « Tâches » et la même tâche", () => {
    expect(legacyTaskTabRedirect(EVENT, { onglet: "retroplanning", tache: TASK })).toBe(`/events/${EVENT}?onglet=taches&tache=${TASK}`);
  });

  it("garde les autres paramètres, et ne redirige pas les autres onglets", () => {
    expect(legacyTaskTabRedirect(EVENT, { onglet: "retroplanning", vue: "toutes" })).toBe(`/events/${EVENT}?onglet=taches&vue=toutes`);
    expect(legacyTaskTabRedirect(EVENT, { onglet: "budget" })).toBeNull();
    expect(legacyTaskTabRedirect(EVENT, {})).toBeNull();
  });
});
