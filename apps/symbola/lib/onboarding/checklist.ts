// Lot 33b (PAR-01, étape 6 ; D11) — liste de prise en main de l'accueil, chaque action cochée d'elle-même.
// Lot 63a (HUB-11) : l'essentiel et un premier prestataire.
// Lot 74f (HUB-11 ; spécification du lot 74, § 6.6, critère 4 ; maquette 28 ; C-10) : la liste est fondue dans
// le parcours des tutoriels (lib/help/journey.ts) ; ce fichier dit seulement quels gestes sont faits dans
// l'espace : le premier mariage créé, la reprise ouverte ou complétée, le premier prestataire, l'essentiel
// réglé. Un geste d'un module non souscrit n'est pas lu (absent, il n'existe pas : ARC-06). Orchestration
// entre modules par leurs service.ts (ADR 0011) ; tout se lit sous RLS pour l'organisation donnée.
import { appDatabase } from "@symbola/db/client";
import { hasRealEvents } from "@/modules/events/service";
import { countOrganizationRealVendors } from "@/modules/vendors/service";
import { getSellerDetails, listTakeovers, type OrganizationProfile } from "@/modules/hub/service";
import type { JourneyGesture, JourneyGestures } from "@/lib/help/journey";
import { ESSENTIALS_HREF, missingForQuote } from "./essentials";

export const GESTURE_HREFS: Record<JourneyGesture, string> = {
  // Lot 71b : la page de reprise d'un mariage en cours.
  takeover: "/reprise",
  // Lot 71f : la liste « À compléter » est sur la fiche du mariage repris, ouverte depuis « Évènements ».
  takeover_complete: "/events",
  first_event: "/events/new",
  first_vendor: "/prestataires/nouveau",
  // Lot 63f (ADR 0103) : l'assistant « L'essentiel ».
  essentials: ESSENTIALS_HREF,
};

export type GestureModules = { events: boolean; vendors: boolean };

// Lot 63f (ADR 0103) : ce qu'il faut pour envoyer un devis (raison sociale, adresse, SIRET, régime de TVA),
// réglé par l'assistant ou les Paramètres. Lot 74a (L74-D4) : « Je ne sais pas encore » pour la TVA laisse
// l'essentiel à faire.
export function essentialsDone(profile: Pick<OrganizationProfile, "vatAnswerPending" | "vatRegime" | "siren" | "address">, details: Awaited<ReturnType<typeof getSellerDetails>>): boolean {
  if (profile.vatAnswerPending) return false;
  return missingForQuote({ ...details, vatRegime: profile.vatRegime, logoKey: null, iban: null, quotesEnabled: false, reached: 0, finished: false }).length === 0 || (profile.siren !== null && profile.address !== null && profile.vatRegime !== null);
}

export async function loadJourneyGestures(organizationId: string, profile: OrganizationProfile, modules: GestureModules): Promise<JourneyGestures> {
  const db = appDatabase();
  const [details, realEvents, takeovers, vendorCount] = await Promise.all([
    getSellerDetails(db, organizationId),
    modules.events ? hasRealEvents(organizationId) : Promise.resolve(null),
    modules.events ? listTakeovers(db, organizationId) : Promise.resolve(null),
    modules.vendors ? countOrganizationRealVendors(organizationId) : Promise.resolve(null),
  ]);
  const gestures: JourneyGestures = { essentials: essentialsDone(profile, details) };
  if (realEvents !== null) gestures.first_event = realEvents;
  if (takeovers !== null) {
    gestures.takeover = takeovers.length > 0;
    gestures.takeover_complete = takeovers.some((takeover) => takeover.completedAt !== null);
  }
  if (vendorCount !== null) gestures.first_vendor = vendorCount > 0;
  return gestures;
}
