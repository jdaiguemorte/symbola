// Lot 74f (HUB-11, HUB-12 ; spécification du lot 74, § 6.6) — le centre d'aide côté serveur : qui regarde
// (public, rôle, modules souscrits), ses articles, et la recherche de l'aide. Le même point d'entrée sert la
// page « Aide », la recherche du haut (groupe « Aide ») et le « ? » de chaque écran (74e, par
// `searchHelpAction`). Les articles, les mots voisins et les textes ne quittent jamais le serveur : la page
// reçoit des réponses, jamais l'index (consigne du 28/11 sur le poids des pages).
import { getLocale, getMessages } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { isModuleEnabled } from "@/modules/hub/service";
import type { HelpModule } from "./catalog";
import { articlesFor, type HelpMessage } from "./articles";
import type { HelpAudience, HelpViewer } from "./screens";
import { indexArticles, searchHelp, type HelpArticle, type HelpLexicon, type HelpSearchResult } from "./search";
import lexicons from "./help-synonyms.json";

export type HelpCenterUser = { organizationId: string | null; role: string };

const NO_MODULES: Record<HelpModule, boolean> = { hub: true, events: false, budget: false, quotes: false, vendors: false, guests: false, appointments: false, floorplans: false };

export function isTeamRole(role: string): boolean {
  return role === "owner" || role === "member";
}

// Les modules souscrits de l'organisation, lus par le hub ; l'Admin (exploitation) et toute personne hors
// équipe n'ont que l'aide de leur public, sans aucun module (SEC-09).
export async function loadHelpViewer(user: HelpCenterUser): Promise<HelpViewer> {
  const isTeam = Boolean(user.organizationId) && isTeamRole(user.role);
  const audience: HelpAudience = isTeam ? "team" : "admin";
  if (!isTeam || !user.organizationId) return { audience, isOwner: false, modules: NO_MODULES };
  const organizationId = user.organizationId;
  const db = appDatabase();
  const [events, budget, quotes, vendors, appointments] = await Promise.all(
    (["events", "budget", "quotes", "vendors", "appointments"] as const).map((module) => isModuleEnabled(db, organizationId, module)),
  );
  // Lot 49 : les écrans du module Invités, s'il est ouvert avec le module Évènements ; lot 60 : les plans
  // de salle, avec le carnet ou les évènements.
  const guests = events! && (await isModuleEnabled(db, organizationId, "guests"));
  const floorplans = (events! || vendors!) && (await isModuleEnabled(db, organizationId, "floorplans"));
  return { audience, isOwner: user.role === "owner", modules: { hub: true, events: events!, budget: budget!, quotes: quotes!, vendors: vendors!, guests, appointments: appointments!, floorplans } };
}

export async function helpLexicon(): Promise<HelpLexicon> {
  return (await getLocale()) === "en" ? lexicons.en : lexicons.fr;
}

export async function loadHelpArticles(viewer: HelpViewer): Promise<HelpArticle[]> {
  const messages = (await getMessages()) as { Help?: Record<string, HelpMessage> };
  return articlesFor(viewer, messages.Help ?? {});
}

export async function searchHelpCenter(viewer: HelpViewer, query: string): Promise<HelpSearchResult> {
  const [articles, lexicon] = await Promise.all([loadHelpArticles(viewer), helpLexicon()]);
  return searchHelp(query, indexArticles(articles), lexicon);
}
