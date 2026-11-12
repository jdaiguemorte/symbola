// Lot 27a (SC-06 étape 5, décision D6) — moyens de paiement qu'un client peut
// déclarer : ceux de l'organisation (module devis), sinon ceux de départ
// (`payment-methods.json`). Aucune liste en dur (CLAUDE.md § 2.6).
import { getLocale } from "next-intl/server";
import { starterPaymentMethods } from "@symbola/starter-templates";
import { listPaymentMethods } from "@/modules/quotes/service";
import { isQuotesModuleEnabled } from "@/app/devis/module-access";

export async function declarablePaymentMethods(organizationId: string): Promise<string[]> {
  if (await isQuotesModuleEnabled(organizationId)) {
    const methods = (await listPaymentMethods(organizationId)).map((method) => method.label);
    if (methods.length > 0) return methods;
  }
  return starterPaymentMethods((await getLocale()) === "en" ? "en" : "fr");
}
