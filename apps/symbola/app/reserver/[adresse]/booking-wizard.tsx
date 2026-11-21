"use client";

// Lot 64 (RDV-02, RDV-03 ; D7, D8 ; maquettes M8 à M10) — la réservation, à la manière des outils du
// marché : une fenêtre en colonnes (le rendez-vous, le mois, les heures du jour choisi ; « 10:00 |
// Suivant »), puis une étape à la fois (vos coordonnées, une question par écran, le récapitulatif),
// puis la confirmation. Un jour sans créneau est barré, sans en dire la raison. Les réponses partent
// toutes ensemble à l'action de lot 46 (débit, piège à robots, créneau revérifié en transaction).
import { useActionState, useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { useTranslations } from "next-intl";
import type { AppointmentQuestion } from "@symbola/contracts";
import { HoneypotField } from "@/app/ui/honeypot-field";
import { ErrorNotice } from "@/app/ui/notices";
import { bookAppointmentAction, type BookingState } from "./actions";

const ZONE = "Europe/Paris";
const LETTERS = "ABCDEFGHIJKL";

type TypeInfo = { id: string; name: string; durationMinutes: number; locationKind: "place" | "video" | "phone"; description: string | null; questions: AppointmentQuestion[] };
type Step = { kind: "slot" } | { kind: "details" } | { kind: "question"; index: number } | { kind: "recap" };

function zonedDate(instant: Date): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(instant);
}

