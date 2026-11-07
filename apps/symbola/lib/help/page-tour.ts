// Lot 10 (AIDE-05), revu au lot 13 (AIDE-11) — repères d'un écran : affichés
// d'office à la première ouverture (décision C), ou à la demande
// (« ?visite=revoir » depuis le centre d'aide).
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { LandmarkStep } from "@symbola/ui";
import { createAppConnection } from "@symbola/db/client";
import { getHelpProgress } from "@/modules/hub/service";
import { AUTO_TOURS_COOKIE } from "./preferences";
import { TOUR_TARGETS, type TourKey } from "./tours";

export type PageTourState = {
  tourKey: TourKey;
  steps: LandmarkStep[];
  initialOpen: boolean;
};

export async function loadPageTour(userId: string, tourKey: TourKey, resume?: string): Promise<PageTourState> {
  const t = await getTranslations("Tour");
  const texts = t.raw(tourKey) as { title: string; body: string }[];
  const targets: readonly (string | undefined)[] = TOUR_TARGETS[tourKey];
  const steps = texts.map((text, index) => ({ ...text, target: targets[index] }));

  const { sql, db } = createAppConnection();
  let entry;
  try {
    entry = (await getHelpProgress(db, userId)).find((candidate) => candidate.itemKey === `tour:${tourKey}`);
  } finally {
    await sql.end();
  }
  const asked = resume === "reprendre" || resume === "revoir";
  // Préférence « Ouvrir les visites automatiquement » (centre d'aide).
  const autoTours = (await cookies()).get(AUTO_TOURS_COOKIE)?.value !== "0";
  return {
    tourKey,
    steps,
    initialOpen: (!entry && autoTours) || asked,
  };
}
