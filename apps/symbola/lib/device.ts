// Lot 52 (HUB-05, SEC-08 ; D4 ; ADR 0094) — plomberie HTTP de l'appareil : un identifiant aléatoire
// gardé dans un cookie (HttpOnly, SameSite=Lax, Secure selon l'environnement, treize mois), relu à
// chaque connexion pour reconnaître un appareil déjà vu ; et le texte de l'appareil, traduit
// (« Safari sur iPhone »), à partir des deux clés gardées en base. Aucune adresse IP ni ville.
import { cookies, headers } from "next/headers";
import type { DeviceLabel } from "@symbola/auth";
import { secureCookies } from "./cookie-security";

export const DEVICE_COOKIE_NAME = "symbola_appareil_id";
const DEVICE_COOKIE_MAX_AGE_S = 395 * 24 * 60 * 60;

export async function readDevice(): Promise<{ id: string | null; userAgent: string | null }> {
  const [store, requestHeaders] = await Promise.all([cookies(), headers()]);
  return { id: store.get(DEVICE_COOKIE_NAME)?.value ?? null, userAgent: requestHeaders.get("user-agent") };
}

export async function rememberDeviceCookie(deviceId: string): Promise<void> {
  (await cookies()).set(DEVICE_COOKIE_NAME, deviceId, { httpOnly: true, sameSite: "lax", secure: secureCookies(), path: "/", maxAge: DEVICE_COOKIE_MAX_AGE_S });
}

type DeviceWords = (key: string, values?: Record<string, string>) => string;

// t : traducteur de l'espace « Devices ».
export function deviceText(device: DeviceLabel, t: DeviceWords): string {
  return t("label", { browser: t(`browser.${device.browser}`), system: t(`system.${device.system}`) });
}
