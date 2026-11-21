// Lot 10 (AIDE-05), revu au lot 13 (AIDE-11) puis au lot 63f (HUB-11 ; ADR 0104) — visite guidée
// d'un écran : lancée d'office à la première ouverture (si la préférence « visites automatiques »
// est active), ou à la demande (« ?visite=revoir » depuis le centre d'aide). Contenu lu dans le
// fichier de données des visites, dans la langue de l'écran.
import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import type { TourStep } from "@symbola/ui";
import { starterTour } from "@symbola/starter-templates";
import { appDatabase } from "@symbola/db/client";
import { getHelpProgress } from "@/modules/hub/service";
import { AUTO_TOURS_COOKIE } from "./preferences";
import type { TourKey } from "./tours";

export type PageTourState = {
  tourKey: TourKey;
  steps: TourStep[];
  initialOpen: boolean;
};

export async function loadPageTour(userId: string, tourKey: TourKey, resume?: string): Promise<PageTourState> {
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  const steps = starterTour(locale, tourKey);

  const db = appDatabase();
  const entry = (await getHelpProgress(db, userId)).find((candidate) => candidate.itemKey === `tour:${tourKey}`);
  const asked = resume === "reprendre" || resume === "revoir";
  // Préférence « Lancer la visite à la première ouverture d'un écran » (centre d'aide).
  const autoTours = (await cookies()).get(AUTO_TOURS_COOKIE)?.value !== "0";
  return {
    tourKey,
    steps,
    initialOpen: (!entry && autoTours) || asked,
  };
}
