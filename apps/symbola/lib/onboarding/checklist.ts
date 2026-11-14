// Lot 33b (PAR-01, étape 6 ; D11) — liste de prise en main de l'accueil : cinq actions (logo,
// premier prestataire, premier devis, invitation du client, import des contacts). Chacune se coche
// d'elle-même quand elle est faite ; la liste disparaît une fois finie. Les outils remplacés
// (questionnaire) en règlent l'ordre ; une action d'un module non souscrit n'apparaît pas (ARC-06).
// Orchestration entre modules par leurs service.ts (ADR 0011).
import { onboardingChecklistOrder, type OnboardingChecklistKey } from "@symbola/starter-templates";
import { appDatabase } from "@symbola/db/client";
import { countOrganizationClientLinks } from "@/modules/events/service";
import { countOrganizationRealQuotes } from "@/modules/quotes/service";
import { countOrganizationRealVendors } from "@/modules/vendors/service";
import { getOrganizationProfile, isModuleEnabled, listImports } from "@/modules/hub/service";

export type ChecklistItem = { key: OnboardingChecklistKey; href: string; done: boolean };

const HREFS: Record<OnboardingChecklistKey, string> = {
  logo: "/parametres#logo",
  first_vendor: "/prestataires/nouveau",
  first_quote: "/devis",
  client_invite: "/events",
  contacts_import: "/import",
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
  const [profile, events, quotes, vendors] = await Promise.all([
    getOrganizationProfile(db, organizationId),
    isModuleEnabled(db, organizationId, "events"),
    isModuleEnabled(db, organizationId, "quotes"),
    isModuleEnabled(db, organizationId, "vendors"),
  ]);
  const [vendorCount, quoteCount, clientLinks, imports] = await Promise.all([
    vendors ? countOrganizationRealVendors(organizationId) : Promise.resolve(0),
    quotes ? countOrganizationRealQuotes(organizationId) : Promise.resolve(0),
    events ? countOrganizationClientLinks(organizationId) : Promise.resolve(0),
    listImports(db, organizationId),
  ]);
  return buildChecklist({
    tools: profile.replacedTools,
    available: { logo: true, first_vendor: vendors, first_quote: quotes, client_invite: events, contacts_import: true },
    done: {
      logo: profile.logoKey !== null,
      first_vendor: vendorCount > 0,
      first_quote: quoteCount > 0,
      client_invite: clientLinks > 0,
      contacts_import: imports.some((entry) => entry.status === "applied"),
    },
  });
}
