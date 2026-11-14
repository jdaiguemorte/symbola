// Lot 33b (HUB-09, PAR-01 ; D9, D11) — questionnaire d'accueil : cinq questions, une par écran
// (métier, types d'évènements, régime de TVA, volume, outils remplacés). Il remplace l'assistant
// du lot 12 : société, SIRET, logo et documents passent dans la prise en main et les Paramètres, et
// les menus ne sont plus verrouillés. Réservé à la Propriétaire ; une Planner voit qui le fait.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { onboardingDefaultEventTypes, starterEventTypes, starterOnboarding, type StarterLocale, type StarterMetier } from "@symbola/starter-templates";
import { appDatabase } from "@symbola/db/client";
import { listEventTypes } from "@/modules/events/service";
import { getOrganizationProfile, getSetupState, SETUP_STEPS } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { QuestionForm, type QuestionProps } from "./question-forms";

export default async function OnboardingPage({ searchParams }: { searchParams: Promise<{ etape?: string }> }) {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Onboarding");
  const tHelp = await getTranslations("Help");
  const db = appDatabase();
  const state = await getSetupState(db, organizationId);

  if (auth.user.role !== "owner") {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("ownerMustFinish")}</p>
      </main>
    );
  }

  const asked = Number((await searchParams).etape);
  const reachable = state.completed ? SETUP_STEPS : state.step;
  // Terminé : l'écran « Votre espace est prêt », sauf pour revenir sur une réponse.
  if (state.completed && !(Number.isInteger(asked) && asked >= 1 && asked <= SETUP_STEPS)) redirect("/demarrage/pret");
  // On peut revenir sur une question déjà vue, jamais sauter en avant.
  const step = Number.isInteger(asked) && asked >= 1 && asked <= reachable ? asked : reachable;

  const locale: StarterLocale = (await getLocale()) === "en" ? "en" : "fr";
  const profile = await getOrganizationProfile(db, organizationId);
  const questionnaire = starterOnboarding(locale);
  const metier = (profile.metier ?? questionnaire.defaults.metier) as StarterMetier;
  const question = await questionProps(step);
  const labels = Array.from({ length: SETUP_STEPS }, (_, index) => t(`steps.${index + 1}`));

  return (
    <main className="setup onboarding">
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("setup.title")} body={tHelp("setup.body")} />
      <p className="muted">{t("intro")}</p>
      <nav aria-label={t("progressLabel")} className="setup-steps">
        <ol>
          {labels.map((label, index) => {
            const number = index + 1;
            const current = number === step;
            const answered = number < reachable || state.completed;
            return (
              <li key={number} aria-current={current ? "step" : undefined} className={current ? "current" : answered ? "done" : ""}>
                {number <= reachable && !current ? (
                  <Link href={`/demarrage?etape=${number}`}>{t("stepItem", { number, label })}</Link>
                ) : (
                  <span>{t("stepItem", { number, label })}</span>
                )}
                {answered && !current ? <span className="sr-only"> {t("stepDone")}</span> : null}
              </li>
            );
          })}
        </ol>
      </nav>

      <section className="card" aria-labelledby="question-title">
        <p className="muted">{t("progress", { number: step, total: SETUP_STEPS })}</p>
        <h2 id="question-title">{t(`questions.${step}.title`)}</h2>
        <p>{t(`questions.${step}.hint`)}</p>
        <QuestionForm key={step} {...question} />
      </section>
      {step > 1 ? (
        <p>
          <Link href={`/demarrage?etape=${step - 1}`}>{t("back")}</Link>
        </p>
      ) : null}
    </main>
  );

  async function questionProps(current: number): Promise<QuestionProps> {
    switch (current) {
      case 1:
        return { step: 1, metier, precision: profile.metierPrecision };
      case 2: {
        const installed = await listEventTypes(organizationId);
        const starters = starterEventTypes(locale, metier);
        const installedKeys = installed.flatMap((type) => (type.starterKey ? [type.starterKey] : []));
        return {
          step: 2,
          options: starters.map(({ key, label }) => ({ key, label })),
          chosen: installed.length > 0 ? installedKeys : onboardingDefaultEventTypes(metier),
        };
      }
      case 3:
        return { step: 3, regime: profile.vatRegime ?? questionnaire.defaults.vatRegime };
      case 4:
        return { step: 4, options: questionnaire.volumes, chosen: profile.annualEventVolume ?? questionnaire.defaults.volume };
      default:
        return { step: 5, options: questionnaire.tools, chosen: profile.replacedTools.length > 0 ? profile.replacedTools : questionnaire.defaults.tools };
    }
  }
}
