// Lot 31a (FAC-07, JUR-09 ; décision D4) — pour les tests : une organisation « prête » a ses
// mentions requises remplies (adresse, SIREN, assurance, médiateur, conditions générales,
// numéro de TVA en assujetti, conditions de paiement) et propose l'acompte sur ses devis.
// Seuls les champs vides sont remplis : un test qui fixe une adresse la garde.
import { appDatabase } from "@symbola/db/client";
import { starterInvoiceMentions } from "@symbola/starter-templates";
import { getOrganizationProfile, saveOnboardingStep } from "@/modules/hub/service";
import { getQuoteSettings, updateQuoteSettings } from "@/modules/quotes/service";

export async function fillRequiredMentions(organizationId: string): Promise<void> {
  const db = appDatabase();
  const profile = await getOrganizationProfile(db, organizationId);
  await saveOnboardingStep(db, organizationId, {
    ...(profile.address ? {} : { address: "12 rue des Tilleuls, 24200 Sarlat" }),
    ...(profile.siren ? {} : { siren: "123456789" }),
    ...(profile.vatRegime === "assujetti" && !profile.vatNumber ? { vatNumber: "FR12123456789" } : {}),
    ...(profile.insurer ? {} : { insurer: "Assurances du Périgord", insurancePolicy: "RCP-2027-001" }),
    ...(profile.mediatorName ? {} : { mediatorName: "Médiateur de la consommation", mediatorUrl: "https://mediateur.example" }),
    ...(profile.generalTerms ? {} : { generalTerms: "Conditions générales de vente de test." }),
  });
  const settings = await getQuoteSettings(organizationId);
  await updateQuoteSettings(organizationId, {
    ...settings,
    invoiceMentions: settings.invoiceMentions ?? starterInvoiceMentions("fr"),
    advanceKindDefault: settings.advanceKindDefault ?? "deposit",
  });
}
