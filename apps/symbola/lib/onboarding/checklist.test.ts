// Lot 74f (HUB-11 ; spécification du lot 74, § 6.6 ; maquette 28 ; C-10) — l'ancienne liste de l'accueil est
// fondue dans le parcours : « Régler l'essentiel » et « Ajouter un premier prestataire » en sont des marches,
// chacune cochée par le geste fait dans l'espace.
import { describe, expect, it } from "vitest";
import { TUTORIALS } from "@/lib/help/catalog";
import { GESTURE_HREFS, essentialsDone } from "./checklist";

const details = { organizationName: "Atelier Roussel", address: "12 rue des Lilas", postalCode: "49000", city: "Angers", siret: "12345678900011" } as Parameters<typeof essentialsDone>[1];
const profile = { vatAnswerPending: false, vatRegime: "franchise" as const, siren: null, address: null };

describe("HUB-11 — Pour bien démarrer, fondu dans le parcours (lot 74f)", () => {
  it("chaque marche ouvre son écran réel : l'essentiel, le premier prestataire, le premier mariage, la reprise", () => {
    expect(GESTURE_HREFS).toEqual({
      takeover: "/reprise",
      takeover_complete: "/events",
      first_event: "/events/new",
      first_vendor: "/prestataires/nouveau",
      essentials: "/demarrage/essentiel",
    });
  });

  it("l'essentiel est fait quand un devis peut partir ; « Je ne sais pas encore » pour la TVA le laisse à faire (L74-D4)", () => {
    expect(essentialsDone(profile, details)).toBe(true);
    expect(essentialsDone({ ...profile, vatAnswerPending: true }, details)).toBe(false);
    expect(essentialsDone({ ...profile, vatRegime: null }, details)).toBe(false);
    expect(essentialsDone(profile, { ...details, siret: null })).toBe(false);
  });

  it("le devis, l'import des contacts et l'invitation du client restent proposés en tutoriels", () => {
    expect(TUTORIALS.map((tutorial) => tutorial.key)).toEqual(expect.arrayContaining(["quote-signature", "import", "client-space"]));
  });
});
