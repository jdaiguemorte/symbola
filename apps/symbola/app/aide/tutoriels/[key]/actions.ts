"use server";

// Lot 10 (AIDE-06) — actions d'un tutoriel « en faisant » : contrôles côté
// serveur (compte d'équipe, organisation, module souscrit), progression et
// contexte enregistrés à chaque étape. Lot 63f (HUB-11, HUB-10 ; ADR 0104) : l'écran de départ est
// gardé dans le contexte (« origin ») ; chaque étape mène à son écran, où le panneau latéral du
// tutoriel la vérifie seul ; la fin et « Quitter le tutoriel » ramènent à l'écran de départ.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { getHelpProgress, isModuleEnabled, recordHelpProgress, restartHelpItem } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { TUTORIALS, type TutorialKey } from "@/lib/help/catalog";
import { TUTORIAL_SCRIPTS, type TutorialEnv } from "@/lib/help/tutorials";
import { stepHref } from "@/lib/help/tutorial-panel";
import { safeOrigin, withTutorialDone } from "@/lib/help/tutorial-origin";

type Loaded = { env: TutorialEnv; key: TutorialKey; step: number; completed: boolean };

async function load(rawKey: string): Promise<Loaded> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) redirect("/login");
  const tutorial = TUTORIALS.find((candidate) => candidate.key === rawKey);
  if (!tutorial) redirect("/tutoriels");
  const organizationId = auth.user.organizationId;
  const db = appDatabase();
  if (tutorial.module !== "hub" && !(await isModuleEnabled(db, organizationId, tutorial.module))) redirect("/tutoriels");
  const entry = (await getHelpProgress(db, auth.user.id)).find((candidate) => candidate.itemKey === `tutorial:${tutorial.key}`);
  const locale = (await getLocale()) === "en" ? "en" : "fr";
  return {
    env: { organizationId, userId: auth.user.id, locale, context: entry?.context ?? {} },
    key: tutorial.key,
    step: entry?.step ?? 0,
    completed: entry?.status === "completed",
  };
}

async function save(loaded: Loaded, step: number, context?: Record<string, string> | null, status: "started" | "completed" = "started") {
  const db = appDatabase();
  await recordHelpProgress(db, { userId: loaded.env.userId, itemKey: `tutorial:${loaded.key}`, status, step, ...(context === undefined ? {} : { context }) });
  revalidatePath(`/aide/tutoriels/${loaded.key}`);
  // Le panneau latéral du tutoriel est dans la mise en page de chaque écran.
  revalidatePath("/", "layout");
}

// L'écran de la nouvelle étape, s'il en a un : on y va.
function goToStep(loaded: Loaded, step: number, context: Record<string, string>): void {
  const href = stepHref(TUTORIAL_SCRIPTS[loaded.key].steps[step], context);
  if (href) redirect(href);
}

// L'écran d'où le tutoriel a été lancé (formulaire de sa page), gardé au premier pas seulement.
function originOf(loaded: Loaded, formData: FormData | undefined): Record<string, string> {
  if (loaded.env.context.origin) return {};
  const origin = safeOrigin(formData ? String(formData.get("origin") ?? "") : null);
  return origin ? { origin } : {};
}

export async function restartTutorialAction(key: string): Promise<void> {
  const loaded = await load(key);
  const db = appDatabase();
  await restartHelpItem(db, loaded.env.userId, `tutorial:${loaded.key}`);
  revalidatePath(`/aide/tutoriels/${loaded.key}`);
}

export async function continueTutorialAction(key: string, formData?: FormData): Promise<void> {
  const loaded = await load(key);
  const step = TUTORIAL_SCRIPTS[loaded.key].steps[loaded.step];
  if (!step || (step.kind !== "explain" && step.kind !== "look")) return;
  const origin = originOf(loaded, formData);
  await save(loaded, loaded.step + 1, Object.keys(origin).length > 0 ? origin : undefined);
  goToStep(loaded, loaded.step + 1, { ...loaded.env.context, ...origin });
}

export async function setupTutorialAction(key: string, formData?: FormData): Promise<void> {
  const loaded = await load(key);
  const script = TUTORIAL_SCRIPTS[loaded.key];
  if (script.steps[loaded.step]?.kind !== "setup") return;
  const context = { ...(script.setup ? await script.setup(loaded.env) : {}), ...originOf(loaded, formData) };
  await save(loaded, loaded.step + 1, context);
  goToStep(loaded, loaded.step + 1, { ...loaded.env.context, ...context });
}

// « Quitter le tutoriel » : l'exemple est supprimé, la progression remise à zéro, retour à l'écran
// de départ.
export async function quitTutorialAction(key: string): Promise<void> {
  const loaded = await load(key);
  const origin = safeOrigin(loaded.env.context.origin);
  await TUTORIAL_SCRIPTS[loaded.key].cleanup(loaded.env, false);
  const db = appDatabase();
  await restartHelpItem(db, loaded.env.userId, `tutorial:${loaded.key}`);
  revalidatePath("/", "layout");
  redirect(origin ?? "/tutoriels");
}

export type CheckState = { failed?: boolean };

export async function checkTutorialAction(key: string, _previous: CheckState, _formData: FormData): Promise<CheckState> {
  const loaded = await load(key);
  const step = TUTORIAL_SCRIPTS[loaded.key].steps[loaded.step];
  if (step?.kind !== "do" || !step.check) return {};
  if (!(await step.check(loaded.env))) return { failed: true };
  await save(loaded, loaded.step + 1);
  return {};
}

export async function finishTutorialAction(key: string, keep: boolean): Promise<void> {
  const loaded = await load(key);
  const script = TUTORIAL_SCRIPTS[loaded.key];
  if (script.steps[loaded.step]?.kind !== "finish") return;
  const origin = safeOrigin(loaded.env.context.origin);
  await script.cleanup(loaded.env, keep && Boolean(script.keepable));
  await save(loaded, loaded.step, null, "completed");
  // Lot 63a : le texte de fin dit si une partie de l'exemple a été gardée (modèle, prestation).
  const kept = keep && Boolean(script.keepable);
  // Lot 63f : retour à l'écran de départ, qui dit « Tutoriel terminé » et conseille le suivant.
  redirect(origin ? withTutorialDone(origin, loaded.key, kept) : `/aide/tutoriels/${loaded.key}?termine=1${kept ? "&garde=1" : ""}`);
}

// Lot 13 (AIDE-10) — un seul tutoriel en cours : abandonner celui en cours
// (son exemple fictif est supprimé, sa progression remise à zéro) pour
// commencer un autre. Jamais en silence : l'utilisateur l'a choisi.
export async function abandonTutorialAction(currentKey: string, nextKey: string): Promise<void> {
  const loaded = await load(currentKey);
  await TUTORIAL_SCRIPTS[loaded.key].cleanup(loaded.env, false);
  const db = appDatabase();
  await restartHelpItem(db, loaded.env.userId, `tutorial:${loaded.key}`);
  const next = TUTORIALS.find((candidate) => candidate.key === nextKey);
  revalidatePath("/tutoriels");
  redirect(next ? `/aide/tutoriels/${next.key}` : "/tutoriels");
}
