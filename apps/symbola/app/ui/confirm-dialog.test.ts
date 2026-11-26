// Lot 70b (UX-07, HUB-17, EVT-05 ; M6, C-08, C-87) — le danger à la mesure du risque. Niveau 2 (touche
// des tiers) : la question nomme l'objet, « Garder … » avant le bouton de danger ; niveau 3 (ne se
// défait pas) : en plus, une case « Je comprends que … » à cocher avant que le bouton réponde.
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

const noop = async () => {};

function render(level: 2 | 3) {
  return renderToStaticMarkup(
    createElement(ConfirmDialog, {
      level,
      trigger: "Supprimer définitivement",
      triggerLabel: "Supprimer définitivement « Léa & Maxime »",
      title: "Supprimer définitivement « Léa & Maxime » ?",
      body: "Il ne pourra plus être restauré.",
      confirmLabel: "Supprimer définitivement",
      keepLabel: "Garder dans la Corbeille",
      acknowledgeLabel: level === 3 ? "Je comprends que « Léa & Maxime » ne pourra pas être récupéré" : undefined,
      action: noop,
      fields: { kind: "event", id: "1" },
    }),
  );
}

describe("UX-07 — Trois niveaux de danger (lot 70b)", () => {
  it("niveau 2 : le renoncement est nommé et vient avant le bouton de danger ; aucun « Annuler » seul", () => {
    const html = render(2);
    expect(html).toContain('data-danger-level="2"');
    expect(html.indexOf("Garder dans la Corbeille")).toBeLessThan(html.indexOf('class="button-danger confirm-dialog-confirm"'));
    expect(html).not.toMatch(/>Annuler</);
    expect(html).not.toContain('type="checkbox"');
  });

  it("niveau 3 : une case « Je comprends que … » ; le bouton de danger ne répond pas tant qu'elle n'est pas cochée", () => {
    const html = render(3);
    expect(html).toContain('data-danger-level="3"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("Je comprends que « Léa &amp; Maxime » ne pourra pas être récupéré");
    expect(html).toMatch(/<button type="submit" class="button-danger confirm-dialog-confirm" disabled=""/);
  });
});
