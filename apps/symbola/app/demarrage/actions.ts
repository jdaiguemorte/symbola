"use server";

// Lot 33b (HUB-09, PAR-01 ; D9, D11), refait au lot 74a (HUB-09 ; C-68, D6, M13, B1 à B6 ; page 22 des
// maquettes du lot 68) — l'assistant de démarrage : cinq questions au plus, une par écran, un seul
// « Continuer ». Chaque réponse s'enregistre aussitôt (rien n'est perdu au rechargement, sur un autre appareil
// ni à la fermeture du navigateur) et ouvre la question suivante ; sans réponse, la question le dit dessous.
// Seuls le métier et les types sont proposés d'avance ; un fait (mariages en cours, outils, TVA) ne l'est
// jamais. Réservé à la titulaire : l'organisation et le rôle viennent de la session, jamais du formulaire.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { parisToday } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import {
  isOnboardingTool,
  starterEventTypes,
  starterOnboarding,
  type StarterLocale,
  type StarterMetier,
} from "@symbola/starter-templates";
import { addStarterEventTypes, updateDefaultVendorSlot } from "@/modules/events/service";
import {
  answerOngoingEvents,
  answerOnboardingVat,
  completeSetup,
  getOrganizationProfile,
  getSetupState,
  saveOnboardingStep,
  saveSetupStep,
  SETUP_STEPS,
  type Metier,
} from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { loadStarterKit, loadStarterQuoteTemplates } from "@/lib/setup/starter-kit";
import { isOngoingAnswer, isVatAnswer, nextQuestion, reachableQuestion, vatAnswerEffect } from "@/lib/onboarding/questionnaire";
import { isValidId } from "@/app/events/module-access";
import { ICON_KEYS } from "@/app/budget-line-icon";

export type SetupFormState = { error?: string; success?: boolean };
// fieldError : la question n'a pas de réponse (« Choisissez une réponse », sous la question) ; error : refus.
export type QuestionFormState = { error?: string; fieldError?: string };

const METIERS: Metier[] = ["wedding_planner", "event_agency", "autre"];

async function owner() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId || auth.user.role !== "owner") return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

// La question suivante (celle des outils seulement après « Oui »), sans jamais faire reculer la progression
// enregistrée ; après la dernière, « Votre espace est prêt ».
async function goToNext(organizationId: string, step: number, locale: StarterLocale): Promise<never> {
  const db = appDatabase();
  const [state, profile] = await Promise.all([getSetupState(db, organizationId), getOrganizationProfile(db, organizationId)]);
  const next = nextQuestion(step, profile.hasOngoingEvents);
  if (next === null) {
    // Le régime de TVA est connu : le modèle de devis de départ peut se charger.
    await loadStarterQuoteTemplates(organizationId, locale);
    if (!state.completed) await completeSetup(db, organizationId);
    revalidatePath("/", "layout");
    redirect("/demarrage/pret");
  }
  if (!state.completed) await saveSetupStep(db, organizationId, Math.max(state.step, next));
  revalidatePath("/demarrage");
  redirect(`/demarrage?etape=${next}`);
}

export async function answerQuestionAction(_prev: QuestionFormState, formData: FormData): Promise<QuestionFormState> {
  const t = await getTranslations("Onboarding");
  const access = await owner();
  if (!access) return { error: t("ownerOnly") };
  const db = appDatabase();
  const [state, profile] = await Promise.all([getSetupState(db, access.organizationId), getOrganizationProfile(db, access.organizationId)]);
  const step = Number(text(formData, "step"));
  // Une question pas encore atteinte, ou celle des outils après « Non », se refuse comme une question inconnue.
  const current = state.completed ? SETUP_STEPS : state.step;
  if (!Number.isInteger(step) || step < 1 || step > SETUP_STEPS || reachableQuestion(step, current, profile.hasOngoingEvents) !== step) return { error: t("ownerOnly") };
  const locale = ((await getLocale()) === "en" ? "en" : "fr") as StarterLocale;
  const chooseAnswer = { fieldError: t("chooseAnswer") };

  switch (step) {
    case 1: {
      const chosen = text(formData, "metier") as Metier;
      if (!METIERS.includes(chosen)) return chooseAnswer;
      const metierPrecision = chosen === "autre" ? text(formData, "metierPrecision").slice(0, 120) || null : null;
      await saveOnboardingStep(db, access.organizationId, { metier: chosen, metierPrecision });
      break;
    }
    case 2: {
      const metier = (profile.metier ?? starterOnboarding(locale).defaults.metier) as StarterMetier;
      const keys = formData.getAll("eventTypes").map(String);
      const chosen = starterEventTypes(locale, metier).filter((type) => keys.includes(type.key));
      if (chosen.length === 0) return chooseAnswer;
      if (profile.metier === null) await saveOnboardingStep(db, access.organizationId, { metier });
      // Le métier et les types décident du kit : postes de budget, rétroplanning, programme,
      // sources, catalogue (seulement là où l'organisation n'a encore rien).
      await addStarterEventTypes(access.organizationId, chosen);
      await loadStarterKit(access.organizationId, metier, locale);
      break;
    }
    case 3: {
      const answer = text(formData, "ongoing");
      if (!isOngoingAnswer(answer)) return chooseAnswer;
      await answerOngoingEvents(db, access.organizationId, answer);
      break;
    }
    case 4: {
      const tools = [...new Set(formData.getAll("tools").map(String))].filter(isOnboardingTool);
      if (tools.length === 0) return chooseAnswer;
      await saveOnboardingStep(db, access.organizationId, { replacedTools: tools });
      break;
    }
    case 5: {
      const answer = text(formData, "vat");
      if (!isVatAnswer(answer)) return chooseAnswer;
      await answerOnboardingVat(db, { organizationId: access.organizationId, userId: access.userId, ...vatAnswerEffect(answer), effectiveDate: parisToday() });
      break;
    }
  }
  return goToNext(access.organizationId, step, locale);
}

// Lignes du budget (Paramètres des évènements) : renommer, changer l'icône. Gardée ici depuis le
// lot 12 ; les autres formulaires de l'ancien assistant sont partis avec lui (lot 33b, D9).
export async function updateBudgetLineAction(_prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const t = await getTranslations("Setup");
  const access = await owner();
  if (!access) return { error: t("ownerOnly") };
  const id = text(formData, "id");
  const icon = text(formData, "icon");
  if (!isValidId(id)) return { error: t("notFound") };
  try {
    await updateDefaultVendorSlot(access.organizationId, id, text(formData, "label"), (ICON_KEYS as readonly string[]).includes(icon) ? icon : null);
  } catch (error) {
    if (error instanceof RangeError) return { error: t("labelRequired") };
    throw error;
  }
  revalidatePath("/events/parametres");
  return { success: true };
}
