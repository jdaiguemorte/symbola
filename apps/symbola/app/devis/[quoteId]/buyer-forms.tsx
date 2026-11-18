"use client";

// Lot 41 (JUR-02, JUR-13 ; D6, D8) — acheteur entreprise (contact « entreprise » parmi les clients de
// l'évènement), numéro de bon de commande, référence de l'acheteur, adresse de livraison si elle
// diffère. Le lieu de réception est proposé, jamais imposé.
import { useRef } from "react";
import { useTranslations } from "next-intl";
import type { QuoteBuyerDetails } from "@/modules/quotes/service";
import { QuoteActionForm } from "./quote-forms";
import { setBuyerDetailsAction } from "./buyer-actions";

export type BuyerChoice = { id: string; name: string };

export function BuyerDetailsForm({
  quoteId,
  buyer,
  companies,
  professional,
  venue,
}: {
  quoteId: string;
  buyer: QuoteBuyerDetails;
  companies: BuyerChoice[];
  professional: boolean;
  venue: { name: string | null; city: string | null };
}) {
  const t = useTranslations("Quotes");
  const line = useRef<HTMLInputElement>(null);
  const city = useRef<HTMLInputElement>(null);
  const delivery = buyer.deliveryAddress;
  const suggestVenue = () => {
    if (line.current && venue.name) line.current.value = venue.name;
    if (city.current && venue.city) city.current.value = venue.city;
    line.current?.focus();
  };
  return (
    <QuoteActionForm action={setBuyerDetailsAction} quoteId={quoteId} label={t("buyerTitle")} submitLabel={t("saveBuyer")} successMessage={t("buyerSaved")}>
      {professional ? (
        <>
          <label htmlFor="buyer-contact">{t("buyerCompany")}</label>
          <select id="buyer-contact" name="buyerContactId" defaultValue={buyer.buyerContactId ?? ""} aria-describedby="buyer-contact-hint">
            <option value="">{t("buyerCompanyNone")}</option>
            {companies.map((company) => (
              <option key={company.id} value={company.id}>
                {company.name}
              </option>
            ))}
          </select>
          <p id="buyer-contact-hint" className="meta">
            {t("buyerCompanyHint")}
          </p>
        </>
      ) : null}
      <label htmlFor="order-reference">{t("orderReference")}</label>
      <input id="order-reference" type="text" name="orderReference" maxLength={60} defaultValue={buyer.orderReference ?? ""} aria-describedby="order-reference-hint" />
      <p id="order-reference-hint" className="meta">
        {t("orderReferenceHint")}
      </p>
      <label htmlFor="buyer-reference">{t("buyerReference")}</label>
      <input id="buyer-reference" type="text" name="buyerReference" maxLength={60} defaultValue={buyer.buyerReference ?? ""} />
      <fieldset>
        <legend>{t("deliveryAddress")}</legend>
        <p className="meta">{t("deliveryAddressHint")}</p>
        <label htmlFor="delivery-line">{t("deliveryLine")}</label>
        <input id="delivery-line" ref={line} type="text" name="deliveryLine" maxLength={300} defaultValue={delivery?.line ?? ""} autoComplete="off" />
        <label htmlFor="delivery-postal-code">{t("deliveryPostalCode")}</label>
        <input id="delivery-postal-code" type="text" name="deliveryPostalCode" maxLength={16} defaultValue={delivery?.postalCode ?? ""} autoComplete="off" />
        <label htmlFor="delivery-city">{t("deliveryCity")}</label>
        <input id="delivery-city" ref={city} type="text" name="deliveryCity" maxLength={120} defaultValue={delivery?.city ?? ""} autoComplete="off" />
        <label htmlFor="delivery-country">{t("deliveryCountry")}</label>
        <input id="delivery-country" type="text" name="deliveryCountry" maxLength={2} defaultValue={delivery?.countryCode ?? "FR"} autoComplete="off" aria-describedby="delivery-country-hint" />
        <p id="delivery-country-hint" className="meta">
          {t("deliveryCountryHint")}
        </p>
        {venue.name ? (
          <button type="button" className="button-secondary" onClick={suggestVenue}>
            {t("deliveryUseVenue", { venue: venue.name })}
          </button>
        ) : null}
      </fieldset>
    </QuoteActionForm>
  );
}
