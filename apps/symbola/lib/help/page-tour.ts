// Lot 10 (AIDE-05) — état d'une visite focus pour une page : ouverte d'office
// à la première visite, ou à la demande (« ?visite=reprendre » depuis la barre
// ou le centre d'aide), à l'étape où elle avait été mise de côté.
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import type { FocusTourStep } from "@symbola/ui";
import { createAppConnection } from "@symbola/db/client";
import { getHelpProgress } from "@/modules/hub/service";
import { AUTO_TOURS_COOKIE } from "./preferences";
import { TOUR_TARGETS, type TourKey } from "./tours";

export type PageTourState = {
  tourKey: TourKey;
  steps: FocusTourStep[];
  initialOpen: boolean;
  initialStep: number;
  // Étape où la visite a été mise de côté (barre d'aide : « Reprendre »).
  postponedStep: number | null;
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
    initialStep: resume === "reprendre" && entry && entry.status !== "completed" ? entry.step : 0,
    postponedStep: entry?.status === "postponed" && !asked ? entry.step : null,
  };
}
