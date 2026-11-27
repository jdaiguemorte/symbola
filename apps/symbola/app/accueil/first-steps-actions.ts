"use server";

// Lot 72b (AIDE-04, HUB-11 ; spécification du lot 72, § 5.2, critère 5) — « Masquer » « Pour bien démarrer »,
// et « Annuler ». Le réglage est celui de la personne connectée (`hub.users.first_steps_hidden`) : il suit sur
// tous ses appareils et ne touche pas ses collègues. Aucun identifiant ne vient du navigateur : la session
// seule dit de qui il s'agit (SEC-12, SEC-13).
import { revalidatePath } from "next/cache";
import { appDatabase } from "@symbola/db/client";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { hideFirstSteps, showFirstSteps } from "@/modules/hub/service";

export type FirstStepsResult = { ok: boolean };

async function setHidden(hidden: boolean): Promise<FirstStepsResult> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { ok: false };
  const db = appDatabase();
  await (hidden ? hideFirstSteps(db, auth.user.id) : showFirstSteps(db, auth.user.id));
  revalidatePath("/");
  return { ok: true };
}

export async function hideFirstStepsAction(): Promise<FirstStepsResult> {
  return setHidden(true);
}

export async function showFirstStepsAction(): Promise<FirstStepsResult> {
  return setHidden(false);
}
