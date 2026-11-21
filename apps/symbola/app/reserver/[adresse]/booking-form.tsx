"use client";

// Lot 46 (RDV-02, RDV-03 ; D5) — le formulaire de la page publique : un créneau (boutons radio
// groupés par jour, au clavier), puis nom, e-mail, téléphone facultatif et questions préalables.
// Créneau pris entre-temps : les créneaux voisins sont proposés. Réservé : la confirmation, et le
// lien pour reporter ou annuler sans compte.
import { useActionState, useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { AppointmentQuestion } from "@symbola/contracts";
import { HoneypotField } from "@/app/ui/honeypot-field";
import { ErrorNotice } from "@/app/ui/notices";
import { bookAppointmentAction, type BookingState } from "./actions";

export type SlotDay = { date: string; slots: string[] };

function formatter(locale: string, options: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { timeZone: "Europe/Paris", ...options });
}

export function BookingForm({ slug, typeId, days, questions, locale, organizationName }: { slug: string; typeId: string; days: SlotDay[]; questions: AppointmentQuestion[]; locale: string; organizationName: string }) {
  const t = useTranslations("Appointments.public");
  const [state, action, pending] = useActionState<BookingState, FormData>(bookAppointmentAction, { step: "form" });
  const time = formatter(locale, { hour: "2-digit", minute: "2-digit" });
  const longDay = formatter(locale, { weekday: "long", day: "numeric", month: "long" });
  const full = formatter(locale, { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" });
  const dayLabel = (date: string) => longDay.format(new Date(`${date}T12:00:00Z`));
  // Le formulaire disparaît à la réservation : le focus passe au titre de la confirmation, sinon il
  // retomberait au début de la page (WCAG 2.4.3).
  const bookedTitle = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (state.step === "booked") bookedTitle.current?.focus();
  }, [state.step]);

  if (state.step === "booked") {
    return (
      <section aria-labelledby="booked-title" className="card">
        <div role="status">
          <h2 id="booked-title" ref={bookedTitle} tabIndex={-1}>
            {t("bookedTitle")}
          </h2>
          <p>{state.startsAt ? t("bookedBody", { date: full.format(new Date(state.startsAt)), organization: organizationName }) : t("bookedFallback")}</p>
        </div>
        {state.manageUrl ? (
          <p>
            <a href={state.manageUrl}>{t("manageLink")}</a>
          </p>
        ) : null}
      </section>
    );
  }
  if (state.step === "refused" || state.step === "unavailable") {
    return <ErrorNotice>{state.step === "refused" ? t("refused", { organization: organizationName }) : t("unavailable")}</ErrorNotice>;
  }
  const values = "values" in state ? (state.values ?? {}) : {};
  const choices: SlotDay[] = state.step === "taken" ? [{ date: "", slots: state.alternatives }] : days;

  return (
    <form action={action} className="stack booking-form" noValidate={false}>
      <input type="hidden" name="slug" value={slug} />
      <input type="hidden" name="typeId" value={typeId} />
      {state.step === "taken" ? <ErrorNotice>{state.alternatives.length > 0 ? t("taken") : t("takenNone")}</ErrorNotice> : null}
      {state.step === "form" && state.error ? <ErrorNotice>{t(`error.${state.error}`)}</ErrorNotice> : null}
      <fieldset className="booking-slots">
        <legend>{t("chooseSlot")}</legend>
        {choices.map((day) => (
          <fieldset key={day.date || "alternatives"} className="booking-day">
            <legend>{day.date ? dayLabel(day.date) : t("alternatives")}</legend>
            {day.slots.length === 0 ? (
              <p className="meta">{t("dayFull")}</p>
            ) : (
              <div className="slot-chips">
                {day.slots.map((slot) => (
                  <label key={slot} className="slot-chip">
                    <input type="radio" name="startsAt" value={slot} required />
                    <span>{day.date ? time.format(new Date(slot)) : full.format(new Date(slot))}</span>
                  </label>
                ))}
              </div>
            )}
          </fieldset>
        ))}
      </fieldset>
      <label>
        {t("name")}
        <input type="text" name="name" required maxLength={200} autoComplete="name" defaultValue={values.name ?? ""} />
      </label>
      <label>
        {t("email")}
        <input type="email" name="email" required maxLength={254} autoComplete="email" defaultValue={values.email ?? ""} />
      </label>
      <label>
        {t("phone")}
        <input type="tel" name="phone" maxLength={40} autoComplete="tel" defaultValue={values.phone ?? ""} />
      </label>
      {questions.map((question) =>
        question.kind === "choice" ? (
          <label key={question.id}>
            {question.label}
            <select name={`q_${question.id}`} defaultValue={values[`q_${question.id}`] ?? ""}>
              <option value="">{t("noAnswer")}</option>
              {question.choices.map((choice) => (
                <option key={choice} value={choice}>
                  {choice}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label key={question.id}>
            {question.label}
            <input type="text" name={`q_${question.id}`} maxLength={500} defaultValue={values[`q_${question.id}`] ?? ""} />
          </label>
        ),
      )}
      {/* RGP-04 : une réponse libre, lue par l'organisation. */}
      {questions.some((question) => question.kind === "text") ? <p className="meta free-text-notice">{t("freeTextNotice", { organization: organizationName })}</p> : null}
      <HoneypotField />
      <button type="submit" className="primary" disabled={pending}>
        {pending ? t("booking") : t("book")}
      </button>
    </form>
  );
}