function monthCells(month: string): (string | null)[] {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const first = new Date(Date.UTC(year, monthIndex - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7; // lundi d'abord
  const days = new Date(Date.UTC(year, monthIndex, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: lead }, () => null);
  for (let day = 1; day <= days; day++) cells.push(`${month}-${String(day).padStart(2, "0")}`);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthIndex] = month.split("-").map(Number) as [number, number];
  const date = new Date(Date.UTC(year, monthIndex - 1 + delta, 1));
  return date.toISOString().slice(0, 7);
}

export function BookingWizard({ slug, type, slots, locale, organizationName, today, otherTypesHref }: { slug: string; type: TypeInfo; slots: string[]; locale: string; organizationName: string; today: string; otherTypesHref: string | null }) {
  const t = useTranslations("Appointments.public");
  const tag = locale === "en" ? "en-GB" : "fr-FR";
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(tag, { timeZone: ZONE, ...options });
  const time = format({ hour: "2-digit", minute: "2-digit" });
  const longDay = new Intl.DateTimeFormat(tag, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const shortDay = new Intl.DateTimeFormat(tag, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const monthName = new Intl.DateTimeFormat(tag, { month: "long", year: "numeric", timeZone: "UTC" });
  const weekdayNames = Array.from({ length: 7 }, (_, index) => new Intl.DateTimeFormat(tag, { weekday: "short", timeZone: "UTC" }).format(new Date(Date.UTC(2027, 2, 1 + index))));
  const dayOf = (date: string) => new Date(`${date}T12:00:00Z`);

  const [state, action, pending] = useActionState<BookingState, FormData>(bookAppointmentAction, { step: "form" });
  const offered = state.step === "taken" ? state.alternatives : slots;
  const byDay = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const slot of offered) {
      const date = zonedDate(new Date(slot));
      map.set(date, [...(map.get(date) ?? []), slot]);
    }
    return map;
  }, [offered]);
  const firstDay = [...byDay.keys()].sort()[0] ?? today;
  const lastDay = [...byDay.keys()].sort().at(-1) ?? today;

  const restored = "values" in state ? (state.values ?? {}) : {};
  const [month, setMonth] = useState(firstDay.slice(0, 7));
  const [day, setDay] = useState<string | null>(byDay.has(firstDay) ? firstDay : null);
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
      setDay(firstDay);
      setMonth(firstDay.slice(0, 7));
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
  const onChoiceKey = (event: KeyboardEvent<HTMLDivElement>, question: AppointmentQuestion) => {
    const position = LETTERS.indexOf(event.key.toUpperCase());
    if (event.key.length === 1 && position >= 0 && position < question.choices.length) {
      event.preventDefault();
      choose(question, question.choices[position]!);
    }
  };

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
    const daySlots = day ? (byDay.get(day) ?? []) : [];
    return (
      <div className="booking-window">
        {summary()}
        <section className="booking-calendar" aria-labelledby="calendar-title">
          <h2 id="calendar-title" ref={heading} tabIndex={-1}>
            {t("chooseDay")}
          </h2>
          {state.step === "taken" ? <ErrorNotice>{state.alternatives.length > 0 ? t("taken") : t("takenNone")}</ErrorNotice> : null}
          <div className="booking-month">
            <button type="button" className="button-secondary booking-month-nav" aria-label={t("previousMonth")} disabled={month <= firstDay.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, -1))}>
              ‹
            </button>
            <p className="booking-month-name" aria-live="polite">
              {monthName.format(dayOf(`${month}-01`))}
            </p>
            <button type="button" className="button-secondary booking-month-nav" aria-label={t("nextMonth")} disabled={month >= lastDay.slice(0, 7)} onClick={() => setMonth(shiftMonth(month, 1))}>
              ›
            </button>
          </div>
          <div className="booking-grid" role="grid" aria-label={monthName.format(dayOf(`${month}-01`))}>
            <div role="row" className="booking-grid-row">
              {weekdayNames.map((name) => (
                <span key={name} role="columnheader" className="booking-weekday">
                  {name}
                </span>
              ))}
            </div>
            {Array.from({ length: monthCells(month).length / 7 }, (_, row) => (
              <div key={row} role="row" className="booking-grid-row">
                {monthCells(month)
                  .slice(row * 7, row * 7 + 7)
                  .map((date, index) => {
                    if (!date) return <span key={index} role="gridcell" className="booking-day booking-day-empty" />;
                    const available = byDay.has(date);
                    const selected = date === day;
                    const label = `${longDay.format(dayOf(date))}, ${available ? t("dayAvailable") : t("dayUnavailable")}`;
                    return (
                      <span key={date} role="gridcell" aria-selected={selected}>
                        <button
                          type="button"
                          className={selected ? "booking-day booking-day-selected" : available ? "booking-day booking-day-available" : "booking-day booking-day-off"}
                          disabled={!available}
                          aria-label={label}
                          aria-pressed={selected}
                          onClick={() => {
                            setDay(date);
                            setSlot(null);
                          }}
                        >
                          {Number(date.slice(8))}
                        </button>
                      </span>
                    );
                  })}
              </div>
            ))}
          </div>
          <p className="booking-zone">{t("timeZone")}</p>
        </section>
        <section className="booking-times" aria-labelledby="times-title">
          <h2 id="times-title">{day ? longDay.format(dayOf(day)) : t("pickDayFirst")}</h2>
          {offered.length === 0 ? <p>{t("noSlot", { organization: organizationName })}</p> : null}
          <ul className="booking-time-list">
            {daySlots.map((candidate) => (
              <li key={candidate}>
                {candidate === slot ? (
                  <span className="booking-time-pick">
                    <span className="booking-time-chosen">{time.format(new Date(candidate))}</span>
                    <button type="button" onClick={() => setStep({ kind: "details" })} aria-label={t("nextWithSlot", { slot: `${shortDay.format(dayOf(day!))} ${time.format(new Date(candidate))}` })}>
                      {t("next")}
                    </button>
                  </span>
                ) : (
                  <button type="button" className="booking-time" onClick={() => setSlot(candidate)}>
                    {time.format(new Date(candidate))}
                  </button>
                )}
              </li>
            ))}
          </ul>
          <p className="booking-delay">{t("delayNotice")}</p>
        </section>
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
              <div role="radiogroup" aria-label={question.label} className="booking-choices" onKeyDown={(event) => onChoiceKey(event, question)}>
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
