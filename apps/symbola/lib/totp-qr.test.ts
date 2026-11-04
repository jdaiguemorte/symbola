import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { totpQr, totpSecretGroups } from "./totp-qr";

const URI = "otpauth://totp/Symbola:julien%40example.fr?secret=JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP&issuer=Symbola&algorithm=SHA1&digits=6&period=30";

describe("ADR 0028 — QR code d'activation de la double authentification", () => {
  it("dessine un module sombre par carré, à la taille du QR code", () => {
    const qr = totpQr(URI);
    const { modules } = QRCode.create(URI, { errorCorrectionLevel: "M" });
    expect(qr.size).toBe(modules.size);
    const dark = Array.from(modules.data).filter(Boolean).length;
    expect(qr.path.match(/M\d+ \d+h1v1h-1z/g)).toHaveLength(dark);
    // Les trois motifs de repérage (coins) sont sombres.
    expect(qr.path.startsWith("M0 0h1v1h-1z")).toBe(true);
  });

  it("affiche la clé secrète par groupes de 4 caractères pour une saisie à la main", () => {
    expect(totpSecretGroups(URI)).toBe("JBSW Y3DP EHPK 3PXP JBSW Y3DP EHPK 3PXP");
  });
});
