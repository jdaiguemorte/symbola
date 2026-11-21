"use client";

// Lot 64 (RDV-02, RDV-03 ; D7, D8 ; maquettes M8 à M10) — la réservation, à la manière des outils du
// marché : une fenêtre en colonnes (le rendez-vous, le mois, les heures du jour choisi ; « 10:00 |
// Suivant »), puis une étape à la fois (vos coordonnées, une question par écran, le récapitulatif),
// puis la confirmation. Un jour sans créneau est barré, sans en dire la raison. Les réponses partent
// toutes ensemble à l'action de lot 46 (débit, piège à robots, créneau revérifié en transaction).
import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import type { AppointmentQuestion } from "@symbola/contracts";
import { HoneypotField } from "@/app/ui/honeypot-field";
import { ErrorNotice } from "@/app/ui/notices";
import { bookAppointmentAction, type BookingState } from "./actions";
import { SlotPicker } from "../slot-picker";

const ZONE = "Europe/Paris";
const LETTERS = "ABCDEFGHIJKL";

type TypeInfo = { id: string; name: string; durationMinutes: number; locationKind: "place" | "video" | "phone"; description: string | null; questions: AppointmentQuestion[] };
type Step = { kind: "slot" } | { kind: "details" } | { kind: "question"; index: number } | { kind: "recap" };

function zonedDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}



