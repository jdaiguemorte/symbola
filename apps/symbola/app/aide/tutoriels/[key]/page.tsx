// Lot 10 (AIDE-06) — un tutoriel « en faisant » : étapes à gauche, étape en
// cours à droite. L'exemple est fictif (marqué démo, supprimé à la fin ou au
// bout de 24 h) ; l'utilisateur agit dans les vrais écrans.
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { starterTutorialCatalogItem } from "@symbola/starter-templates";
import { formatAmount, type Locale } from "@symbola/i18n";
import { createAppConnection } from "@symbola/db/client";
import { getHelpProgress, isModuleEnabled } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { TUTORIALS } from "@/lib/help/catalog";
import { TUTORIAL_SCRIPTS } from "@/lib/help/tutorials";
import { CheckForm } from "./check-form";
import { abandonTutorialAction, continueTutorialAction, finishTutorialAction, restartTutorialAction, setupTutorialAction } from "./actions";
import { isInProgress, tutorialInProgress } from "@/lib/help/journey";

export default async function TutorialPage({ params, searchParams }: { params: Promise<{ key: string }>; searchParams: Promise<{ termine?: string }> }) {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");
  const { key } = await params;
  const tutorial = TUTORIALS.find((candidate) => candidate.key === key);
  if (!tutorial) notFound();

  const t = await getTranslations("Tutorials");
  const tCenter = await getTranslations("HelpCenter");
  const locale = (await getLocale()) as Locale;
  const { sql, db } = createAppConnection();
  let available = true;
  let entry;
  let progress;
  try {
    if (tutorial.module !== "hub") available = await isModuleEnabled(db, auth.user.organizationId, tutorial.module);
    progress = await getHelpProgress(db, auth.user.id);
    entry = progress.find((candidate) => candidate.itemKey === `tutorial:${tutorial.key}`);
  } finally {
    await sql.end();
  }
  const title = tCenter(`items.${tutorial.key}.title`);
  if (!available) {
    return (
      <main>
        <h1>{title}</h1>
        <p>{t("unavailable")}</p>
      </main>
    );
  }

  // Lot 13 (AIDE-10) : un autre tutoriel est en cours ? On le dit, et on
  // laisse choisir : le terminer d'abord, ou l'abandonner pour celui-ci.
  const other = tutorialInProgress(TUTORIALS, progress);
  if (other && other !== tutorial.key && !isInProgress(entry) && entry?.status !== "completed") {
    const tPage = await getTranslations("TutorialsPage");
    const otherEntry = progress.find((candidate) => candidate.itemKey === `tutorial:${other}`);
    return (
      <main>
        <section className="card tutorial-conflict" role="alertdialog" aria-labelledby="tutorial-conflict-title" aria-describedby="tutorial-conflict-body">
          <h1 id="tutorial-conflict-title">{tPage("conflictTitle")}</h1>
          <p id="tutorial-conflict-body">{tPage("conflictBody", { title: tCenter(`items.${other}.title`), step: (otherEntry?.step ?? 0) + 1, next: title })}</p>
          <div className="tutorial-actions">
            <Link href={`/aide/tutoriels/${other}`} className="button-link button-link-primary">
              {tPage("conflictFinish")}
            </Link>
            <form action={abandonTutorialAction.bind(null, other, tutorial.key)}>
              <button type="submit" className="button-secondary">
                {tPage("conflictAbandon")}
              </button>
            </form>
          </div>
        </section>
      </main>
    );
  }

  const script = TUTORIAL_SCRIPTS[tutorial.key];
  const texts = t.raw(`${tutorial.key}.steps`) as { title: string; body: string }[];
  const completed = entry?.status === "completed";
  const justFinished = (await searchParams).termine === "1";
  const index = Math.min(entry?.step ?? 0, script.steps.length - 1);
  const step = script.steps[index]!;
  const text = texts[index]!;
  const context = entry?.context ?? {};
  const href = step.href && (step.kind === "do" || step.kind === "look") ? step.href(context) : null;
  const suggestion = tutorial.key === "catalog" ? starterTutorialCatalogItem(locale === "en" ? "en" : "fr") : null;
  // Terminé : écran « bravo », sauf si l'utilisateur le revoit (étape revenue à 0
  // ou exemple recréé).
  const showStep = !completed || (entry?.step ?? 0) < script.steps.length - 1 || Boolean(entry?.context);

  return (
    <main>
      <div className="tutorial-layout">
        <aside className="card tutorial-steps" aria-labelledby="tutorial-steps-title">
          <p className="badge badge-terracotta">{t("badge", { minutes: tutorial.minutes })}</p>
          <h1 id="tutorial-steps-title">{title}</h1>
          <ol>
            {texts.map((item, position) => {
              const state = completed && !showStep ? "done" : position < index ? "done" : position === index ? "current" : "todo";
              return (
                <li key={item.title} data-state={state} aria-current={state === "current" ? "step" : undefined}>
                  <span className="tutorial-step-mark" aria-hidden="true">
                    {state === "done" ? "✓" : position + 1}
                  </span>
                  <span>{item.title}</span>
                </li>
              );
            })}
          </ol>
          <p className="tutorial-note">{t("exampleNote")}</p>
          <Link href="/tutoriels">{t("backToTutorials")}</Link>
        </aside>

        <section className="card tutorial-step" aria-labelledby="tutorial-step-title">
          {completed && !showStep ? (
            <>
              <h2 id="tutorial-step-title">{justFinished ? t("doneTitle") : t("alreadyDoneTitle")}</h2>
              <p role="status">{justFinished ? t("doneBody") : t("alreadyDoneBody")}</p>
              <form action={restartTutorialAction.bind(null, tutorial.key)}>
                <button type="submit">{t("restart")}</button>
              </form>
            </>
          ) : (
            <>
              <p className="tutorial-progress">{t("stepOf", { step: index + 1, total: script.steps.length })}</p>
              <h2 id="tutorial-step-title">{text.title}</h2>
              <p>{text.body}</p>
              {suggestion && step.kind === "do" ? (
                <p className="tutorial-suggestion">
                  {t("catalogSuggestion", { label: suggestion.label, unit: suggestion.unit, price: formatAmount(suggestion.unitPriceCents, locale) })}
                </p>
              ) : null}
              {step.kind === "explain" || step.kind === "look" ? (
                <div className="tutorial-actions">
                  {href ? (
                    <Link href={href} className="button-link">
                      {t("openScreen")}
                    </Link>
                  ) : null}
                  <form action={continueTutorialAction.bind(null, tutorial.key)}>
                    <button type="submit">{t("continue")}</button>
                  </form>
                </div>
              ) : null}
              {step.kind === "setup" ? (
                <form action={setupTutorialAction.bind(null, tutorial.key)}>
                  <button type="submit">{t("createExample")}</button>
                </form>
              ) : null}
              {step.kind === "do" ? (
                <div className="tutorial-actions">
                  {href ? (
                    <Link href={href} className="button-link button-link-primary">
                      {t("openExample")}
                    </Link>
                  ) : null}
                  <CheckForm tutorialKey={tutorial.key} label={t("check")} hint={t("checkHint")} />
                </div>
              ) : null}
              {step.kind === "finish" ? (
                <div className="tutorial-actions">
                  {script.keepable ? (
                    <form action={finishTutorialAction.bind(null, tutorial.key, true)}>
                      <button type="submit" className="button-secondary">
                        {t(`${tutorial.key}.keep`)}
                      </button>
                    </form>
                  ) : null}
                  <form action={finishTutorialAction.bind(null, tutorial.key, false)}>
                    <button type="submit">{script.keepable ? t(`${tutorial.key}.drop`) : t("finishAndDelete")}</button>
                  </form>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </main>
  );
}
