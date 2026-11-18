// Lot 43 (FAC-08 Divergent, ADR 0087 ; D5, D6) — référence de virement et QR code européen (EPC).
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { epcQrPayload, epcQrSvg, isPaymentReference, isValidIban, newPaymentReference, normalizeIban, parseEpcQrPayload } from "./payment-references";

describe("FAC-08 — Référence unique par échéance, sans donnée personnelle (D5)", () => {
  it("suit SYM-<année>-<six caractères>, sans lettre ambiguë", () => {
    for (let index = 0; index < 200; index += 1) {
      const reference = newPaymentReference(2027);
      expect(reference).toMatch(/^SYM-2027-[0-9A-HJKMNP-TV-Z]{6}$/);
      expect(isPaymentReference(reference)).toBe(true);
    }
  });

  it("deux références tirées à la suite diffèrent (tirage aléatoire, unicité garantie par la base)", () => {
    const references = new Set(Array.from({ length: 500 }, () => newPaymentReference(2027)));
    expect(references.size).toBeGreaterThan(495);
  });

  it("un nom, une minuscule ou une lettre ambiguë n'est pas une référence", () => {
    for (const value of ["SYM-2027-MARTIN", "SYM-2027-7kq4xm", "SYM-2027-7KQ4XO", "SYM-27-7KQ4XM", "D-2027-0001"]) expect(isPaymentReference(value)).toBe(false);
  });

  it("la référence se tire avec le hasard fourni (tests rejouables)", () => {
    expect(newPaymentReference(2026, () => 0)).toBe("SYM-2026-000000");
    expect(newPaymentReference(2026, () => 31)).toBe("SYM-2026-ZZZZZZ");
  });
});

describe("FAC-08 — RIB de l'organisation", () => {
  it("un IBAN se valide par sa clé (ISO 13616) et se range sans espaces", () => {
    expect(normalizeIban(" fr76 3000 6000 0112 3456 7890 189 ")).toBe("FR7630006000011234567890189");
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 189")).toBe(true);
    expect(isValidIban("FR76 3000 6000 0112 3456 7890 188")).toBe(false);
    expect(isValidIban("pas un iban")).toBe(false);
  });
});

describe("FAC-08 — QR code de virement européen, norme EPC (D6)", () => {
  const input = { beneficiary: "Atelier Camille R.", iban: "FR76 3000 6000 0112 3456 7890 189", bic: "AGRIFRPP", amountCents: 120000, reference: "SYM-2027-7KQ4XM" };

  it("porte le bénéficiaire, l'IBAN, le montant et la référence, et se relit", () => {
    const payload = epcQrPayload(input);
    expect(payload.split("\n").slice(0, 4)).toEqual(["BCD", "002", "1", "SCT"]);
    expect(parseEpcQrPayload(payload)).toEqual({ bic: "AGRIFRPP", beneficiary: "Atelier Camille R.", iban: "FR7630006000011234567890189", amount: "EUR1200.00", reference: "SYM-2027-7KQ4XM" });
  });

  it("le QR code produit contient exactement ce contenu, en correction M", () => {
    const payload = epcQrPayload(input);
    const code = QRCode.create(payload, { errorCorrectionLevel: "M" });
    const decoded = code.segments.map((segment) => (segment as unknown as { data: Uint8Array | string }).data).map((data) => (typeof data === "string" ? data : Buffer.from(data).toString("utf8"))).join("");
    expect(decoded).toBe(payload);
    expect(code.errorCorrectionLevel.bit).toBe(QRCode.create("x", { errorCorrectionLevel: "M" }).errorCorrectionLevel.bit);
  });

  it("le dessin est un SVG autonome, sans script", async () => {
    const svg = await epcQrSvg(input);
    expect(svg.startsWith("<svg")).toBe(true);
    expect(svg).not.toMatch(/<script/i);
  });

  it("refuse un montant nul ou au-delà du plafond, et un IBAN invalide", () => {
    expect(() => epcQrPayload({ ...input, amountCents: 0 })).toThrow(RangeError);
    expect(() => epcQrPayload({ ...input, amountCents: 100_000_000_000 })).toThrow(RangeError);
    expect(() => epcQrPayload({ ...input, iban: "FR76 0000" })).toThrow(RangeError);
  });

  it("raccourcit le nom du bénéficiaire à 70 caractères ; le BIC est facultatif", () => {
    const payload = epcQrPayload({ ...input, beneficiary: "A".repeat(90), bic: null });
    const parsed = parseEpcQrPayload(payload);
    expect(parsed.beneficiary).toHaveLength(70);
    expect(parsed.bic).toBe("");
  });
});
