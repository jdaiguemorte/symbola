// Lot 72b (HUB-11, AIDE-04 ; maquette 13 du lot 68) — « Pour bien démarrer » en une ligne en bas de l'accueil,
// qu'on masque. Lot 74f (maquette 28 ; C-10) : ses étapes sont celles du parcours.
import { describe, expect, it } from "vitest";
import { TUTORIALS } from "@/lib/help/catalog";
import { buildJourney, type JourneyGestures } from "@/lib/help/journey";
import { firstStepsLine } from "./first-steps";

const gestures: JourneyGestures = { first_event: false, first_vendor: false, essentials: false };
const view = (done: JourneyGestures = gestures) => buildJourney({ choice: { path: "scratch", by: "answer" }, available: TUTORIALS, progress: [], gestures: done });

describe("AIDE-04, HUB-11 — Pour bien démarrer, une ligne qu'on masque (lots 72b et 74f)", () => {
  it("« 0 étape faite sur 4 », l'étape suivante et son geste : créer le premier mariage", () => {
    const line = firstStepsLine(view(), false)!;
    expect(line).toMatchObject({ done: 0, total: 4, href: "/events/new" });
    expect(line.next.key).toBe("first_event");
  });

  it("une étape faite dans l'espace : la suivante est la première qui reste ; sans geste, son premier tutoriel", () => {
    const line = firstStepsLine(view({ ...gestures, first_event: true }), false)!;
    expect(line.done).toBe(1);
    expect(line.next.key).toBe("templates");
    expect(line.href).toBe("/aide/tutoriels/retroplanning-template");
  });

  it("masquée par la personne, ou tout fait : plus rien sur l'accueil", () => {
    expect(firstStepsLine(view(), true)).toBeNull();
    expect(firstStepsLine(null, false)).toBeNull();
    const done = buildJourney({ choice: { path: "scratch", by: "answer" }, available: [], progress: [], gestures: { first_event: true, first_vendor: true, essentials: true } });
    expect(firstStepsLine(done, false)).toBeNull();
  });
});
