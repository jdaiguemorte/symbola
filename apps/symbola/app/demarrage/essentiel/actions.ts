"use server";

// Lot 63f (HUB-09, HUB-18, HUB-23 ; ADR 0103) — assistant « L'essentiel » : chaque étape écrit dans
// les réglages existants (fiche de l'organisation, TVA datée, IBAN et préfixes du module Devis) par
// les service.ts. « Continuer » enregistre puis ouvre l'étape suivante ; « Passer » n'écrit rien ;
// « Finir plus tard » enregistre puis ramène à l'accueil. Rien n'est obligatoire pour avancer :
// seule une valeur mal formée est refusée, et l'erreur nomme le champ. Contrôles côté serveur.
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { parisToday } from "@symbola/i18n";
import { appDatabase } from "@symbola/db/client";
import {
  answerPendingVat,
  completeOnboarding,
  getOrganizationProfile,
  InvalidDocumentDetailsError,
  InvalidOrganizationNameError,
  InvalidSellerAddressError,
  isModuleEnabled,
  recordHelpProgress,
  saveCompanyEssentials,
  type LegalForm,
} from "@/modules/hub/service";
import { getDocumentSettings, getQuoteSettings, InvalidDocumentSettingsError, updateDocumentSettings, updateQuoteSettings } from "@/modules/quotes/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { ESSENTIALS_HREF, ESSENTIALS_PROGRESS_KEY, essentialSteps, loadEssentials, type EssentialStep } from "@/lib/onboarding/essentials";

// values : la saisie, rendue au formulaire quand l'étape est refusée (rien n'est perdu).
export type EssentialsFormState = { error?: string; field?: string; values?: Record<string, string> };

const LEGAL_FORMS: readonly LegalForm[] = ["ei", "eirl", "eurl", "sarl", "sas", "sasu", "sa", "auto_entrepreneur", "autre"];
const DETAIL_ERRORS = { siret: "errorSiret", contactEmail: "errorContactEmail", contactPhone: "errorContactPhone", vatNumber: "errorVatNumber" } as const;

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "").trim();
const optional = (formData: FormData, name: string) => text(formData, name) || null;

async function saveStep(step: EssentialStep, formData: FormData, organizationId: string, userId: string): Promise<void> {
  const db = appDatabase();
  switch (step) {
    case "company": {
      const legalForm = text(formData, "legalForm");
      await saveCompanyEssentials(db, organizationId, {
        organizationName: text(formData, "organizationName"),
        legalForm: (LEGAL_FORMS as readonly string[]).includes(legalForm) ? (legalForm as LegalForm) : null,
        siret: optional(formData, "siret"),
      });
      break;
    }
    case "address": {
      const profile = await getOrganizationProfile(db, organizationId);
      await saveCompanyEssentials(db, organizationId, {
        address: { address: text(formData, "address"), postalCode: text(formData, "postalCode"), city: text(formData, "city"), countryCode: profile.countryCode },
        contactEmail: optional(formData, "contactEmail"),
        contactPhone: optional(formData, "contactPhone"),
      });
      break;
    }
    case "logo":
      // Le logo s'envoie par sa route (/logo, contrôle du type et antivirus) ; l'étape ne fait que passer.
      break;
    case "vat": {
      const profile = await getOrganizationProfile(db, organizationId);
      const chosen = text(formData, "vatRegime");
      const regime = chosen === "assujetti" || chosen === "franchise" ? chosen : null;
      await saveCompanyEssentials(db, organizationId, { vatNumber: optional(formData, "vatNumber") });
      // Lot 74a (L74-D4) : une réponse donnée ici fait aussi tomber « Je ne sais pas encore ».
      if (regime && (regime !== profile.vatRegime || profile.vatAnswerPending)) await answerPendingVat(db, { organizationId, userId, regime, effectiveDate: parisToday() });
      break;
    }
    case "bank": {
      const settings = await getDocumentSettings(organizationId);
      await updateDocumentSettings(organizationId, { ...settings, iban: optional(formData, "iban"), bic: optional(formData, "bic") });
      break;
    }
    case "numbering": {
      const settings = await getQuoteSettings(organizationId);
      const prefix = (name: string, current: string) => text(formData, name).toUpperCase() || current;
      await updateQuoteSettings(organizationId, { ...settings, quotePrefix: prefix("quotePrefix", settings.quotePrefix), invoicePrefix: prefix("invoicePrefix", settings.invoicePrefix) });
      break;
    }
  }
  // ONB-01 : la fiche se dit complète dès que ses champs requis sont réunis.
  await completeOnboarding(db, organizationId);
}

async function errorOf(error: unknown): Promise<{ error: string; field: string } | null> {
  const t = await getTranslations("Essentials");
  const tSettings = await getTranslations("Settings");
  const tDocuments = await getTranslations("Documents");
  if (error instanceof InvalidOrganizationNameError) return { error: t("errorOrganizationName"), field: "organizationName" };
  if (error instanceof InvalidSellerAddressError) return { error: tSettings(`invalidAddress_${error.field}`), field: error.field };
  if (error instanceof InvalidDocumentDetailsError && error.field in DETAIL_ERRORS) {
    return { error: tSettings(DETAIL_ERRORS[error.field as keyof typeof DETAIL_ERRORS]), field: error.field };
  }
  if (error instanceof InvalidDocumentSettingsError && (error.field === "iban" || error.field === "bic")) {
    return { error: tDocuments(error.field === "iban" ? "errorIban" : "errorBic"), field: error.field };
  }
  // Préfixe refusé par le module Devis.
  if (error instanceof RangeError) return { error: t("errorPrefix"), field: "quotePrefix" };
  return null;
}

export async function saveEssentialStepAction(_previous: EssentialsFormState, formData: FormData): Promise<EssentialsFormState> {
  const t = await getTranslations("Essentials");
  const auth = await getPlannerAuthContext();
  if (auth.status !== "authenticated" || !auth.user.organizationId) return { error: t("unauthenticated") };
  const { organizationId } = auth.user;
  const userId = auth.user.id;
  const db = appDatabase();
  const steps = essentialSteps(await isModuleEnabled(db, organizationId, "quotes"));
  const step = steps.find((candidate) => candidate === text(formData, "step"));
  if (!step) return { error: t("unauthenticated") };
  const intent = text(formData, "intent");
  const values = Object.fromEntries([...formData.entries()].filter((entry): entry is [string, string] => typeof entry[1] === "string" && !entry[0].startsWith("$")));

  if (intent !== "skip") {
    try {
      await saveStep(step, formData, organizationId, userId);
    } catch (error) {
      const known = await errorOf(error);
      if (known) return { ...known, values };
      throw error;
    }
  }

  // L'étape franchie (enregistrée ou passée), jamais en arrière.
  const number = steps.indexOf(step) + 1;
  const last = number === steps.length;
  const snapshot = await loadEssentials(organizationId, userId);
  const reached = Math.max(snapshot.reached, intent === "later" ? 0 : number);
  await recordHelpProgress(db, { userId, itemKey: ESSENTIALS_PROGRESS_KEY, status: snapshot.finished || (last && intent !== "later") ? "completed" : "started", step: reached });

  revalidatePath("/", "layout");
  if (intent === "later" || last) redirect("/");
  redirect(`${ESSENTIALS_HREF}?etape=${number + 1}`);
}
