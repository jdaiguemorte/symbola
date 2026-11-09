// Lot 17 (DEV-09) — ce que les documents d'exemple reprennent de
// l'organisation : préfixes des séries, validité, délai de paiement, régime
// de TVA. Côté serveur ; le résultat est sérialisable vers l'aperçu.
import { appDatabase } from "@symbola/db/client";
import { computeLegalMention, getOrganizationProfile } from "@/modules/hub/service";
import { formatDocumentNumber, getQuoteSettings } from "@/modules/quotes/service";
import { parisTodayString } from "../../quote-display";
import type { SampleContext } from "./sample";

export async function sampleContextFor(organizationId: string): Promise<SampleContext> {
  const [settings, profile] = await Promise.all([getQuoteSettings(organizationId), getOrganizationProfile(appDatabase(), organizationId)]);
  const today = parisTodayString();
  const year = Number(today.slice(0, 4));
  const vat = profile.vatRegime === "assujetti" && profile.vatRateDefaultBasisPoints !== null;
  return {
    today,
    quoteNumber: formatDocumentNumber(settings.quotePrefix, year, 1),
    depositNumber: formatDocumentNumber(settings.invoicePrefix, year, 1),
    invoiceNumber: formatDocumentNumber(settings.invoicePrefix, year, 2),
    validityDays: settings.validityDays,
    paymentTermDays: settings.invoicePaymentTermDays,
    vatRateBasisPoints: vat ? profile.vatRateDefaultBasisPoints : null,
    legalMention: computeLegalMention(profile) || null,
  };
}
