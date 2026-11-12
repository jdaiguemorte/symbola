// Lot 26a (UX-11, SEC-14, SEC-17 ; ADR 0053) — session ouverte par un lien
// personnel. Plomberie HTTP seulement : le cookie ne porte qu'un jeton de
// session (jamais le jeton du lien), que le module events relit en base à
// chaque requête (lien retiré, expiré, événement perdu : plus d'accès).
import { cache } from "react";
import { cookies } from "next/headers";
import { resolveLinkSession, type LinkAccess } from "@/modules/events/service";
import { LINK_COOKIE_NAME, linkCookieOptions } from "./link-cookie";

export { LINK_COOKIE_NAME } from "./link-cookie";

export async function getLinkSessionToken(): Promise<string | undefined> {
  return (await cookies()).get(LINK_COOKIE_NAME)?.value;
}

export async function setLinkSessionCookie(token: string, maxAgeSeconds: number): Promise<void> {
  (await cookies()).set(LINK_COOKIE_NAME, token, linkCookieOptions(maxAgeSeconds));
}

export async function clearLinkSessionCookie(): Promise<void> {
  (await cookies()).delete(LINK_COOKIE_NAME);
}

// L'accès du lien de la requête en cours (une seule lecture en base par requête).
export const currentLinkAccess = cache(async (): Promise<LinkAccess | null> => {
  const token = await getLinkSessionToken();
  return token ? resolveLinkSession(token) : null;
});
