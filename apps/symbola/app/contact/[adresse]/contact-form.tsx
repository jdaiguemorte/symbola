"use client";

// Lot 44 (CRM-01 ; D3, D4, D6, RGP-03) — le formulaire de contact public : nom, e-mail ou téléphone,
// date ou période, lieu, budget, invités, type, source, message ; les champs masqués par la planner
// n'apparaissent pas. La mention d'information est affichée avant le bouton d'envoi. Envoyé : une
// page de confirmation, rien d'autre (aucun e-mail au prospect). Le focus passe au titre de la
// confirmation (WCAG 2.4.3), ou au message d'erreur.
import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { ContactFormField } from "@symbola/contracts";
import { HoneypotField } from "@/app/ui/honeypot-field";
import type { ContactFormState } from "@/lib/contact-form/submit";
import { submitContactAction } from "./actions";

type Option = { id: string; label: string };

export function ContactForm({
  slug,
  opened,
  hiddenFields,
  eventTypes,
  sources,
  notice,
  privacyPolicyUrl,
  organizationName,
}: {
  slug: string;
  opened: string;
  hiddenFields: ContactFormField[];
  eventTypes: Option[];
  sources: Option[];
  notice: string;
  privacyPolicyUrl: string;
  organizationName: string;
}) {
  const t = useTranslations("ContactForm.public");
  const [state, action, pending] = useActionState<ContactFormState, FormData>(submitContactAction, { step: "form" });
  const sentTitle = useRef<HTMLHeadingElement>(null);
  const error = useRef<HTMLParagraphElement>(null);
  const shown = (field: ContactFormField) => !hiddenFields.includes(field);

  useEffect(() => {
    if (state.step === "sent") sentTitle.current?.focus();
    if (state.step === "form" && state.error) error.current?.focus();
  }, [state]);

  if (state.step === "sent") {
    return (
      <section aria-labelledby="contact-sent-title" className="card" role="status">
        <h2 id="contact-sent-title" ref={sentTitle} tabIndex={-1}>
          {t("sentTitle")}
        </h2>
        <p>{t("sentBody", { organization: organizationName })}</p>
      </section>
    );
  }
  if (state.step === "unavailable") {
    return (
      <p role="alert">
        {t("unavailable")}
      </p>
    );
  }
  const values = state.values ?? {};

  return (
    <form action={action} className="stack contact-form" aria-describedby="contact-required">
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="opened" value={opened} />
      <p id="contact-required" className="meta">
        {t("required")}
      </p>
      {state.error ? (
        <p role="alert" ref={error} tabIndex={-1}>
          {t(`error.${state.error}`)}
        </p>
      ) : null}
      <div className="field-row">
        <label>
          <span>
            {t("firstName")} <span className="required-mark" aria-hidden="true">*</span>
          </span>
          <input type="text" name="firstName" required maxLength={100} autoComplete="given-name" defaultValue={values.firstName ?? ""} />
        </label>
        <label>
          <span>
            {t("lastName")} <span className="required-mark" aria-hidden="true">*</span>
          </span>
          <input type="text" name="lastName" required maxLength={100} autoComplete="family-name" defaultValue={values.lastName ?? ""} />
        </label>
      </div>
      <fieldset className="stack">
        <legend>{t("contactLegend")}</legend>
        <label>
          {t("email")}
          <input type="email" name="email" maxLength={254} autoComplete="email" defaultValue={values.email ?? ""} />
        </label>
        {shown("phone") ? (
          <label>
            {t("phone")}
            <input type="tel" name="phone" maxLength={40} autoComplete="tel" defaultValue={values.phone ?? ""} />
          </label>
        ) : null}
      </fieldset>
      {shown("eventType") && eventTypes.length > 0 ? (
        <label>
          {t("eventType")}
          <select name="eventTypeId" defaultValue={values.eventTypeId ?? ""}>
            <option value="">{t("noChoice")}</option>
            {eventTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {shown("date") ? (
        <div className="field-row">
          <label>
            {t("eventDate")}
            <input type="date" name="eventDate" defaultValue={values.eventDate ?? ""} />
          </label>
          <label>
            {t("period")}
            <input type="text" name="period" maxLength={100} placeholder={t("periodExample")} defaultValue={values.period ?? ""} />
          </label>
        </div>
      ) : null}
      {shown("place") ? (
        <label>
          {t("place")}
          <input type="text" name="place" maxLength={200} defaultValue={values.place ?? ""} />
        </label>
      ) : null}
      <div className="field-row">
        {shown("budget") ? (
          <label>
            {t("budget")}
            <input type="text" name="budget" maxLength={100} placeholder={t("budgetExample")} defaultValue={values.budget ?? ""} />
          </label>
        ) : null}
        {shown("guests") ? (
          <label>
            {t("guests")}
            <input type="number" name="guests" min={0} max={100000} inputMode="numeric" defaultValue={values.guests ?? ""} />
          </label>
        ) : null}
      </div>
      {shown("source") && sources.length > 0 ? (
        <label>
          {t("source")}
          <select name="sourceId" defaultValue={values.sourceId ?? ""}>
            <option value="">{t("noChoice")}</option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      {shown("message") ? (
        <label>
          {t("message")}
          <textarea name="message" rows={6} maxLength={5000} defaultValue={values.message ?? ""} />
        </label>
      ) : null}
      <HoneypotField />
      {/* RGP-03 : la mention d'information, avant le bouton d'envoi. */}
      <section aria-labelledby="contact-notice-title" className="contact-notice">
        <h2 id="contact-notice-title">
          {t("noticeTitle")}
        </h2>
        <p className="meta">{notice}</p>
        <p className="meta">
          <a href={privacyPolicyUrl} target="_blank" rel="noopener noreferrer">
            {t("policyLink", { organization: organizationName })}
          </a>
        </p>
      </section>
      <button type="submit" className="primary" disabled={pending}>
        {pending ? t("sending") : t("send")}
      </button>
    </form>
  );
}
