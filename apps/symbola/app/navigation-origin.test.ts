// Lot 72d (P-12) — le « ← » d'une fiche d'évènement ramène à l'écran d'où l'on vient.
import { describe, expect, it } from "vitest";
import { originFor } from "./navigation-origin";

const fiche = "/events/9b376423-a158-46fb-9cdd-4de3313a355a";

describe("UX-05 — Le retour d'une fiche ramène d'où l'on vient (P-12)", () => {
  it("depuis la liste des évènements, ses filtres compris ; depuis l'accueil ; depuis « Tâches »", () => {
    expect(originFor({ current: "/events?vue=liste&statut=confirmed", previous: "/" }, fiche)).toEqual({ href: "/events?vue=liste&statut=confirmed", screen: "events" });
    expect(originFor({ current: "/", previous: null }, fiche)).toEqual({ href: "/", screen: "home" });
    expect(originFor({ current: "/taches?qui=moi", previous: "/" }, fiche)).toEqual({ href: "/taches?qui=moi", screen: "tasks" });
  });

  it("un changement d'onglet de la fiche ne fait pas oublier l'écran d'origine", () => {
    expect(originFor({ current: `${fiche}?onglet=taches`, previous: "/taches" }, fiche)).toEqual({ href: "/taches", screen: "tasks" });
  });

  it("venu d'ailleurs (recherche, notification, un autre mariage) ou sans mémoire : l'écran parent", () => {
    expect(originFor(null, fiche)).toBeNull();
    expect(originFor({ current: "/contacts", previous: null }, fiche)).toBeNull();
    expect(originFor({ current: `${fiche}?onglet=budget`, previous: null }, fiche)).toBeNull();
  });
});
