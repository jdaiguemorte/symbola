// Lot 63f (HUB-09, HUB-18, HUB-23, UX-04 ; ADR 0103) — assistant « L'essentiel » : six étapes,
// une question par écran (société et SIRET, adresse et contact, logo, TVA, banque, numérotation).
// Il écrit dans les réglages existants ; l'étape atteinte est gardée dans la progression de l'aide
// (clé « essentials »). Raison sociale, adresse, SIRET et régime de TVA sont obligatoires pour
// envoyer un devis, jamais pour entrer dans l'app (SC-01). Sans le module Devis, ni banque ni
// numérotation (ARC-06). Orchestration entre modules par leurs service.ts (ADR 0011).
import { appDatabase } from "@symbola/db/client";
import { getHelpProgress, getOrganizationProfile, getSellerDetails, isModuleEnabled } from "@/modules/hub/service";
import { getDocumentSettings } from "@/modules/quotes/service";

export const ESSENTIALS_PROGRESS_KEY = "setup:essentials";
export const ESSENTIALS_HREF = "/demarrage/essentiel";

export type EssentialStep = "company" | "address" | "logo" | "vat" | "bank" | "numbering";
export type QuoteRequirement = "organizationName" | "address" | "siret" | "vatRegime";

export type EssentialsSnapshot = {
  organizationName: string;
  siret: string | null;
  address: string | null;
  postalCode: string | null;
  city: string | null;
  logoKey: string | null;
  vatRegime: "franchise" | "assujetti" | null;
  iban: string | null;
  quotesEnabled: boolean;
  // Dernière étape franchie (0 : aucune) ; l'assistant fini une fois.
  reached: number;
  finished: boolean;
};

const ALL_STEPS: EssentialStep[] = ["company", "address", "logo", "vat", "bank", "numbering"];

export function essentialSteps(quotesEnabled: boolean): EssentialStep[] {
  return quotesEnabled ? ALL_STEPS : ALL_STEPS.filter((step) => step !== "bank" && step !== "numbering");
}

const present = (value: string | null | undefined) => (value ?? "").trim() !== "";

// Dans l'ordre des étapes : ce qui manque pour envoyer un devis.
export function missingForQuote(snapshot: EssentialsSnapshot): QuoteRequirement[] {
  const missing: QuoteRequirement[] = [];
  if (!present(snapshot.organizationName)) missing.push("organizationName");
  if (!present(snapshot.address) || !present(snapshot.postalCode) || !present(snapshot.city)) missing.push("address");
  if (!present(snapshot.siret)) missing.push("siret");
  if (!snapshot.vatRegime) missing.push("vatRegime");
  return missing;
}

// Une étape obligatoire est faite quand ses champs le sont ; une étape facultative quand elle a été
// remplie ou franchie (passée).
export function stepDone(step: EssentialStep, snapshot: EssentialsSnapshot): boolean {
  const passed = snapshot.reached >= ALL_STEPS.indexOf(step) + 1;
  switch (step) {
    case "company":
      return present(snapshot.organizationName) && present(snapshot.siret);
    case "address":
      return !missingForQuote(snapshot).includes("address");
    case "logo":
      return present(snapshot.logoKey) || passed;
    case "vat":
      return snapshot.vatRegime !== null;
    case "bank":
      return present(snapshot.iban) || passed;
    case "numbering":
      return passed;
  }
}

// Numéro (à partir de 1) de la première étape à faire ; la première quand tout est fait.
export function nextEssentialStep(snapshot: EssentialsSnapshot): number {
  const index = essentialSteps(snapshot.quotesEnabled).findIndex((step) => !stepDone(step, snapshot));
  return index === -1 ? 1 : index + 1;
}

// « Régler l'essentiel » est fait quand rien ne manque pour envoyer un devis, que ce soit par
// l'assistant ou par les Paramètres.
export function essentialsDone(snapshot: EssentialsSnapshot): boolean {
  return missingForQuote(snapshot).length === 0;
}

export async function loadEssentials(organizationId: string, userId: string): Promise<EssentialsSnapshot> {
  const db = appDatabase();
  const [details, profile, quotesEnabled, progress] = await Promise.all([
    getSellerDetails(db, organizationId),
    getOrganizationProfile(db, organizationId),
    isModuleEnabled(db, organizationId, "quotes"),
    getHelpProgress(db, userId),
  ]);
  const documents = quotesEnabled ? await getDocumentSettings(organizationId) : null;
  const entry = progress.find((candidate) => candidate.itemKey === ESSENTIALS_PROGRESS_KEY);
  return {
    organizationName: details.organizationName,
    siret: details.siret,
    address: details.address,
    postalCode: details.postalCode,
    city: details.city,
    logoKey: details.logoKey,
    // Lot 74a (L74-D4) : « Je ne sais pas encore » à l'assistant vaut une TVA encore à dire.
    vatRegime: profile.vatAnswerPending ? null : profile.vatRegime,
    iban: documents?.iban ?? null,
    quotesEnabled,
    reached: entry?.step ?? 0,
    finished: entry?.status === "completed",
  };
}
