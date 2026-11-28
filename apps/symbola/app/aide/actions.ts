"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { recordHelpProgress } from "@/modules/hub/service";
import { getAuthContext } from "@/lib/auth-context";
import { AUTO_TOURS_COOKIE } from "@/lib/help/preferences";
import { isTeamRole, loadHelpViewer, searchHelpCenter } from "@/lib/help/help-center";
import { JOURNEY_ITEM_KEY, isJourneyPath } from "@/lib/help/journey";
import { HELP_SEARCH_MIN_LENGTH, type HelpSearchResult } from "@/lib/help/search";
import type { FormDialogState } from "@/app/ui/form-dialog";

// Lot 10 (AIDE-05) — préférence d'affichage, un an, sans donnée personnelle.
export async function setAutoToursAction(enabled: boolean): Promise<void> {
  (await cookies()).set(AUTO_TOURS_COOKIE, enabled ? "1" : "0", { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" });
}

const EMPTY: HelpSearchResult = { understood: [], best: null, others: [] };

// Lot 74f (HUB-12 ; spécification du lot 74, § 6.5 et 6.6) — la recherche de l'aide, pour le « ? » de chaque
// écran (« Une autre question ? », 74e) : la même réponse que la page « Aide », calculée ici, pour la session,
// le public et les modules de la personne (un article d'un module non souscrit n'est jamais rendu). Sans
// session : aucune réponse. La phrase n'est ni journalisée ni gardée (SEC-20).
export async function searchHelpAction(query: unknown): Promise<HelpSearchResult> {
  if (typeof query !== "string") return EMPTY;
  const term = query.slice(0, 200).trim();
  if (term.length < HELP_SEARCH_MIN_LENGTH) return EMPTY;
  const auth = await getAuthContext();
  if (auth.status !== "authenticated") return EMPTY;
  return searchHelpCenter(await loadHelpViewer(auth.user), term);
}

// Lot 74f (HUB-11 ; maquette 28, « Changer de parcours ») : le parcours choisi est gardé pour la personne
// (sa progression d'aide, `setup:journey`) ; ce qui est fait reste fait dans l'autre parcours. L'équipe
// seulement ; une valeur inconnue est refusée.
export async function chooseJourneyAction(_state: FormDialogState, formData: FormData): Promise<FormDialogState> {
  const t = await getTranslations("TutorialsPage");
  const path = formData.get("parcours");
  if (!isJourneyPath(path)) return { error: t("change.invalid"), at: Date.now() };
  const auth = await getAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId || !isTeamRole(auth.user.role)) return { error: t("change.invalid"), at: Date.now() };
  await recordHelpProgress(appDatabase(), { userId: auth.user.id, itemKey: JOURNEY_ITEM_KEY, status: "started", context: { path } });
  revalidatePath("/tutoriels");
  revalidatePath("/aide");
  return { success: true, at: Date.now() };
}
