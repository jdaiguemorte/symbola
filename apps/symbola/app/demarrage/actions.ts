"use server";

// Lot 33b (HUB-09, PAR-01 ; D9, D11) — questionnaire d'accueil : cinq questions, une par écran.
// Chaque réponse s'enregistre et ouvre la question suivante ; « Passer » garde la réponse déjà
// donnée, sinon la valeur proposée (packages/starter-templates, onboarding.json). Le kit de départ
// du métier se charge dès les types d'évènements choisis. Réservé à la Propriétaire.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { parisToday } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import {
  isOnboardingTool,
  isOnboardingVolume,
  onboardingDefaultEventTypes,
  starterEventTypes,
  starterOnboarding,
  type StarterLocale,
  type StarterMetier,
} from "@symbola/starter-templates";
import { addStarterEventTypes, listEventTypes, updateDefaultVendorSlot } from "@/modules/events/service";
import {
  changeVatRegime,
  completeSetup,
  getOrganizationProfile,
  getSetupState,
  saveOnboardingStep,
  saveSetupStep,
  SETUP_STEPS,
  type Metier,
} from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { loadStarterKit } from "@/lib/setup/starter-kit";
import { isValidId } from "@/app/events/module-access";
import { ICON_KEYS } from "@/app/budget-line-icon";

export type SetupFormState = { error?: string; success?: boolean };
export type QuestionFormState = { error?: string };

const METIERS: Metier[] = ["wedding_planner", "event_agency", "autre"];

async function owner() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId || auth.user.role !== "owner") return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

// La question suivante, sans jamais faire reculer la progression (revenir à une question déjà
// répondue puis la valider ne rouvre pas les suivantes).
async function goToNext(organizationId: string, step: number): Promise<never> {
  const db = appDatabase();
  const state = await getSetupState(db, organizationId);
  if (step >= SETUP_STEPS) {
    if (!state.completed) await completeSetup(db, organizationId);
    revalidatePath("/", "layout");
    redirect("/demarrage/pret");
  }
  await saveSetupStep(db, organizationId, Math.max(state.step, step + 1));
  revalidatePath("/demarrage");
  redirect(`/demarrage?etape=${step + 1}`);
}

export async function answerQuestionAction(_prev: QuestionFormState, formData: FormData): Promise<QuestionFormState> {
  const t = await getTranslations("Onboarding");
  const access = await owner();
  if (!access) return { error: t("ownerOnly") };
  const step = Number(text(formData, "step"));
  if (!Number.isInteger(step) || step < 1 || step > SETUP_STEPS) return { error: t("ownerOnly") };
  const skip = text(formData, "intent") === "skip";
  const locale = ((await getLocale()) === "en" ? "en" : "fr") as StarterLocale;
  const defaults = starterOnboarding(locale).defaults;
  const db = appDatabase();
  const profile = await getOrganizationProfile(db, access.organizationId);
  const metier = (profile.metier ?? defaults.metier) as StarterMetier;

  switch (step) {
    case 1: {
      const chosen = (skip ? (profile.metier ?? defaults.metier) : text(formData, "metier")) as Metier;
      if (!METIERS.includes(chosen)) return { error: t("metierRequired") };
      const metierPrecision = chosen === "autre" && !skip ? text(formData, "metierPrecision").slice(0, 120) || null : profile.metierPrecision;
      await saveOnboardingStep(db, access.organizationId, { metier: chosen, metierPrecision });
      break;
    }
    case 2: {
      const installed = await listEventTypes(access.organizationId);
      const starters = starterEventTypes(locale, metier);
      const keys = skip ? (installed.length > 0 ? [] : onboardingDefaultEventTypes(metier)) : formData.getAll("eventTypes").map(String);
      const chosen = starters.filter((type) => keys.includes(type.key));
      if (!skip && chosen.length === 0) return { error: t("eventTypesRequired") };
      if (profile.metier === null) await saveOnboardingStep(db, access.organizationId, { metier });
      // Le métier et les types décident du kit : postes de budget, rétroplanning, programme,
      // sources, catalogue (seulement là où l'organisation n'a encore rien).
      if (chosen.length > 0) await addStarterEventTypes(access.organizationId, chosen);
      await loadStarterKit(access.organizationId, metier, locale);
      break;
    }
    case 3: {
      const regime = skip ? (profile.vatRegime ?? defaults.vatRegime) : text(formData, "vatRegime") === "assujetti" ? "assujetti" : "franchise";
      if (profile.vatRegime !== regime) {
        await changeVatRegime(db, { organizationId: access.organizationId, userId: access.userId, newRegime: regime, effectiveDate: parisToday() });
      }
      break;
    }
    case 4: {
      const volume = skip ? (profile.annualEventVolume ?? defaults.volume) : text(formData, "volume");
      if (!isOnboardingVolume(volume)) return { error: t("volumeRequired") };
      await saveOnboardingStep(db, access.organizationId, { annualEventVolume: volume });
      break;
    }
    case 5: {
      const tools = skip
        ? profile.replacedTools.length > 0
          ? profile.replacedTools
          : defaults.tools
        : [...new Set(formData.getAll("tools").map(String))].filter(isOnboardingTool);
      await saveOnboardingStep(db, access.organizationId, { replacedTools: tools });
      break;
    }
  }
  return goToNext(access.organizationId, step);
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
