"use server";

// Lot 41 (JUR-02, JUR-13 ; D6, D8) — acheteur entreprise, références d'achat et adresse de livraison du
// devis, modifiables jusqu'à chaque émission (même après la signature). Session, organisation et
// rôle vérifiés côté serveur ; un acheteur hors de l'organisation est refusé comme inconnu.
import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { InvalidPostalAddressError, InvalidReferenceError, QuoteBuyerNotFoundError, QuoteNotFoundError, setQuoteBuyerDetails } from "@/modules/quotes/service";
import { isValidId } from "../module-access";
import { authorizedPlanner } from "../planner-access";
import type { QuoteFormState } from "./actions";

const text = (formData: FormData, name: string) => String(formData.get(name) ?? "");

export async function setBuyerDetailsAction(_prev: QuoteFormState, formData: FormData): Promise<QuoteFormState> {
  const t = await getTranslations("Quotes");
  const planner = await authorizedPlanner();
  if (!planner) return { error: t("unauthenticated") };
  const quoteId = text(formData, "quoteId");
  if (!isValidId(quoteId)) return { error: t("quoteNotFound") };
  const buyerContactId = text(formData, "buyerContactId");
  try {
    await setQuoteBuyerDetails(planner.organizationId, quoteId, {
      buyerContactId: isValidId(buyerContactId) ? buyerContactId : null,
      orderReference: text(formData, "orderReference"),
      buyerReference: text(formData, "buyerReference"),
      deliveryAddress: {
        line: text(formData, "deliveryLine"),
        postalCode: text(formData, "deliveryPostalCode"),
        city: text(formData, "deliveryCity"),
        countryCode: text(formData, "deliveryCountry"),
      },
    });
  } catch (error) {
    if (error instanceof QuoteNotFoundError) return { error: t("quoteNotFound") };
    if (error instanceof QuoteBuyerNotFoundError) return { error: t("buyerNotFound") };
    if (error instanceof InvalidReferenceError) return { error: t("invalidReference") };
    if (error instanceof InvalidPostalAddressError) return { error: t("invalidDeliveryAddress") };
    throw error;
  }
  revalidatePath(`/devis/${quoteId}`);
  return { success: true };
}
