import * as OTPAuth from "otpauth";
import QRCode from "qrcode";
import { describe, expect, it } from "vitest";
import { totpQr, totpSecretGroups } from "./totp-qr";

// Clé générée à chaque exécution, comme le fait l'app : aucun secret, même
// fictif, n'est écrit dans le dépôt.
const secret = new OTPAuth.Secret({ size: 20 });
const URI = new OTPAuth.TOTP({ issuer: "Symbola", label: "planner@example.fr", secret }).toString();

describe("ADR 0028 — QR code d'activation de la double authentification", () => {
  it("dessine un module sombre par carré, à la taille du QR code", () => {
    const qr = totpQr(URI);
    const { modules } = QRCode.create(URI, { errorCorrectionLevel: "M" });
    expect(qr.size).toBe(modules.size);
    const dark = Array.from(modules.data).filter(Boolean).length;
    expect(qr.path.match(/M\d+ \d+h1v1h-1z/g)).toHaveLength(dark);
    // Le coin supérieur gauche (motif de repérage) est sombre.
    expect(qr.path.startsWith("M0 0h1v1h-1z")).toBe(true);
  });

  it("affiche la clé secrète par groupes de 4 caractères pour une saisie à la main", () => {
    const groups = totpSecretGroups(URI);
    expect(groups).toMatch(/^([A-Z2-7]{4} )+[A-Z2-7]{1,4}$/);
    expect(groups.replaceAll(" ", "")).toBe(secret.base32);
  });
});
