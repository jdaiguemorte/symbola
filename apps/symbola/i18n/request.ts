// HUB-04 — résout la langue affichée : celle du compte si l'utilisateur
// est connecté et l'a choisie dans son profil, sinon le cookie posé par
// le middleware (langue du navigateur au premier passage).
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALES, type Locale } from "@symbola/i18n";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import { LOCALE_COOKIE } from "../middleware";
import { getAuthContext } from "../lib/auth-context";

// Import statique (pas de chemin dynamique) : webpack ne peut pas
// résoudre `@symbola/i18n/messages/${locale}.json` via l'exports map du
// package (constaté au premier `pnpm test:e2e` avec ce fichier).
const MESSAGES: Record<Locale, typeof frMessages> = { fr: frMessages, en: enMessages };

function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export default getRequestConfig(async () => {
  const auth = await getAuthContext();
  const accountLocale = auth.status === "authenticated" ? auth.user.language : null;

  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(accountLocale) ? accountLocale : isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  return { locale, messages: MESSAGES[locale] };
});
