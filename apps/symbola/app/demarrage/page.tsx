// Lot 33b (HUB-09, D9, D11), refait au lot 74a (HUB-09, PAR-01, UX-04 ; C-68, D6, B1 à B6 ; page 22 des maquettes
// du lot 68) — l'assistant de démarrage, ouvert seul à la première connexion de la titulaire : cinq questions
// au plus, une par écran (métier, types d'évènements, mariages en cours, outils après « Oui », TVA dite avec
// les mots des devis), « Question n sur 5 » (ou « sur 4 » après « Non ») et sa barre, un seul « Continuer ».
// Le volume annuel n'est plus demandé (B2, L74-D5) : il reste dans la fiche de l'entreprise. Réservé à la
// titulaire ; une collègue voit qui prépare l'espace.
import Link from "next/link";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { onboardingDefaultEventTypes, starterEventTypes, starterOnboarding, type StarterLocale, type StarterMetier } from "@symbola/starter-templates";
import { appDatabase } from "@symbola/db/client";
import { listEventTypes } from "@/modules/events/service";
import { getOrganizationProfile, getSetupState, SETUP_STEPS, type OrganizationProfile } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { previousQuestion, questionDisplay, reachableQuestion, type QuestionNumber, type VatAnswer } from "@/lib/onboarding/questionnaire";
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
  const requested = Number.isInteger(asked) && asked >= 1 && asked <= SETUP_STEPS ? asked : null;
  // Terminé : l'écran « Votre espace est prêt », sauf pour revenir sur une réponse (« Modifier mes réponses »).
  if (state.completed && requested === null) redirect("/demarrage/pret");
  const profile = await getOrganizationProfile(db, organizationId);
  const ongoing = profile.hasOngoingEvents;
  // On peut revenir sur une question déjà vue, jamais sauter en avant ; celle des outils jamais après « Non ».
  const step = reachableQuestion(requested, state.completed ? SETUP_STEPS : state.step, ongoing);

  const locale: StarterLocale = (await getLocale()) === "en" ? "en" : "fr";
  const metier = (profile.metier ?? starterOnboarding(locale).defaults.metier) as StarterMetier;
  const question = await questionProps(step);
  const { number, total } = questionDisplay(step, ongoing);
  const previous = previousQuestion(step, ongoing);
  const previousLink = previous ? (
    <Link href={`/demarrage?etape=${previous}`} className="onboarding-previous">
      {t("back")}
    </Link>
  ) : null;

  return (
    <main className="setup onboarding">
      <div className="onboarding-head">
        {previousLink ? <div className="onboarding-previous-top">{previousLink}</div> : null}
        <p className="onboarding-progress" id="onboarding-progress">
          {t("progress", { number, total })}
        </p>
        <progress className="onboarding-bar" max={total} value={number} aria-labelledby="onboarding-progress" />
        <ScreenHelp title={tHelp("setup.title")} body={tHelp("setup.body")} />
      </div>
      <section className="onboarding-question" aria-labelledby="question-title">
        <h1 id="question-title">{t(`questions.${step}.title`, { metier })}</h1>
        <p id="question-hint">{t(`questions.${step}.hint`)}</p>
        <QuestionForm key={step} {...question} previous={previousLink ? `/demarrage?etape=${previous}` : null} />
      </section>
    </main>
  );

  async function questionProps(current: QuestionNumber): Promise<QuestionProps> {
    switch (current) {
      case 1:
        return { step: 1, metier, precision: profile.metierPrecision };
      case 2: {
        const installed = await listEventTypes(organizationId);
        const installedKeys = installed.flatMap((type) => (type.starterKey ? [type.starterKey] : []));
        return {
          step: 2,
          options: starterEventTypes(locale, metier).map(({ key, label }) => ({ key, label })),
          chosen: installed.length > 0 ? installedKeys : onboardingDefaultEventTypes(metier),
        };
      }
      case 3:
        return { step: 3, metier, chosen: ongoing };
      case 4:
        return { step: 4, options: starterOnboarding(locale).tools, chosen: ongoing === "yes" ? profile.replacedTools : [] };
      default:
        return { step: 5, chosen: state.completed ? vatAnswerOf(profile) : null };
    }
  }
}

// La réponse déjà donnée à la question de la TVA, quand elle revient dessus (rien n'est coché la première fois).
function vatAnswerOf(profile: OrganizationProfile): VatAnswer | null {
  if (profile.vatAnswerPending) return "unknown";
  if (profile.vatRegime === "assujetti") return "yes";
  return profile.vatRegime === "franchise" ? "no" : null;
}
