// Lot 13 (AIDE-10) — page Tutoriels, distincte de l'aide : le parcours, jamais bloquant (décision A). Un
// tutoriel dont le module n'est pas souscrit n'apparaît pas.
// Lot 74f (HUB-11 ; spécification du lot 74, § 6.6 ; maquette 28 ; D6, C-10, C-70) : le parcours de la
// personne, choisi d'après sa réponse au démarrage et changeable (« Changer de parcours », fenêtre courte) ;
// ses étapes numérotées, chacune avec ses tutoriels, sa durée et son état en mots (« Fait », « En cours »,
// « Ensuite » sur la seule étape suivante, « À faire ») ; une étape se dit faite quand son geste est fait
// dans l'espace, tutoriel suivi ou non. Un tutoriel en cours se reprend en tête. Tous les tutoriels sont
// rangés : les autres sous « Autres tutoriels ».
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { formatCalendarDate, parisToday, type Locale } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import { getHelpProgress } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { tutorialHref } from "@/lib/help/catalog";
import { loadHelpViewer } from "@/lib/help/help-center";
import { JOURNEY_PATHS, nextGesture, nextTutorial, type JourneyStageView } from "@/lib/help/journey";
import { loadJourney } from "@/lib/help/journey-loader";
import { GESTURE_HREFS } from "@/lib/onboarding/checklist";
import { ScreenHelp } from "@/app/screen-help";
import { FormDialog } from "@/app/ui/form-dialog";
import { chooseJourneyAction } from "@/app/aide/actions";

