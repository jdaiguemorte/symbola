// Lot 10 (AIDE-05), revu au lot 13 (AIDE-11), au lot 63f (HUB-11 ; ADR 0104) puis au lot 74d (D2 de
// l'audit, B10, B11 ; page 25 des maquettes du lot 68) — la visite guidée d'un écran, proposée et non
// imposée. Seule celle de l'accueil s'ouvre d'elle-même, une fois, quand l'assistant est fini ; les
// autres se proposent par la ligne « Découvrir cet écran en 1 minute » (modules/hub/tour-offer.ts).
// « ?visite=revoir » (centre d'aide) l'ouvre à la demande.
//
// Consigne NFR-02 du 28/11 : rien de la visite ne voyage avec la page que ce qu'il faut pour la
// proposer (son nom, son nombre de bulles, les mots de la ligne quand elle paraît) ; ses bulles sont
// lues quand elle démarre (loadTourStepsAction). La progression est celle que la mise en page a déjà
// lue (lecture gardée le temps de l'affichage) ; l'état de l'assistant n'est lu que pour l'accueil.
import { cookies } from "next/headers";
import { getTranslations } from "next-intl/server";
import { isAutomaticTour, starterTourLength, type StarterTourVariant } from "@symbola/starter-templates";
import { appDatabase } from "@symbola/db/client";
import { getHelpProgress, getSetupState, tourOffer, tourProgressOf, type TourOffer } from "@/modules/hub/service";
import { getAuthContext } from "@/lib/auth-context";
import { AUTO_TOURS_COOKIE } from "./preferences";
import type { TourKey } from "./tours";

export type TourLineLabels = { label: string; lead: string; start: string; close: string };

export type PageTourState = {
  tourKey: TourKey;
  stepCount: number;
  variant: StarterTourVariant;
  // « auto » : la visite s'ouvre d'elle-même (accueil) ; « line » : la ligne la propose.
  offer: TourOffer;
  // Demandée (« ?visite=revoir ») : elle s'ouvre tout de suite.
  replay: boolean;
  line: TourLineLabels | null;
};

export async function loadPageTour(userId: string, tourKey: TourKey, resume?: string, options: { empty?: boolean } = {}): Promise<PageTourState> {
  const empty = options.empty === true;
  const replay = resume === "reprendre" || resume === "revoir";
  const db = appDatabase();
  // Préférence « Proposer la visite d'un écran à sa première ouverture » (centre d'aide).
  const preference = (await cookies()).get(AUTO_TOURS_COOKIE)?.value !== "0";
  const automatic = isAutomaticTour(tourKey);
  const progress = preference && !replay ? tourProgressOf(await getHelpProgress(db, userId), tourKey) : null;
  // Lot 74a (HUB-09 ; C-68, critère 1) : la visite de l'accueil attend la fin de l'assistant.
  let setupDone = true;
  if (automatic && preference && !replay && progress === null) {
    const auth = await getAuthContext();
    setupDone = auth.status !== "authenticated" || !auth.user.organizationId || (await getSetupState(db, auth.user.organizationId)).completed;
  }
  const offer = replay ? null : tourOffer({ automatic, progress, now: new Date(), preference, setupDone, empty });
  let line: TourLineLabels | null = null;
  if (offer === "line") {
    const t = await getTranslations("TourLine");
    line = { label: t("label"), lead: t("lead"), start: t("start"), close: t("close") };
  }
  return { tourKey, stepCount: starterTourLength(tourKey), variant: empty ? "empty" : "filled", offer, replay, line };
}

// Un écran qui ne se sait vide qu'après la lecture de la visite (lectures parallèles) : pas de ligne
// « Découvrir » (C-69) ; la visite demandée ou celle de l'accueil prennent leurs bulles « vide ».
export function onEmptyScreen(state: PageTourState, empty: boolean): PageTourState {
  if (!empty) return state;
  return { ...state, variant: "empty", ...(state.offer === "line" ? { offer: null, line: null } : {}) };
}