export function BookingWizard({ slug, type, slots, locale, organizationName, today, otherTypesHref }: { slug: string; type: TypeInfo; slots: string[]; locale: string; organizationName: string; today: string; otherTypesHref: string | null }) {
  const t = useTranslations("Appointments.public");
  const tag = locale === "en" ? "en-GB" : "fr-FR";
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { timeZone: ZONE, ...options });
  const time = format({ hour: "2-digit", minute: "2-digit" });
  const longDay = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const dayOf = (date: string) => new Date(`${date}T12:00:00Z`);

  const [state, action, pending] = useActionState<BookingState, FormData>(bookAppointmentAction, { step: "form" });
  const offered = state.step === "taken" ? state.alternatives : slots;

  const restored = "values" in state ? (state.values ?? {}) : {};
  const [slot, setSlot] = useState<string | null>(null);
  const [step, setStep] = useState<Step>({ kind: "slot" });
  const [person, setPerson] = useState({ name: restored.name ?? "", email: restored.email ?? "", phone: restored.phone ?? "" });
  const [answers, setAnswers] = useState<Record<string, string>>(Object.fromEntries(type.questions.map((question) => [question.id, restored[`q_${question.id}`] ?? ""])));
  const [localError, setLocalError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  // Un créneau pris entre-temps : retour au choix du créneau, sur le premier jour proposé.
  useEffect(() => {
    if (state.step === "taken") {
      setStep({ kind: "slot" });
      setSlot(null);
    }
    if (state.step === "form" && state.error) setStep({ kind: "recap" });
  }, [state]);
  // Le focus suit l'étape (WCAG 2.4.3) : le titre de l'étape nouvelle.
  useEffect(() => {
    heading.current?.focus();
  }, [step, state.step]);

  const questions = type.questions;
  const totalSteps = 2 + questions.length; // coordonnées, questions, récapitulatif
  const stepNumber = step.kind === "details" ? 1 : step.kind === "question" ? 2 + step.index : step.kind === "recap" ? totalSteps : 0;
  const slotLabel = slot ? `${longDay.format(dayOf(zonedDate(new Date(slot))))}, ${time.format(new Date(slot))} – ${time.format(new Date(new Date(slot).getTime() + type.durationMinutes * 60_000))}` : null;
  const place = t(`place.${type.locationKind}`);

  const next = () => {
    setLocalError(null);
    if (step.kind === "details") {
      if (!person.name.trim()) return setLocalError(t("error.name"));
      if (!/^\S+@\S+\.\S+$/.test(person.email.trim())) return setLocalError(t("error.email"));
      return setStep(questions.length > 0 ? { kind: "question", index: 0 } : { kind: "recap" });
    }
    if (step.kind === "question") {
      const question = questions[step.index]!;
      if (question.required && !answers[question.id]?.trim()) return setLocalError(t("error.required"));
      return setStep(step.index + 1 < questions.length ? { kind: "question", index: step.index + 1 } : { kind: "recap" });
    }
  };
  const previous = () => {
    setLocalError(null);
    if (step.kind === "details") return setStep({ kind: "slot" });
    if (step.kind === "question") return setStep(step.index === 0 ? { kind: "details" } : { kind: "question", index: step.index - 1 });
    if (step.kind === "recap") return setStep(questions.length > 0 ? { kind: "question", index: questions.length - 1 } : { kind: "details" });
  };
  const choose = (question: AppointmentQuestion, choice: string) => {
    setAnswers({ ...answers, [question.id]: choice });
    setLocalError(null);
    const index = questions.indexOf(question);
    setStep(index + 1 < questions.length ? { kind: "question", index: index + 1 } : { kind: "recap" });
  };
  // Une question à choix : les touches A, B, C… choisissent, où que soit le focus de l'étape (le titre
  // de la question le reçoit), sauf dans un champ de saisie.
  const choiceQuestion = step.kind === "question" && questions[step.index]?.kind === "choice" ? questions[step.index]! : null;
  useEffect(() => {
    if (!choiceQuestion) return;
    const onKey = (event: globalThis.KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (event.altKey || event.ctrlKey || event.metaKey || target?.closest("input, textarea, select")) return;
      const position = LETTERS.indexOf(event.key.toUpperCase());
      if (event.key.length === 1 && position >= 0 && position < choiceQuestion.choices.length) {
        event.preventDefault();
        choose(choiceQuestion, choiceQuestion.choices[position]!);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  // —— Confirmation et refus ——————————————————————————————————————————————————————————
  if (state.step === "booked") {
    return (
      <div className="booking-window booking-window-two">
        {summary()}
        <section className="booking-step" aria-labelledby="booked-title">
          <div className="booking-progress" aria-hidden="true">
            <span className="booking-progress-full" />
          </div>
          <p className="booking-check" aria-hidden="true">
            ✓
          </p>
          <div role="status">
            <h2 id="booked-title" ref={heading} tabIndex={-1} className="booking-question-title">
              {t("bookedTitle")}
            </h2>
            <p>{state.startsAt ? t("bookedBody", { date: format({ weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(state.startsAt)), organization: organizationName }) : t("bookedFallback")}</p>
          </div>
          {state.manageUrl ? (
            <p>
              <a href={state.manageUrl}>{t("manageLink")}</a>
            </p>
          ) : null}
        </section>
      </div>
    );
  }
  if (state.step === "refused" || state.step === "unavailable") {
    return <ErrorNotice>{state.step === "refused" ? t("refused", { organization: organizationName }) : t("unavailable")}</ErrorNotice>;
  }

  function summary() {
    return (
      <aside className="booking-summary">
        <p className="booking-organization">{organizationName}</p>
        <h1 className="booking-type-name">{type.name}</h1>
        <ul className="booking-meta">
          <li>{t("durationMeta", { minutes: type.durationMinutes })}</li>
          <li>{place}</li>
          {slotLabel && step.kind !== "slot" ? <li className="booking-meta-slot">{slotLabel}</li> : null}
        </ul>
        {slotLabel && step.kind !== "slot" && state.step !== "booked" ? (
          <button type="button" className="button-ghost booking-change" onClick={() => setStep({ kind: "slot" })}>
            {t("changeSlot")}
          </button>
        ) : null}
        {type.description && step.kind === "slot" ? <p className="booking-description">{type.description}</p> : null}
        {otherTypesHref && step.kind === "slot" ? <a href={otherTypesHref}>{t("otherTypes")}</a> : null}
      </aside>
    );
  }

  // —— Étape 1 : le créneau ————————————————————————————————————————————————————————————
  if (step.kind === "slot") {
    return (
      <div className="booking-window">
        {summary()}
        <SlotPicker
          key={offered.join(",")}
          slots={offered}
          locale={locale}
          today={today}
          initialSlot={slot}
          chooseLabel={t("next")}
          headingRef={heading}
          notice={state.step === "taken" ? <ErrorNotice>{state.alternatives.length > 0 ? t("taken") : t("takenNone")}</ErrorNotice> : null}
          emptyText={t("noSlot", { organization: organizationName })}
          onChoose={(chosen) => {
            setSlot(chosen);
            setStep({ kind: "details" });
          }}
        />
      </div>
    );
  }

  // —— Étapes suivantes, une à la fois ————————————————————————————————————————————————
  const question = step.kind === "question" ? questions[step.index]! : null;
  return (
    <div className="booking-window booking-window-two">
      {summary()}
      <form action={action} className="booking-step" onSubmit={(event) => step.kind !== "recap" && (event.preventDefault(), next())}>
        <div className="booking-progress" aria-hidden="true">
          <span className="booking-progress-bar">
            <svg viewBox={`0 0 ${totalSteps} 1`} preserveAspectRatio="none" focusable="false">
              <rect x={0} y={0} width={stepNumber} height={1} />
            </svg>
          </span>
        </div>
        <p className="booking-step-number">{question ? t("stepQuestion", { step: stepNumber, total: totalSteps, number: step.kind === "question" ? step.index + 1 : 0, count: questions.length }) : t("stepOf", { step: stepNumber, total: totalSteps })}</p>
        {/* Tout part à la réservation, quelle que soit l'étape affichée. */}
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="typeId" value={type.id} />
        <input type="hidden" name="startsAt" value={slot ?? ""} />
        {step.kind !== "details" ? (
          <>
            <input type="hidden" name="name" value={person.name} />
            <input type="hidden" name="email" value={person.email} />
            <input type="hidden" name="phone" value={person.phone} />
          </>
        ) : null}
        {questions.map((item) => (step.kind === "question" && item.id === question?.id && item.kind === "text" ? null : <input key={item.id} type="hidden" name={`q_${item.id}`} value={answers[item.id] ?? ""} />))}
        <HoneypotField />

        {step.kind === "details" ? (
          <>
            <h2 ref={heading} tabIndex={-1} className="booking-question-title">
              {t("detailsTitle")}
            </h2>
            <div className="booking-fields">
              <label>
                {t("name")}
                <input type="text" name="name" required maxLength={200} autoComplete="name" value={person.name} onChange={(event) => setPerson({ ...person, name: event.target.value })} />
              </label>
              <label>
                {t("email")}
                <input type="email" name="email" required maxLength={254} autoComplete="email" value={person.email} onChange={(event) => setPerson({ ...person, email: event.target.value })} />
              </label>
              <label>
                {t("phone")}
                <input type="tel" name="phone" maxLength={40} autoComplete="tel" value={person.phone} onChange={(event) => setPerson({ ...person, phone: event.target.value })} />
              </label>
            </div>
          </>
        ) : null}

        {question ? (
          <>
            <h2 ref={heading} tabIndex={-1} className="booking-question-title">
              {question.label}
              {question.required ? <span className="booking-required"> {t("requiredMark")}</span> : null}
            </h2>
            {question.kind === "choice" ? (
              <div role="radiogroup" aria-label={question.label} className="booking-choices">
                {question.choices.map((choice, index) => (
                  <button key={choice} type="button" role="radio" aria-checked={answers[question.id] === choice} className="booking-choice" onClick={() => choose(question, choice)}>
                    <kbd aria-hidden="true">{LETTERS[index]}</kbd>
                    {choice}
                  </button>
                ))}
                <p className="booking-hint">{t("choiceHint")}</p>
              </div>
            ) : (
              <>
                <input type="text" name={`q_${question.id}`} className="booking-answer" maxLength={500} aria-label={question.label} value={answers[question.id] ?? ""} onChange={(event) => setAnswers({ ...answers, [question.id]: event.target.value })} />
                <p className="booking-hint">{t("enterHint")}</p>
                <p className="booking-hint">{t("freeTextNotice", { organization: organizationName })}</p>
              </>
            )}
          </>
        ) : null}

        {step.kind === "recap" ? (
          <>
            <h2 ref={heading} tabIndex={-1} className="booking-question-title">
              {t("recapTitle")}
            </h2>
            {state.step === "form" && state.error ? <ErrorNotice>{t(`error.${state.error}`)}</ErrorNotice> : null}
            <dl className="booking-recap">
              <dt>{t("recapSlot")}</dt>
              <dd>{slotLabel}</dd>
              <dt>{t("recapYou")}</dt>
              <dd>{[person.name, person.email, person.phone].filter(Boolean).join(" · ")}</dd>
              {questions.map((item) => (
                <div key={item.id} className="booking-recap-row">
                  <dt>{item.label}</dt>
                  <dd>{answers[item.id] || t("noAnswerGiven")}</dd>
                </div>
              ))}
            </dl>
          </>
        ) : null}

        {localError ? <ErrorNotice>{localError}</ErrorNotice> : null}
        <div className="booking-actions">
          <button type="button" className="button-secondary" onClick={previous}>
            {t("previous")}
          </button>
          {step.kind === "recap" ? (
            <button type="submit" disabled={pending || !slot}>
              {pending ? t("booking") : t("book")}
            </button>
          ) : question?.kind === "choice" && !question.required ? (
            <button type="button" onClick={next}>
              {answers[question.id] ? t("continue") : t("skip")}
            </button>
          ) : question?.kind === "choice" ? (
            answers[question.id] ? (
              <button type="button" onClick={next}>
                {t("continue")}
              </button>
            ) : null
          ) : (
            <button type="submit">{t("continue")}</button>
          )}
        </div>
      </form>
    </div>
  );
}
