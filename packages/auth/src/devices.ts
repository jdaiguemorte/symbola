// Lot 52 (HUB-05, SEC-08 ; D4 ; ADR 0094) — l'appareil d'une session : navigateur et système lus dans
// l'en-tête User-Agent, rangés en deux clés (« safari/iphone ») que l'écran traduit ; aucun texte
// affiché ici, aucune adresse IP ni ville. L'identifiant d'appareil est un aléa gardé dans un cookie :
// il ne dit rien de la personne, il sert à reconnaître un appareil déjà vu (alerte de nouvel appareil).
import { createHash, randomBytes } from "node:crypto";

export const DEVICE_BROWSERS = ["edge", "opera", "samsung", "firefox", "chrome", "safari", "other"] as const;
export const DEVICE_SYSTEMS = ["iphone", "ipad", "android", "mac", "windows", "linux", "other"] as const;
export type DeviceBrowser = (typeof DEVICE_BROWSERS)[number];
export type DeviceSystem = (typeof DEVICE_SYSTEMS)[number];
export type DeviceLabel = { browser: DeviceBrowser; system: DeviceSystem };

const DEVICE_ID = /^[A-Za-z0-9_-]{22,64}$/;

function browserOf(userAgent: string): DeviceBrowser {
  if (/Edg(e|A|iOS)?\//.test(userAgent)) return "edge";
  if (/OPR\/|Opera/.test(userAgent)) return "opera";
  if (/SamsungBrowser\//.test(userAgent)) return "samsung";
  if (/Firefox\/|FxiOS\//.test(userAgent)) return "firefox";
  if (/Chrome\/|CriOS\/|Chromium\//.test(userAgent)) return "chrome";
  if (/Safari\//.test(userAgent) && /Version\//.test(userAgent)) return "safari";
  return "other";
}

function systemOf(userAgent: string): DeviceSystem {
  if (/iPhone|iPod/.test(userAgent)) return "iphone";
  if (/iPad/.test(userAgent)) return "ipad";
  if (/Android/.test(userAgent)) return "android";
  if (/Macintosh|Mac OS X/.test(userAgent)) return "mac";
  if (/Windows/.test(userAgent)) return "windows";
  if (/Linux|X11|CrOS/.test(userAgent)) return "linux";
  return "other";
}

export function deviceLabelOf(userAgent: string | null | undefined): DeviceLabel {
  const text = (userAgent ?? "").slice(0, 512);
  return { browser: browserOf(text), system: systemOf(text) };
}

export function formatDeviceLabel(label: DeviceLabel): string {
  return `${label.browser}/${label.system}`;
}

// Relit une clé gardée en base ; toute valeur inconnue devient « other/other ».
export function parseDeviceLabel(value: string | null | undefined): DeviceLabel {
  const [browser, system] = (value ?? "").split("/");
  return {
    browser: (DEVICE_BROWSERS as readonly string[]).includes(browser ?? "") ? (browser as DeviceBrowser) : "other",
    system: (DEVICE_SYSTEMS as readonly string[]).includes(system ?? "") ? (system as DeviceSystem) : "other",
  };
}

export function newDeviceId(): string {
  return randomBytes(24).toString("base64url");
}

// Un identifiant d'appareil reçu du cookie, s'il a la forme attendue ; sinon null (un nouveau sera créé).
export function validDeviceId(value: string | null | undefined): string | null {
  return value && DEVICE_ID.test(value) ? value : null;
}

// Jeton du lien « Ce n'est pas moi » d'une alerte de nouvel appareil : seul son haché est gardé.
export function newAlertToken(): string {
  return randomBytes(32).toString("base64url");
}

export function hashAlertToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
