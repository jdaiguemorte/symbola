import { describe, expect, it } from "vitest";
import { navigationTarget, type LinkClick } from "./navigation-target";

const HERE = "https://app.symbola.test/events?statut=option";

function click(overrides: Partial<LinkClick>): LinkClick {
  return { href: "/taches", button: 0, modified: false, target: "", download: false, ...overrides };
}

describe("UX-15 — squelette d'écran au passage d'un écran à l'autre", () => {
  it("un lien interne vers un autre écran annonce cet écran", () => {
    expect(navigationTarget(click({}), HERE)).toBe("/taches");
    expect(navigationTarget(click({ href: "https://app.symbola.test/events/3f1c?onglet=budget" }), HERE)).toBe("/events/3f1c");
    expect(navigationTarget(click({ target: "_self" }), HERE)).toBe("/taches");
  });

  it("un lien qui reste sur l'écran courant (filtre, ancre, onglet) ne montre pas de squelette", () => {
    expect(navigationTarget(click({ href: "/events?statut=confirmed" }), HERE)).toBeNull();
    expect(navigationTarget(click({ href: "#nouveau-contact" }), HERE)).toBeNull();
  });

  it("un lien qui s'ouvre ailleurs ne montre pas de squelette", () => {
    expect(navigationTarget(click({ button: 1 }), HERE)).toBeNull();
    expect(navigationTarget(click({ modified: true }), HERE)).toBeNull();
    expect(navigationTarget(click({ target: "_blank" }), HERE)).toBeNull();
    expect(navigationTarget(click({ download: true }), HERE)).toBeNull();
    expect(navigationTarget(click({ href: "https://exemple.test/taches" }), HERE)).toBeNull();
    expect(navigationTarget(click({ href: "mailto:lea@exemple.test" }), HERE)).toBeNull();
  });

  it("un fichier servi par l'API ne montre pas de squelette", () => {
    expect(navigationTarget(click({ href: "/api/documents/3f1c/download" }), HERE)).toBeNull();
  });
});