export default async function TutorialsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("TutorialsPage");
  const tHelp = await getTranslations("Help");
  const tCenter = await getTranslations("HelpCenter");
  const locale = (await getLocale()) as Locale;

  const viewer = await loadHelpViewer(auth.user);
  const [journey, progress] = await Promise.all([loadJourney({ organizationId, userId: auth.user.id, viewer }), getHelpProgress(appDatabase(), auth.user.id)]);
  const path = journey.choice.path;
  const current = journey.current;
  const currentEntry = current ? progress.find((entry) => entry.itemKey === `tutorial:${current}`) : undefined;
  const stageTitle = (stage: JourneyStageView) => t(`stages.${path}.${stage.key}`);
  const stateLabel = (stage: JourneyStageView) =>
    stage.state === "done" && stage.doneAt ? t("states.doneOn", { date: formatCalendarDate(parisToday(stage.doneAt), locale) }) : t(`states.${stage.state}`);

  return (
    <main className="tutorials-page">
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("tutorials.title")} body={tHelp("tutorials.body")} />
      <p>{t("intro")}</p>

      {current ? (
        <section className="card tutorials-current" aria-labelledby="tutorials-current-title">
          <p className="meta" id="tutorials-current-title">
            {t("currentLabel")}
          </p>
          <p>
            <strong>{tCenter(`items.${current}.title`)}</strong>
          </p>
          <p className="meta">{t("inProgress", { step: (currentEntry?.step ?? 0) + 1 })}</p>
          <Link href={tutorialHref(current)} className="button-link button-link-primary">
            {t("resume")}
          </Link>
        </section>
      ) : null}

      <section className="tutorials-journey" aria-labelledby="tutorials-journey-title">
        <div className="tutorials-journey-head">
          <h2 id="tutorials-journey-title">{t("journeyTitle", { path: t(`paths.${path}`) })}</h2>
          <p className="meta">
            {t(`chosenBy.${journey.choice.by}`)}
            {" · "}
            {t("journeyMeta", { done: journey.done, total: journey.total })}
            {journey.remainingMinutes > 0 ? ` · ${t("remaining", { minutes: journey.remainingMinutes })}` : null}
          </p>
          <FormDialog
            triggerLabel={t("change.open")}
            title={t("change.title")}
            intro={t("change.intro")}
            submitLabel={t("change.submit")}
            cancelLabel={t("change.cancel")}
            action={chooseJourneyAction}
          >
            <fieldset className="tutorials-paths">
              <legend className="sr-only">{t("change.title")}</legend>
              {JOURNEY_PATHS.map((candidate) => (
                <label key={candidate} className="tutorials-path-choice">
                  <input type="radio" name="parcours" value={candidate} defaultChecked={candidate === path} />
                  <span>
                    <strong>{t(`change.options.${candidate}.title`)}</strong>
                    <span className="meta">{t(`change.options.${candidate}.body`)}</span>
                  </span>
                </label>
              ))}
            </fieldset>
          </FormDialog>
        </div>

        <ol className="tutorials-stages">
          {journey.stages.map((stage) => {
            const tutorial = nextTutorial(stage);
            const gesture = nextGesture(stage);
            const primary = stage.state === "next" || stage.state === "current";
            return (
              <li key={stage.key} className={`tutorials-stage tutorials-stage-${stage.state}`} aria-labelledby={`stage-${stage.key}`}>
                <span className="tutorials-stage-mark" aria-hidden="true">
                  {stage.state === "done" ? "✓" : stage.number}
                </span>
                <div className="tutorials-stage-body">
                  <h3 id={`stage-${stage.key}`}>
                    <span className="sr-only">{t("stageNumber", { number: stage.number })} </span>
                    {stageTitle(stage)}
                  </h3>
                  <p className="meta">{t(`stageBody.${stage.key}`)}</p>
                  {stage.tutorials.length > 0 ? (
                    <ul className="tutorials-stage-list">
                      {stage.tutorials.map((item) => (
                        <li key={item.key}>
                          <Link href={tutorialHref(item.key)}>{tCenter(`items.${item.key}.title`)}</Link>
                          <span className="meta">
                            {t("minutes", { minutes: item.minutes })}
                            {item.state === "done" ? ` · ${t("states.done")}` : null}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {stage.gestures.length > 0 ? (
                    <ul className="tutorials-stage-gestures">
                      {stage.gestures.map((item) => (
                        <li key={item.key}>
                          {item.done ? (
                            <span>
                              <span aria-hidden="true">✓ </span>
                              {t(`gestures.${item.key}`)}
                              <span className="sr-only"> · {t("states.done")}</span>
                            </span>
                          ) : (
                            <Link href={GESTURE_HREFS[item.key]}>{t(`gestures.${item.key}`)}</Link>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  <p className="tutorials-stage-state">
                    <span className={stage.state === "next" || stage.state === "current" ? "badge badge-bleu" : stage.state === "done" ? "badge badge-sauge" : "badge"}>{stateLabel(stage)}</span>
                    {stage.tutorials.length > 0 ? <span className="meta">{t("stageMeta", { count: stage.tutorials.length, minutes: stage.tutorials.reduce((sum, item) => sum + item.minutes, 0) })}</span> : null}
                  </p>
                  {stage.state !== "done" && (tutorial || gesture) ? (
                    <div className="tutorials-stage-actions">
                      {tutorial ? (
                        <Link href={tutorialHref(tutorial)} className={primary ? "button-link button-link-primary" : "button-link"}>
                          {stage.tutorials.find((item) => item.key === tutorial)?.state === "current"
                            ? t("resume")
                            : t("start", { minutes: stage.tutorials.find((item) => item.key === tutorial)?.minutes ?? 0 })}
                        </Link>
                      ) : null}
                      {gesture && (stage.key === "complete" || stage.key === "takeover" || stage.key === "first_event") ? (
                        <Link href={GESTURE_HREFS[gesture]} className="button-link">
                          {t("doOnMine")}
                        </Link>
                      ) : null}
                    </div>
                  ) : stage.state === "done" && stage.tutorials.length > 0 ? (
                    <Link href={tutorialHref(stage.tutorials[0]!.key)} className="button-link">
                      {t("review")}
                    </Link>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ol>
      </section>

      {journey.others.length > 0 ? (
        <section className="tutorials-others" aria-labelledby="tutorials-others-title">
          <h2 id="tutorials-others-title">{t("others")}</h2>
          <ul className="tutorials-stage-list">
            {journey.others.map((item) => (
              <li key={item.key}>
                <Link href={tutorialHref(item.key)}>{tCenter(`items.${item.key}.title`)}</Link>
                <span className="meta">
                  {t("minutes", { minutes: item.minutes })} · {t(`states.${item.state === "done" ? "done" : item.state === "current" ? "current" : "todo"}`)}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </main>
  );
}
