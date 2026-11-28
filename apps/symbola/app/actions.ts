"use server";

import { getLocale } from "next-intl/server";
import { starterTour, type StarterTourStep } from "@symbola/starter-templates";
import { appDatabase } from "@symbola/db/client";
import { InvalidHelpItemError, recordHelpProgress, recordTourVenue } from "@/modules/hub/service";
import { getAuthContext } from "@/lib/auth-context";
import { isTourKey } from "@/lib/help/tours";

// Lot 10 (AIDE-05 à AIDE-07) — progression d'une visite ou d'un tutoriel.
export async function recordHelpProgressAction(itemKey: string, status: "started" | "postponed" | "completed", step: number): Promise<void> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return;
  const db = appDatabase();
  try {
    await recordHelpProgress(db, { userId: auth.user.id, itemKey, status, step });
  } catch (error) {
    if (!(error instanceof InvalidHelpItemError)) throw error;
  }
}

// Lot 74d (D2, B11 ; L74-D9) — la ligne « Découvrir cet écran » a paru : une venue de plus pour la
// personne connectée (au plus une par jour), jamais pour une autre.
export async function recordTourVenueAction(tourKey: string): Promise<void> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || typeof tourKey !== "string" || !isTourKey(tourKey)) return;
  await recordTourVenue(appDatabase(), auth.user.id, tourKey);
}

// Lot 74d (consigne NFR-02 du 28/11) — les bulles d'une visite ne voyagent pas avec chaque page : elles
// sont lues au moment où la visite démarre, dans la langue de l'écran.
export async function loadTourStepsAction(tourKey: string, variant: string): Promise<StarterTourStep[]> {
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || typeof tourKey !== "string" || !isTourKey(tourKey)) return [];
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  return starterTour(locale, tourKey, variant === "empty" ? "empty" : "filled");
}
