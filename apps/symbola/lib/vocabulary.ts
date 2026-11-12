// Lot 16 (ADR 0045) — vocabulaire des clients : « les mariés » (couple) ou « le
// client » (clients). Sur la page d'un événement (/events/<id>, /budget/<id>,
// /devis/<id> par l'événement du devis, et le portail d'un lien), il suit le type de
// cet événement ; ailleurs, et pour un événement sans type, il suit le métier
// de l'organisation (une wedding planner parle des mariés, une agence de ses
// clients). Le catalogue parle des mariés ; les textes « le client » le
// remplacent clé par clé (packages/i18n/src/messages/vocabulary).
import { cache } from "react";
import { headers } from "next/headers";
import { createTranslator } from "next-intl";
import { withMetierMessages, type Locale } from "@symbola/i18n";
import frMessages from "@symbola/i18n/messages/fr.json";
import enMessages from "@symbola/i18n/messages/en.json";
import clientsFrMessages from "@symbola/i18n/messages/vocabulary/clients.fr.json";
import clientsEnMessages from "@symbola/i18n/messages/vocabulary/clients.en.json";
import { getEventAudience, listEventAudiences, type EventTypeAudience } from "@/modules/events/service";
import { getQuote } from "@/modules/quotes/service";
import { getAuthContext } from "./auth-context";
import { currentLinkAccess } from "./link-session";
import { organizationMetier } from "./vendors/catalog";

export type Audience = EventTypeAudience;

// Import statique (pas de chemin dynamique) : webpack ne résout pas un chemin
// calculé dans l'exports map du paquet.
const MESSAGES: Record<Locale, typeof frMessages> = { fr: frMessages, en: enMessages };
const CLIENTS_MESSAGES: Record<Locale, object> = { fr: clientsFrMessages, en: clientsEnMessages };

export function messagesFor(locale: Locale, audience: Audience): typeof frMessages {
  return withMetierMessages(MESSAGES[locale], audience === "clients" ? CLIENTS_MESSAGES[locale] : null);
}

// Vocabulaire du métier : une organisation sans métier (ou l'Admin, sans
// organisation) parle des mariés, comme avant le lot 16.
export const organizationAudience = cache(async (organizationId: string | null): Promise<Audience> =>
  organizationId && (await organizationMetier(organizationId)) !== "wedding_planner" ? "clients" : "couple",
);

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const EVENT_PAGE = new RegExp(`^/(?:events|budget)/(${UUID})(?:/|$)`, "i");
const QUOTE_PAGE = new RegExp(`^/devis/(${UUID})(?:/|$)`, "i");

// L'événement dont la page est affichée, s'il y en a un.
async function routeEventId(pathname: string, organizationId: string): Promise<string | null> {
  const event = EVENT_PAGE.exec(pathname);
  if (event) return event[1]!;
  const quote = QUOTE_PAGE.exec(pathname);
  if (!quote) return null;
  try {
    return (await getQuote(organizationId, quote[1]!)).eventId;
  } catch {
    // Devis introuvable : la page le dira ; le vocabulaire reste celui du métier.
    return null;
  }
}

// Lot 20 (décision 6) : écrans qui mêlent les événements (accueil, liste des
// événements, tâches, devis et factures, encaissements).
const MIXED_PAGE = /^\/(?:|events|taches|devis|devis\/encaissements)$/;

// Vocabulaire de chaque événement (celui du métier pour un événement sans type).
export const eventAudiences = cache(async (organizationId: string): Promise<Map<string, Audience>> => {
  const fallback = await organizationAudience(organizationId);
  return new Map([...(await listEventAudiences(organizationId))].map(([eventId, audience]) => [eventId, audience ?? fallback]));
});

// L'organisation a-t-elle des événements des deux vocabulaires (mariages et
// séminaires, par exemple) ?
export async function organizationMixesAudiences(organizationId: string): Promise<boolean> {
  return new Set((await eventAudiences(organizationId)).values()).size > 1;
}

// Vocabulaire de la requête : celui du type de l'événement affiché, sinon celui
// du métier. L'adresse vient du middleware (en-tête x-pathname). Lot 20
// (décision 6) : sur un écran qui mêle des événements des deux vocabulaires,
// le vocabulaire neutre (« Événement », « Clients ») ; chaque ligne garde
// celui de son événement quand l'écran le précise (Tâches).
export const requestAudience = cache(async (organizationId: string | null): Promise<Audience> => {
  const fallback = await organizationAudience(organizationId);
  if (!organizationId) return fallback;
  const pathname = (await headers()).get("x-pathname") ?? "";
  const eventId = await routeEventId(pathname, organizationId);
  if (!eventId) return MIXED_PAGE.test(pathname) && (await organizationMixesAudiences(organizationId)) ? "clients" : fallback;
  return (await getEventAudience(organizationId, eventId)) ?? fallback;
});

// Lot 20 (décision 6) : le libellé « qui réalise la tâche » dans le
// vocabulaire de son événement (« Mariés » ou « Clients »).
export async function responsibleLabels(organizationId: string, locale: Locale): Promise<(eventId: string, responsible: "planner" | "clients") => string> {
  const audiences = await eventAudiences(organizationId);
  const fallback = await organizationAudience(organizationId);
  const translators = {
    couple: createTranslator({ locale, messages: messagesFor(locale, "couple"), namespace: "Events" }),
    clients: createTranslator({ locale, messages: messagesFor(locale, "clients"), namespace: "Events" }),
  };
  return (eventId, responsible) => translators[audiences.get(eventId) ?? fallback](responsible === "clients" ? "responsibleClients" : "responsiblePlanner");
}

// Messages du cadre de l'app (menu, recherche…), qui reste en place d'une page
// à l'autre : toujours le vocabulaire du métier.
export async function organizationMessages(locale: Locale): Promise<typeof frMessages> {
  const auth = await getAuthContext();
  const organizationId = auth.status === "authenticated" ? auth.user.organizationId : null;
  if (organizationId) return messagesFor(locale, await organizationAudience(organizationId));
  // Lot 26a : le portail d'un lien parle comme le type de son événement.
  const link = await currentLinkAccess();
  if (link) return messagesFor(locale, (await getEventAudience(link.organizationId, link.eventId)) ?? (await organizationAudience(link.organizationId)));
  return messagesFor(locale, await organizationAudience(null));
}

// Création d'un événement : les champs des clients changent de libellé avec le
// type choisi (« Prénom du premier marié » ou « Prénom du premier contact »).
const CLIENT_FIELD_KEYS = ["client1FirstName", "client1LastName", "client2FirstName", "client2LastName"] as const;
export type ClientFieldLabels = Record<(typeof CLIENT_FIELD_KEYS)[number], string>;

export function clientFieldLabelsByAudience(locale: Locale): Record<Audience, ClientFieldLabels> {
  const labels = (audience: Audience): ClientFieldLabels => {
    const t = createTranslator({ locale, messages: messagesFor(locale, audience), namespace: "Events" });
    return Object.fromEntries(CLIENT_FIELD_KEYS.map((key) => [key, t(key)])) as ClientFieldLabels;
  };
  return { couple: labels("couple"), clients: labels("clients") };
}

// Un texte de l'espace Events dans le vocabulaire d'un type donné (message
// d'erreur d'une action, où le type vient du formulaire).
export function eventsMessageFor(locale: Locale, audience: Audience, key: "missingFirstName"): string {
  return createTranslator({ locale, messages: messagesFor(locale, audience), namespace: "Events" })(key);
}
