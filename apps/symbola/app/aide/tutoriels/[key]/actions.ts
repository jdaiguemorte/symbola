"use server";

// Lot 10 (AIDE-06) — actions d'un tutoriel « en faisant » : contrôles côté
// serveur (compte d'équipe, organisation, module souscrit), progression et
// contexte enregistrés à chaque étape.
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { getHelpProgress, isModuleEnabled, recordHelpProgress, restartHelpItem } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { TUTORIALS, type TutorialKey } from "@/lib/help/catalog";
import { TUTORIAL_SCRIPTS, type TutorialEnv } from "@/lib/help/tutorials";

type Loaded = { env: TutorialEnv; key: TutorialKey; step: number; completed: boolean };

async function load(rawKey: string): Promise<Loaded> {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) redirect("/login");
  const tutorial = TUTORIALS.find((candidate) => candidate.key === rawKey);
  if (!tutorial) redirect("/aide");
  const organizationId = auth.user.organizationId;
  const { sql, db } = createAppConnection();
  try {
    if (tutorial.module !== "hub" && !(await isModuleEnabled(db, organizationId, tutorial.module))) redirect("/aide");
    const entry = (await getHelpProgress(db, auth.user.id)).find((candidate) => candidate.itemKey === `tutorial:${tutorial.key}`);
    const locale = (await getLocale()) === "en" ? "en" : "fr";
    return {
      env: { organizationId, userId: auth.user.id, locale, context: entry?.context ?? {} },
      key: tutorial.key,
      step: entry?.step ?? 0,
      completed: entry?.status === "completed",
    };
  } finally {
    await sql.end();
  }
}

async function save(loaded: Loaded, step: number, context?: Record<string, string> | null, status: "started" | "completed" = "started") {
  const { sql, db } = createAppConnection();
  try {
    await recordHelpProgress(db, { userId: loaded.env.userId, itemKey: `tutorial:${loaded.key}`, status, step, ...(context === undefined ? {} : { context }) });
  } finally {
    await sql.end();
  }
  revalidatePath(`/aide/tutoriels/${loaded.key}`);
}

export async function restartTutorialAction(key: string): Promise<void> {
  const loaded = await load(key);
  const { sql, db } = createAppConnection();
  try {
    await restartHelpItem(db, loaded.env.userId, `tutorial:${loaded.key}`);
  } finally {
    await sql.end();
  }
  revalidatePath(`/aide/tutoriels/${loaded.key}`);
}

export async function continueTutorialAction(key: string): Promise<void> {
  const loaded = await load(key);
  const step = TUTORIAL_SCRIPTS[loaded.key].steps[loaded.step];
  if (!step || (step.kind !== "explain" && step.kind !== "look")) return;
  await save(loaded, loaded.step + 1);
}

export async function setupTutorialAction(key: string): Promise<void> {
  const loaded = await load(key);
  const script = TUTORIAL_SCRIPTS[loaded.key];
  if (script.steps[loaded.step]?.kind !== "setup") return;
  const context = script.setup ? await script.setup(loaded.env) : {};
  await save(loaded, loaded.step + 1, context);
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
  await script.cleanup(loaded.env, keep && Boolean(script.keepable));
  await save(loaded, loaded.step, null, "completed");
  redirect(`/aide/tutoriels/${loaded.key}?termine=1`);
}
