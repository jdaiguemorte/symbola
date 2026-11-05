"use server";

// Lot 12 (ONB-03) — actions de l'assistant de démarrage. Réservé à la
// titulaire ; chaque étape enregistre puis passe à la suivante.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { parisToday } from "@symbola/i18n";
import { createAppConnection } from "@symbola/db/client";
import type { StarterLocale, StarterMetier } from "@symbola/starter-templates";
import {
  addDefaultVendorSlots,
  addLossReasons,
  addProspectSources,
  removeDefaultVendorSlot,
  updateDefaultVendorSlot,
} from "@/modules/events/service";
import {
  changeVatRegime,
  completeOnboarding,
  completeSetup,
  getOrganizationProfile,
  saveOnboardingStep,
  saveSetupStep,
  type LegalForm,
  type Metier,
} from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { loadStarterKit } from "@/lib/setup/starter-kit";
import { isValidId } from "@/app/events/module-access";
import { ICON_KEYS } from "@/app/budget-line-icon";

export type SetupFormState = { error?: string; success?: boolean };

const METIERS: Metier[] = ["wedding_planner", "event_agency", "autre"];
const LEGAL_FORMS: LegalForm[] = ["ei", "eirl", "eurl", "sarl", "sas", "sasu", "sa", "auto_entrepreneur", "autre"];

async function owner() {
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId || auth.user.role !== "owner") return null;
  return { organizationId: auth.user.organizationId, userId: auth.user.id };
}

async function withDb<T>(fn: (db: ReturnType<typeof createAppConnection>["db"]) => Promise<T>): Promise<T> {
  const { sql, db } = createAppConnection();
  try {
    return await fn(db);
  } finally {
    await sql.end();
  }
}

function goTo(step: number): never {
  revalidatePath("/demarrage");
  redirect(`/demarrage?etape=${step}`);
}

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();

// Étape 1 — métier : charge d'office les paramètres de départ de ce métier.
export async function saveActivityAction(_prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const t = await getTranslations("Setup");
  const access = await owner();
  if (!access) return { error: t("ownerOnly") };
  const metier = text(formData, "metier") as Metier;
  if (!METIERS.includes(metier)) return { error: t("metierRequired") };
  const metierPrecision = text(formData, "metierPrecision") || null;
  await withDb((db) => saveOnboardingStep(db, access.organizationId, { metier, metierPrecision }));
  await loadStarterKit(access.organizationId, metier as StarterMetier, ((await getLocale()) === "en" ? "en" : "fr") as StarterLocale);
  await withDb((db) => saveSetupStep(db, access.organizationId, 2));
  goTo(2);
}

// Étape 2 — entreprise.
export async function saveCompanyAction(_prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const t = await getTranslations("Setup");
  const access = await owner();
  if (!access) return { error: t("ownerOnly") };
  const legalForm = text(formData, "legalForm") as LegalForm;
  if (!LEGAL_FORMS.includes(legalForm)) return { error: t("legalFormRequired") };
  const siren = text(formData, "siren").replace(/\s/g, "") || null;
  if (siren && !/^\d{9}(\d{5})?$/.test(siren)) return { error: t("sirenInvalid") };
  await withDb(async (db) => {
    await saveOnboardingStep(db, access.organizationId, { legalForm, siren, address: text(formData, "address") || null });
    await saveSetupStep(db, access.organizationId, 3);
  });
  goTo(3);
}

// Étape 3 — TVA : le premier régime prend effet aujourd'hui (ONB-02 pour
// les changements suivants, avec leur date d'effet).
export async function saveVatAction(_prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const t = await getTranslations("Setup");
  const access = await owner();
  if (!access) return { error: t("ownerOnly") };
  const regime = text(formData, "vatRegime") === "assujetti" ? "assujetti" : "franchise";
  await withDb(async (db) => {
    const profile = await getOrganizationProfile(db, access.organizationId);
    if (profile.vatRegime !== regime) {
      await changeVatRegime(db, { organizationId: access.organizationId, userId: access.userId, newRegime: regime, effectiveDate: parisToday() });
    }
    await completeOnboarding(db, access.organizationId);
    await saveSetupStep(db, access.organizationId, 4);
  });
  goTo(4);
}

// Étape 4 — lignes du budget : renommer, changer l'icône, retirer, ajouter.
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
  revalidatePath("/demarrage");
  revalidatePath("/events/parametres");
  return { success: true };
}

export async function removeBudgetLineAction(formData: FormData): Promise<void> {
  const access = await owner();
  const id = text(formData, "id");
  if (!access || !isValidId(id)) return;
  await removeDefaultVendorSlot(access.organizationId, id);
  revalidatePath("/demarrage");
}

export async function addBudgetLineAction(_prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const t = await getTranslations("Setup");
  const access = await owner();
  if (!access) return { error: t("ownerOnly") };
  const label = text(formData, "label");
  if (!label) return { error: t("labelRequired") };
  const added = await addDefaultVendorSlots(access.organizationId, [{ label, icon: null }]);
  revalidatePath("/demarrage");
  return added.length > 0 ? { success: true } : { error: t("alreadyExists") };
}

// Étape 5 — sources et motifs : ajout (les existants servent déjà).
export async function addSourceAction(_prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const t = await getTranslations("Setup");
  const access = await owner();
  if (!access) return { error: t("ownerOnly") };
  const label = text(formData, "label");
  if (!label) return { error: t("labelRequired") };
  const added = await addProspectSources(access.organizationId, [label]);
  revalidatePath("/demarrage");
  return added > 0 ? { success: true } : { error: t("alreadyExists") };
}

export async function addLossReasonAction(_prev: SetupFormState, formData: FormData): Promise<SetupFormState> {
  const t = await getTranslations("Setup");
  const access = await owner();
  if (!access) return { error: t("ownerOnly") };
  const label = text(formData, "label");
  if (!label) return { error: t("labelRequired") };
  const added = await addLossReasons(access.organizationId, [{ label, isFreeText: false }]);
  revalidatePath("/demarrage");
  return added > 0 ? { success: true } : { error: t("alreadyExists") };
}

// « Valider et continuer » des étapes de listes (4, 5).
export async function nextStepAction(formData: FormData): Promise<void> {
  const access = await owner();
  if (!access) return;
  const next = Number(text(formData, "next"));
  if (!Number.isInteger(next) || next < 2 || next > 6) return;
  await withDb((db) => saveSetupStep(db, access.organizationId, next));
  goTo(next);
}

// Étape 6 — fin : les menus se déverrouillent.
export async function finishSetupAction(): Promise<void> {
  const access = await owner();
  if (!access) return;
  await withDb((db) => completeSetup(db, access.organizationId));
  revalidatePath("/", "layout");
  redirect("/?demarrage=termine");
}
