import { describe, expect, it } from "vitest";
import { MAIL_FONT_STACKS, renderMailHtml, renderMailText, signatureText, type MailLayout } from "./layout";

const base: MailLayout = {
  lang: "fr",
  subject: "Votre proposition",
  senderName: "Atelier Lumière",
  logoCid: null,
  accent: "#b08968",
  textOnAccent: "#ffffff",
  blocks: [
    { kind: "paragraph", text: "Bonjour Léa et Maxime," },
    { kind: "button", url: "https://symbola.test/lien/abc", label: "Découvrir votre proposition" },
  ],
  footerLines: ["Atelier Lumière", "12 rue des Lilas, 69003 Lyon", "Wedding planner à Lyon depuis 2015"],
};

const signature = {
  name: "Camille Morel",
  lines: ["Wedding planner · Atelier Lumière", "06 12 34 56 78 · atelier-lumiere.fr"],
  links: [
    { label: "Instagram", url: "https://instagram.com/atelierlumiere" },
    { label: "<Pinterest>", url: "javascript:alert(1)" },
  ],
  photoCid: "signature@symbola",
};

describe("HUB-18 — Police, signature et pied des e-mails (lot 66c, D5, D6)", () => {
  it("applique la police choisie, terminée par une police système, au corps et au cadre", () => {
    const html = renderMailHtml({ ...base, font: "serif" });
    expect(MAIL_FONT_STACKS.serif.endsWith("serif")).toBe(true);
    expect(html.split(`font-family:${MAIL_FONT_STACKS.serif}`).length - 1).toBe(2);
    expect(renderMailHtml(base)).toContain(`font-family:${MAIL_FONT_STACKS.sans}`);
  });

  it("chaque police se replie sur une famille système", () => {
    for (const stack of Object.values(MAIL_FONT_STACKS)) expect(stack).toMatch(/(sans-serif|serif)$/);
  });

  it("pose la signature après le texte : photo jointe en ligne, nom, lignes, liens http(s) seulement, tout échappé", () => {
    const html = renderMailHtml({ ...base, signature });
    expect(html.indexOf("Camille Morel")).toBeGreaterThan(html.indexOf("Découvrir votre proposition"));
    expect(html).toContain('src="cid:signature@symbola"');
    expect(html).toContain('href="https://instagram.com/atelierlumiere"');
    expect(html).not.toContain("javascript:");
    expect(html).not.toContain("<Pinterest>");
  });

  it("sans photo, aucune image de signature", () => {
    expect(renderMailHtml({ ...base, signature: { ...signature, photoCid: null } })).not.toContain("cid:signature");
  });

  it("D6 — sans mention, le pied ne porte que les coordonnées et la ligne libre", () => {
    const html = renderMailHtml(base);
    expect(html).not.toContain("Envoyé avec Symbola");
    expect(html).toContain("Wedding planner à Lyon depuis 2015");
    expect(renderMailText(base)).toMatch(/--\nAtelier Lumière\n12 rue des Lilas, 69003 Lyon\nWedding planner à Lyon depuis 2015\n$/);
  });

  it("garde la mention des e-mails de Symbola quand elle est donnée", () => {
    expect(renderMailHtml({ ...base, footerNote: "Envoyé avec Symbola" })).toContain("Envoyé avec Symbola");
  });

  it("la version texte porte la signature avant le pied, chaque lien en « Libellé : adresse »", () => {
    const text = renderMailText({ ...base, signature: { ...signature, links: [signature.links[0]!] } });
    expect(text).toContain("Camille Morel\nWedding planner · Atelier Lumière\n06 12 34 56 78 · atelier-lumiere.fr\nInstagram : https://instagram.com/atelierlumiere\n\n--\n");
    expect(signatureText({ ...signature, links: [signature.links[0]!] }, ": ")).toContain("Instagram: https://");
  });
});
