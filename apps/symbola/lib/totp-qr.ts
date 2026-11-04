// Activation de la double authentification (ADR 0028) : QR code du lien
// otpauth:// calculé côté serveur, puis dessiné en SVG par React (aucun HTML
// injecté, aucun service externe, CSP inchangée), et clé secrète lisible
// pour une saisie à la main dans l'application d'authentification.
import QRCode from "qrcode";

export type TotpQr = { size: number; path: string };

export type TotpSetupDisplay = { provisioningUri: string; qr: TotpQr; secretGroups: string };

// Un tracé SVG unique : un carré d'une unité par module sombre.
export function totpQr(provisioningUri: string): TotpQr {
  const { modules } = QRCode.create(provisioningUri, { errorCorrectionLevel: "M" });
  const commands: string[] = [];
  for (let row = 0; row < modules.size; row++) {
    for (let column = 0; column < modules.size; column++) {
      if (modules.get(row, column)) commands.push(`M${column} ${row}h1v1h-1z`);
    }
  }
  return { size: modules.size, path: commands.join("") };
}

// Clé secrète (base32) par groupes de 4 caractères, comme l'affichent les
// applications d'authentification.
export function totpSecretGroups(provisioningUri: string): string {
  const secret = new URL(provisioningUri).searchParams.get("secret") ?? "";
  return secret.match(/.{1,4}/g)?.join(" ") ?? "";
}

export function totpSetupDisplay(provisioningUri: string): TotpSetupDisplay {
  return { provisioningUri, qr: totpQr(provisioningUri), secretGroups: totpSecretGroups(provisioningUri) };
}
