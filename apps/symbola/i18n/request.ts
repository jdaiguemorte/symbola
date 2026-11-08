// HUB-04 — résout la langue affichée : celle du compte si l'utilisateur
// est connecté et l'a choisie dans son profil, sinon le cookie posé par
// le middleware (langue du navigateur au premier passage).
import { cache } from "react";
import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";
import { DEFAULT_LOCALE, LOCALES, withMetierMessages, type Locale } from "@symbola/i18n";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import agencyFrMessages from "@symbola/i18n/messages/metier/event_agency.fr.json";
import agencyEnMessages from "@symbola/i18n/messages/metier/event_agency.en.json";
import { organizationMetier } from "../lib/vendors/catalog";
import { LOCALE_COOKIE } from "../middleware";
import { getAuthContext } from "../lib/auth-context";

// Import statique (pas de chemin dynamique) : webpack ne peut pas
// résoudre `@symbola/i18n/messages/${locale}.json` via l'exports map du
// package (constaté au premier `pnpm test:e2e` avec ce fichier).
const MESSAGES: Record<Locale, typeof frMessages> = { fr: frMessages, en: enMessages };
// Lot 16 (HUB-21) : vocabulaire d'une agence événementielle (et d'un métier « autre »).
const AGENCY_MESSAGES: Record<Locale, object> = { fr: agencyFrMessages, en: agencyEnMessages };
const metierOf = cache((organizationId: string) => organizationMetier(organizationId));

function isLocale(value: string | null | undefined): value is Locale {
  return LOCALES.includes(value as Locale);
}

export default getRequestConfig(async () => {
  const auth = await getAuthContext();
  const accountLocale = auth.status === "authenticated" ? auth.user.language : null;

  const cookieLocale = (await cookies()).get(LOCALE_COOKIE)?.value;
  const locale = isLocale(accountLocale) ? accountLocale : isLocale(cookieLocale) ? cookieLocale : DEFAULT_LOCALE;

  const organizationId = auth.status === "authenticated" ? auth.user.organizationId : null;
  const metier = organizationId ? await metierOf(organizationId) : "wedding_planner";
  return { locale, messages: withMetierMessages(MESSAGES[locale], metier === "wedding_planner" ? null : AGENCY_MESSAGES[locale]) };
});
