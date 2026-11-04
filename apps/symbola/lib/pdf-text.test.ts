// Les PDF utilisent les polices standard (Helvetica), sans les espaces
// fines du format français : « 1 500,00 € » s'y affichait « 1/500,00 € ».
import { describe, expect, it } from "vitest";
import { formatAmount } from "@symbola/i18n";
import { pdfSafe } from "./pdf-text";

describe("PDF — texte compatible avec les polices standard", () => {
  it("remplace les espaces insécables et fines par une espace simple, partout dans le modèle", () => {
    const amount = formatAmount(150000, "fr");
    expect(amount).toMatch(/[  ]/);
    const model = pdfSafe({ title: "Devis", totals: [{ label: "Total TTC", value: amount }], date: `15 mars`, count: 3, flag: true, empty: null });
    expect(model.totals[0]!.value).toBe("1 500,00 €");
    expect(model.date).toBe("15 mars");
    expect(model).toMatchObject({ title: "Devis", count: 3, flag: true, empty: null });
  });

  it("laisse intacts les octets d'une image (logo)", () => {
    const logo = Buffer.from([0xe2, 0x80, 0xaf]);
    expect(pdfSafe({ logo }).logo).toBe(logo);
  });
});
