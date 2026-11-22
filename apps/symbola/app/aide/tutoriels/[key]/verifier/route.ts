// Lot 63f (HUB-11 ; ADR 0104) — vérification de l'étape « faire » demandée par le panneau latéral du
// tutoriel, à chaque changement d'écran et toutes les quelques secondes. Une route plutôt qu'une
// action serveur : les actions de Next.js passent l'une après l'autre, et la vérification ne doit
// jamais retarder un envoi de la planner. Mêmes contrôles côté serveur que « J'ai fait, vérifier » :
// session d'une planner, même origine, tutoriel connu, module souscrit, résultat lu par le service.ts
// du module. Rien de personnel dans la réponse.
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { getHelpProgress, isModuleEnabled, recordHelpProgress } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { TUTORIALS } from "@/lib/help/catalog";
import { TUTORIAL_SCRIPTS } from "@/lib/help/tutorials";
import { isSameOrigin } from "@/lib/uploads/receive";

const answer = (advanced: boolean, status = 200) => Response.json({ advanced }, { status, headers: { "Cache-Control": "no-store" } });

export async function POST(request: Request, { params }: { params: Promise<{ key: string }> }): Promise<Response> {
  if (!isSameOrigin(request.headers)) return answer(false, 403);
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return answer(false, 401);
  const { key } = await params;
  const tutorial = TUTORIALS.find((candidate) => candidate.key === key);
  if (!tutorial) return answer(false, 404);
  const organizationId = auth.user.organizationId;
  const db = appDatabase();
  if (tutorial.module !== "hub" && !(await isModuleEnabled(db, organizationId, tutorial.module))) return answer(false, 404);
  const entry = (await getHelpProgress(db, auth.user.id)).find((candidate) => candidate.itemKey === `tutorial:${tutorial.key}`);
  const index = entry?.step ?? 0;
  const step = TUTORIAL_SCRIPTS[tutorial.key].steps[index];
  if (!entry || entry.status === "completed" || step?.kind !== "do" || !step.check) return answer(false);
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  if (!(await step.check({ organizationId, userId: auth.user.id, locale, context: entry.context ?? {} }))) return answer(false);
  await recordHelpProgress(db, { userId: auth.user.id, itemKey: `tutorial:${tutorial.key}`, status: "started", step: index + 1 });
  revalidatePath("/", "layout");
  return answer(true);
}
