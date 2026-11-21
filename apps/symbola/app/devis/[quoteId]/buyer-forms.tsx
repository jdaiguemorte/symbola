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
      {/* Lot 62d (UX-12) : formulaire en grille — l'entreprise sur toute la ligne, les deux références
          côte à côte, l'adresse de livraison sur une ligne (code postal et pays en champs courts). */}
      <div className="form-grid">
        {professional ? (
          <div className="span-all quote-field">
            <label htmlFor="buyer-contact">{t("buyerCompany")}</label>
            <select id="buyer-contact" name="buyerContactId" defaultValue={buyer.buyerContactId ?? ""} aria-describedby="buyer-contact-hint">
              <option value="">{t("buyerCompanyNone")}</option>
              {companies.map((company) => (
                <option key={company.id} value={company.id}>
                  {company.name}
                </option>
              ))}
            </select>
            <p id="buyer-contact-hint" className="field-hint">
              {t("buyerCompanyHint")}
            </p>
          </div>
        ) : null}
        <div className="quote-field">
          <label htmlFor="order-reference">{t("orderReference")}</label>
          <input id="order-reference" type="text" name="orderReference" maxLength={60} defaultValue={buyer.orderReference ?? ""} aria-describedby="order-reference-hint" />
          <p id="order-reference-hint" className="field-hint">
            {t("orderReferenceHint")}
          </p>
        </div>
        <div className="quote-field">
          <label htmlFor="buyer-reference">{t("buyerReference")}</label>
          <input id="buyer-reference" type="text" name="buyerReference" maxLength={60} defaultValue={buyer.buyerReference ?? ""} />
        </div>
        <fieldset className="span-all">
          <legend>{t("deliveryAddress")}</legend>
          <p className="field-hint">{t("deliveryAddressHint")}</p>
          <div className="field-row">
            <label htmlFor="delivery-line">
              {t("deliveryLine")}
              <input id="delivery-line" ref={line} type="text" name="deliveryLine" maxLength={300} defaultValue={delivery?.line ?? ""} autoComplete="off" />
            </label>
            <label htmlFor="delivery-postal-code" className="field-fit">
              {t("deliveryPostalCode")}
              <input id="delivery-postal-code" type="text" name="deliveryPostalCode" maxLength={16} defaultValue={delivery?.postalCode ?? ""} autoComplete="off" className="field-code" />
            </label>
            <label htmlFor="delivery-city">
              {t("deliveryCity")}
              <input id="delivery-city" ref={city} type="text" name="deliveryCity" maxLength={120} defaultValue={delivery?.city ?? ""} autoComplete="off" />
            </label>
            <label htmlFor="delivery-country" className="field-fit">
              {t("deliveryCountry")}
              <input id="delivery-country" type="text" name="deliveryCountry" maxLength={2} defaultValue={delivery?.countryCode ?? "FR"} autoComplete="off" aria-describedby="delivery-country-hint" className="field-short" />
            </label>
          </div>
          <p id="delivery-country-hint" className="field-hint">
            {t("deliveryCountryHint")}
          </p>
          {venue.name ? (
            <button type="button" className="button-secondary" onClick={suggestVenue}>
              {t("deliveryUseVenue", { venue: venue.name })}
            </button>
          ) : null}
        </fieldset>
      </div>
    </QuoteActionForm>
  );
}
