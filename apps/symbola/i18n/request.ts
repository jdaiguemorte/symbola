// PRD-HUB-04 — résout la langue affichée : celle du compte si l'utilisateur
// est connecté et l'a choisie dans son profil, sinon le cookie posé par
// le middleware (langue du navigateur au premier passage).
// Lot 16 (L16-HUB-21, ADR 0045) — et le vocabulaire des clients : celui du type de
// l'événement affiché, sinon celui du métier de l'organisation
// (lib/vocabulary.ts).
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@symbola/i18n";
import { LOCALE_COOKIE } from "../middleware";
import { getAuthContext } from "../lib/auth-context";
import { messagesFor, requestAudience } from "../lib/vocabulary";

function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export default getRequestConfig(async () => {
  const auth = await getAuthContext();
  const accountLocale = auth.status === "authenticated" ? auth.user.language : null;

  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(accountLocale) ? accountLocale : isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  const organizationId = auth.status === "authenticated" ? auth.user.organizationId : null;
  return { locale, messages: messagesFor(locale, await requestAudience(organizationId)) };
});
