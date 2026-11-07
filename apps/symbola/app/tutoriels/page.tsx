// Lot 13 (AIDE-10) — page Tutoriels, distincte de l'aide : le parcours en
// tuiles par étape (décision B), vertes une fois faites, le tutoriel en cours
// mis en avant, le suivant conseillé en pointillés ; jamais bloquant
// (décision A). Un tutoriel dont le module n'est pas souscrit n'apparaît pas.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { getHelpProgress, isModuleEnabled } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { TUTORIALS, tutorialHref, type HelpModule } from "@/lib/help/catalog";
import { JOURNEY, journeyStates, tutorialInProgress } from "@/lib/help/journey";

export default async function TutorialsPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("TutorialsPage");
  const tCenter = await getTranslations("HelpCenter");
  const { sql, db } = createAppConnection();
  let modules: Record<HelpModule, boolean>;
  let progress;
  try {
    const [events, budget, quotes, vendors] = await Promise.all(
      (["events", "budget", "quotes", "vendors"] as const).map((module) => isModuleEnabled(db, organizationId, module)),
    );
    modules = { hub: true, events: events!, budget: budget!, quotes: quotes!, vendors: vendors! };
    progress = await getHelpProgress(db, auth.user.id);
  } finally {
    await sql.end();
  }
  const available = TUTORIALS.filter((tutorial) => modules[tutorial.module]);
  const states = journeyStates(available, progress);
  const done = [...states.values()].filter((state) => state === "done").length;
  const remainingMinutes = available.filter((tutorial) => states.get(tutorial.key) !== "done").reduce((sum, tutorial) => sum + tutorial.minutes, 0);
  const current = tutorialInProgress(available, progress);
  const currentEntry = current ? progress.find((entry) => entry.itemKey === `tutorial:${current}`) : undefined;
  const minutesOf = new Map(available.map((tutorial) => [tutorial.key, tutorial.minutes]));

  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("intro")}</p>

      <section className="card tutorials-progress" aria-labelledby="tutorials-progress-title">
        <div className="section-head">
          <h2 id="tutorials-progress-title">{t("progress", { done, total: available.length })}</h2>
          <span className="meta">{t("remaining", { minutes: remainingMinutes })}</span>
        </div>
        <progress aria-labelledby="tutorials-progress-title" value={done} max={Math.max(available.length, 1)} />
        {current ? (
          <div className="section-head">
            <p>{t("inProgress", { title: tCenter(`items.${current}.title`), step: (currentEntry?.step ?? 0) + 1 })}</p>
            <Link href={tutorialHref(current)} className="button-link button-link-primary">
              {t("resume")}
            </Link>
          </div>
        ) : null}
      </section>

      {JOURNEY.map((stage, index) => {
        const tutorials = stage.tutorials.filter((key) => states.has(key));
        if (tutorials.length === 0) return null;
        const stageDone = tutorials.filter((key) => states.get(key) === "done").length;
        return (
          <section key={stage.key} className="tutorials-stage" aria-labelledby={`stage-${stage.key}`}>
            <div className="tutorials-stage-head">
              {stage.key !== "other" ? <span className="meta">{t("stageNumber", { number: index + 1 })}</span> : null}
              <h2 id={`stage-${stage.key}`}>{t(`stages.${stage.key}`)}</h2>
              <span className={stageDone === tutorials.length ? "badge badge-sauge" : "badge"}>{t("stageCount", { done: stageDone, total: tutorials.length })}</span>
            </div>
            <ul className="tutorial-tiles">
              {tutorials.map((key) => {
                const state = states.get(key)!;
                return (
                  <li key={key}>
                    <Link href={tutorialHref(key)} className={`tutorial-tile tutorial-tile-${state}`}>
                      {state === "done" ? (
                        <span className="tutorial-tile-check" aria-hidden="true">
                          ✓
                        </span>
                      ) : null}
                      <strong>{tCenter(`items.${key}.title`)}</strong>
                      <span className="meta">{t("minutes", { minutes: minutesOf.get(key) ?? 0 })}</span>
                      <span className={state === "done" ? "badge badge-sauge" : state === "current" ? "badge badge-terracotta" : state === "next" ? "badge badge-bleu" : "badge"}>
                        {t(`states.${state}`)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </main>
  );
}
