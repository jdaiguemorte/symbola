// Lot 74f (HUB-11 ; spécification du lot 74, § 6.6 ; maquette 28) — le parcours d'une personne, lu côté
// serveur : sa progression (par personne, `hub.help_progress`), son choix ou la réponse de l'assistant (74a),
// les gestes faits dans l'espace de son organisation et les tutoriels des modules souscrits. Lu par
// « Pour bien démarrer » (accueil et Aide) et par la page Tutoriels : une seule liste (C-10).
import { appDatabase } from "@symbola/db/client";
import { getHelpProgress, getOrganizationProfile } from "@/modules/hub/service";
import { loadJourneyGestures } from "@/lib/onboarding/checklist";
import { TUTORIALS } from "./catalog";
import { buildJourney, chooseJourney, type JourneyView } from "./journey";
import type { HelpViewer } from "./screens";

export async function loadJourney(input: { organizationId: string; userId: string; viewer: HelpViewer }): Promise<JourneyView> {
  const db = appDatabase();
  const [progress, profile] = await Promise.all([getHelpProgress(db, input.userId), getOrganizationProfile(db, input.organizationId)]);
  const gestures = await loadJourneyGestures(input.organizationId, profile, { events: input.viewer.modules.events, vendors: input.viewer.modules.vendors });
  return buildJourney({
    choice: chooseJourney(profile.hasOngoingEvents, progress),
    available: TUTORIALS.filter((tutorial) => input.viewer.modules[tutorial.module]),
    progress,
    gestures,
  });
}
