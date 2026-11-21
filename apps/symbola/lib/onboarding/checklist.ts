// Lot 33b (PAR-01, étape 6 ; D11) — liste de prise en main de l'accueil. Chaque action se coche
// d'elle-même quand elle est faite ; la liste disparaît une fois finie. Les outils remplacés
// (questionnaire) en règlent l'ordre ; une action d'un module non souscrit n'apparaît pas (ARC-06).
// Lot 63a (HUB-11 ; recette du 21/11/2026) : deux actions seulement, l'essentiel (société, adresse,
// TVA) et un premier prestataire ; le reste est en tutoriels. Orchestration entre modules par
// leurs service.ts (ADR 0011).
import { onboardingChecklistOrder, type OnboardingChecklistKey } from "@symbola/starter-templates";
import { appDatabase } from "@symbola/db/client";
import { countOrganizationRealVendors } from "@/modules/vendors/service";
import { getOrganizationProfile, isModuleEnabled } from "@/modules/hub/service";

export type ChecklistItem = { key: OnboardingChecklistKey; href: string; done: boolean };

const HREFS: Record<OnboardingChecklistKey, string> = {
  essentials: "/parametres",
  first_vendor: "/prestataires/nouveau",
};

// L'ordre, puis ce qui reste à faire ; null quand tout est fait (la liste disparaît).
export function buildChecklist(input: {
  tools: readonly string[];
  available: Record<OnboardingChecklistKey, boolean>;
  done: Record<OnboardingChecklistKey, boolean>;
}): ChecklistItem[] | null {
  const items = onboardingChecklistOrder(input.tools)
    .filter((key) => input.available[key])
    .map((key) => ({ key, href: HREFS[key], done: input.done[key] }));
  return items.length === 0 || items.every((item) => item.done) ? null : items;
}

export async function loadOnboardingChecklist(organizationId: string): Promise<ChecklistItem[] | null> {
  const db = appDatabase();
  const [profile, vendors] = await Promise.all([getOrganizationProfile(db, organizationId), isModuleEnabled(db, organizationId, "vendors")]);
  const vendorCount = vendors ? await countOrganizationRealVendors(organizationId) : 0;
  return buildChecklist({
    tools: profile.replacedTools,
    available: { essentials: true, first_vendor: vendors },
    done: {
      // Ce qu'il faut pour envoyer un devis : SIREN, adresse, régime de TVA.
      essentials: profile.siren !== null && profile.address !== null && profile.vatRegime !== null,
      first_vendor: vendorCount > 0,
    },
  });
}
