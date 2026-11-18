"use client";

// Lot 49 (INV-03, RGP-03, RGP-06, RGP-08 ; D3, D11, D13 ; SU-10, SU-11) — la page de réponse d'un
// invité : une seule page, une minute sur téléphone, sans compte ni adresse e-mail demandée. Le jeton
// est lu après « # », retiré de l'adresse et de l'historique avant tout envoi, puis gardé en mémoire
// de la page (jamais dans un cookie). Dans l'ordre : présence de chaque membre du foyer par temps
// fort (un toucher), régimes et allergies après la case d'accord (non précochée ; sans elle, les
// cases restent inactives), hébergement et transport si la planner les pose, puis « Envoyer ma
// réponse ». Chaque champ est étiqueté, chaque question a son titre ; aucune animation, aucun champ
// libre. Mention d'information en tête et en pied, et le lien d'opposition.
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import type { RsvpView } from "@symbola/contracts";
import { answerRsvpAction, openRsvpAction, opposeRsvpAction, type RsvpOpenOutcome } from "./actions";

type State =
  | { step: "opening" }
  | { step: "invalid" }
  | { step: "retry"; minutes: number }
  | { step: "answer"; token: string; view: RsvpView; saved: boolean }
  | { step: "closed"; view: RsvpView }
  | { step: "opposed" };

function takeTokenFromAddress(): string | null {
  const hash = window.location.hash.slice(1);
  if (hash) window.history.replaceState(window.history.state, "", window.location.pathname);
  try {
    return decodeURIComponent(hash) || null;
  } catch {
    return null;
  }
}

function stateOf(token: string, result: RsvpOpenOutcome): State {
  if (result.outcome === "open") return { step: "answer", token, view: result.view, saved: result.view.answeredAt !== null };
  if (result.outcome === "closed") return { step: "closed", view: result.view };
  if (result.outcome === "retry") return { step: "retry", minutes: result.minutes };
  return { step: "invalid" };
}

function formatDate(date: string, locale: string): string {
  return new Intl.DateTimeFormat(locale === "en" ? "en-GB" : "fr-FR", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${date}T00:00:00Z`));
}

export function RsvpApp() {
  const t = useTranslations("Guests.rsvp");
  const [state, setState] = useState<State>({ step: "opening" });
  const started = useRef(false);

  useEffect(() => {
    const consume = () => {
      const token = takeTokenFromAddress();
      if (!token) return false;
      setState({ step: "opening" });
      void openRsvpAction(token).then((result) => setState(stateOf(token, result)));
      return true;
    };
    if (!started.current) {
      started.current = true;
      if (!consume()) setState({ step: "invalid" });
    }
    const onHashChange = () => void consume();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  return (
    <main className="rsvp" lang={useLocale()}>
      {state.step === "opening" ? (
        <>
          <h1>{t("openingTitle")}</h1>
          <p role="status">{t("openingBody")}</p>
          <noscript>
            <p>{t("noScript")}</p>
          </noscript>
        </>
      ) : null}
      {state.step === "invalid" ? (
        <>
          <h1>{t("invalidTitle")}</h1>
          <p>{t("invalidBody")}</p>
        </>
      ) : null}
      {state.step === "retry" ? (
        <>
          <h1>{t("invalidTitle")}</h1>
          <p role="alert">{t("retryLater", { minutes: state.minutes })}</p>
        </>
      ) : null}
      {state.step === "opposed" ? (
        <>
          <h1 tabIndex={-1}>{t("opposedTitle")}</h1>
          <p role="status">{t("opposedBody")}</p>
        </>
      ) : null}
      {state.step === "closed" ? <ClosedView view={state.view} /> : null}
      {state.step === "answer" ? <AnswerView key={state.view.answeredAt ?? "new"} state={state} onState={setState} /> : null}
    </main>
  );
}

function Notice({ view, id }: { view: RsvpView; id?: string }) {
  const t = useTranslations("Guests.rsvp");
  return (
    <section className="link-privacy rsvp-notice" aria-labelledby={id ? `${id}-title` : undefined} id={id}>
      <h2 id={id ? `${id}-title` : undefined}>{t("noticeTitle")}</h2>
      <p>{view.notice}</p>
      <p>
        {t("contact", { name: view.contact.name })} {view.contact.email ? <a href={`mailto:${view.contact.email}`}>{view.contact.email}</a> : null}
        {view.contact.email && view.contact.phone ? " · " : null}
        {view.contact.phone ? <a href={`tel:${view.contact.phone.replace(/\s/g, "")}`}>{view.contact.phone}</a> : null}
      </p>
    </section>
  );
}

function Recap({ view }: { view: RsvpView }) {
  const t = useTranslations("Guests.rsvp");
  const locale = useLocale();
  const optionLabel = new Map(view.dietOptions.map((option) => [option.id, option.label]));
  return (
    <section aria-labelledby="rsvp-recap-title">
      <h2 id="rsvp-recap-title">{t("recapTitle")}</h2>
      <ul>
        {view.keyMoments.map((moment) => (
          <li key={moment.id}>
            <strong>{moment.name}</strong> ({formatDate(moment.date, locale)}) :{" "}
            {view.members
              .map((member) => {
                const answer = member.answers[moment.id];
                return `${member.firstName} — ${answer === true ? t("yes") : answer === false ? t("no") : t("noAnswer")}`;
              })
              .join(" ; ")}
          </li>
        ))}
        {view.members
          .filter((member) => member.diet && member.diet.length > 0)
          .map((member) => (
            <li key={`diet-${member.id}`}>
              {t("recapDiet", { name: member.firstName, diet: member.diet!.map((id) => optionLabel.get(id) ?? "").filter(Boolean).join(", ") })}
            </li>
          ))}
        {view.accommodation !== null ? <li>{view.accommodation ? t("recapAccommodationYes") : t("recapAccommodationNo")}</li> : null}
        {view.transport !== null ? <li>{view.transport ? t("recapTransportYes") : t("recapTransportNo")}</li> : null}
      </ul>
    </section>
  );
}

function ClosedView({ view }: { view: RsvpView }) {
  const t = useTranslations("Guests.rsvp");
  const locale = useLocale();
  return (
    <>
      <h1>{t("closedTitle", { clients: view.clientNames })}</h1>
      <p role="status">{t("closedBody", { date: formatDate(view.closesOn, locale) })}</p>
      <Recap view={view} />
      <Notice view={view} id="rsvp-notice" />
    </>
  );
}

type Draft = {
  presence: Record<string, boolean | undefined>;
  consent: boolean;
  diet: string[];
  children: Record<string, { declared: boolean; diet: string[] }>;
  accommodation: boolean | null;
  transport: boolean | null;
};

function draftOf(view: RsvpView): Draft {
  const presence: Draft["presence"] = {};
  for (const member of view.members) for (const momentId of member.keyMomentIds) presence[`${member.id}:${momentId}`] = member.answers[momentId];
  const self = view.members.find((member) => member.isSelf);
  return {
    presence,
    consent: view.consented,
    diet: self?.diet ?? [],
    children: Object.fromEntries(view.members.filter((member) => member.kind === "child").map((member) => [member.id, { declared: member.guardianDeclared, diet: member.diet ?? [] }])),
    accommodation: view.accommodation,
    transport: view.transport,
  };
}

function AnswerView({ state, onState }: { state: Extract<State, { step: "answer" }>; onState: (state: State) => void }) {
  const t = useTranslations("Guests.rsvp");
  const locale = useLocale();
  const { view, token } = state;
  const [draft, setDraft] = useState<Draft>(() => draftOf(view));
  const [editing, setEditing] = useState(!state.saved);
  const [problem, setProblem] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [confirmOppose, setConfirmOppose] = useState(false);
  const thanks = useRef<HTMLHeadingElement>(null);
  const formId = useId();
  const answerers = view.members.filter((member) => member.canAnswerPresence);
  const dietMembers = view.members.filter((member) => member.canGiveDiet);
  const children = dietMembers.filter((member) => member.kind === "child");

  useEffect(() => {
    if (!editing) thanks.current?.focus();
  }, [editing]);

  const vocabulary = view.vocabulary === "couple" ? "wedding" : "event";
  const title = t(`title.${vocabulary}`, { clients: view.clientNames });

  if (!editing) {
    return (
      <>
        <h1 ref={thanks} tabIndex={-1}>
          {t("thanksTitle")}
        </h1>
        <p role="status">{t("thanksBody")}</p>
        <Recap view={view} />
        <section aria-labelledby="rsvp-next-title">
          <h2 id="rsvp-next-title">{t("nextTitle")}</h2>
          <p>{t("nextBody", { date: formatDate(view.closesOn, locale) })}</p>
          <button type="button" onClick={() => setEditing(true)}>
            {t("edit")}
          </button>
        </section>
        <Notice view={view} id="rsvp-notice" />
      </>
    );
  }

  const submit = () => {
    const missing = answerers.some((member) => member.keyMomentIds.some((momentId) => draft.presence[`${member.id}:${momentId}`] === undefined));
    if (missing) {
      setProblem(t("presenceMissing"));
      return;
    }
    setProblem(null);
    startTransition(async () => {
      const result = await answerRsvpAction(token, {
        presence: answerers.flatMap((member) => member.keyMomentIds.map((keyMomentId) => ({ guestId: member.id, keyMomentId, attending: draft.presence[`${member.id}:${keyMomentId}`] === true }))),
        consent: view.questions.diet && draft.consent,
        dietOptionIds: draft.consent ? draft.diet : [],
        children: children.map((child) => ({ guestId: child.id, guardianDeclared: draft.children[child.id]?.declared ?? false, dietOptionIds: draft.consent ? (draft.children[child.id]?.diet ?? []) : [] })),
        accommodation: view.questions.accommodation && view.isRespondent ? draft.accommodation : undefined,
        transport: view.questions.transport && view.isRespondent ? draft.transport : undefined,
      });
      if (result.outcome === "saved") {
        onState({ step: "answer", token, view: result.view, saved: true });
        setEditing(false);
      } else if (result.outcome === "closed") {
        setProblem(t("closedNow"));
      } else if (result.outcome === "retry") {
        setProblem(t("retryLater", { minutes: result.minutes }));
      } else {
        onState({ step: "invalid" });
      }
    });
  };

  const toggle = (list: string[], id: string, on: boolean) => (on ? [...new Set([...list, id])] : list.filter((value) => value !== id));

  return (
    <>
      <h1>{title}</h1>
      <p>{t("intro", { date: formatDate(view.closesOn, locale) })}</p>
      <p className="rsvp-notice">
        {t("noticeShort", { organization: view.organizationName })} <a href="#rsvp-notice">{t("noticeLink")}</a>
      </p>
      <form
        id={formId}
        className="stack"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        <h2>{t("presenceTitle")}</h2>
        {view.keyMoments.map((moment) => {
          const when = [formatDate(moment.date, locale), moment.startTime, moment.placeLabel].filter(Boolean).join(" · ");
          return (
            <section key={moment.id} aria-labelledby={`moment-${moment.id}`}>
              <h3 id={`moment-${moment.id}`}>
                {moment.name} <span className="muted">({when})</span>
              </h3>
              {answerers.map((member) => {
                const key = `${member.id}:${moment.id}`;
                const value = draft.presence[key];
                return (
                  <fieldset key={key}>
                    <legend>{member.isSelf ? t("presenceSelf", { name: member.firstName, moment: moment.name }) : t("presenceOther", { name: member.firstName, moment: moment.name })}</legend>
                    <div className="rsvp-choices">
                      <label className="rsvp-choice">
                        <input type="radio" name={key} required checked={value === true} onChange={() => setDraft({ ...draft, presence: { ...draft.presence, [key]: true } })} />
                        <span>{t("yes")}</span>
                      </label>
                      <label className="rsvp-choice">
                        <input type="radio" name={key} required checked={value === false} onChange={() => setDraft({ ...draft, presence: { ...draft.presence, [key]: false } })} />
                        <span>{t("no")}</span>
                      </label>
                    </div>
                  </fieldset>
                );
              })}
            </section>
          );
        })}

        {view.questions.diet ? (
          <section aria-labelledby="rsvp-diet-title">
            <h2 id="rsvp-diet-title">{t("dietTitle")}</h2>
            <p>{t("dietIntro")}</p>
            <label className="rsvp-choice">
              <input type="checkbox" checked={draft.consent} onChange={(event) => setDraft({ ...draft, consent: event.target.checked })} aria-describedby="rsvp-consent-text" />
              <span id="rsvp-consent-text">{view.consent.text}</span>
            </label>
            <fieldset disabled={!draft.consent}>
              <legend>{t("dietSelf", { name: view.selfFirstName })}</legend>
              {view.dietOptions.map((option) => (
                <label key={option.id} className="rsvp-choice">
                  <input type="checkbox" checked={draft.diet.includes(option.id)} onChange={(event) => setDraft({ ...draft, diet: toggle(draft.diet, option.id, event.target.checked) })} />
                  <span>{option.label}</span>
                </label>
              ))}
            </fieldset>
            {children.map((child) => {
              const current = draft.children[child.id] ?? { declared: false, diet: [] };
              return (
                <fieldset key={child.id} disabled={!draft.consent}>
                  <legend>{t("dietChild", { name: child.firstName })}</legend>
                  <label className="rsvp-choice">
                    <input type="checkbox" checked={current.declared} onChange={(event) => setDraft({ ...draft, children: { ...draft.children, [child.id]: { ...current, declared: event.target.checked } } })} />
                    <span>{view.consent.guardianTexts[child.id]}</span>
                  </label>
                  {view.dietOptions.map((option) => (
                    <label key={option.id} className="rsvp-choice">
                      <input
                        type="checkbox"
                        disabled={!current.declared}
                        checked={current.diet.includes(option.id)}
                        onChange={(event) => setDraft({ ...draft, children: { ...draft.children, [child.id]: { ...current, diet: toggle(current.diet, option.id, event.target.checked) } } })}
                      />
                      <span>{option.label}</span>
                    </label>
                  ))}
                </fieldset>
              );
            })}
          </section>
        ) : null}

        {view.isRespondent && (view.questions.accommodation || view.questions.transport) ? (
          <section aria-labelledby="rsvp-stay-title">
            <h2 id="rsvp-stay-title">{t("stayTitle")}</h2>
            {view.questions.accommodation ? (
              <fieldset>
                <legend>{t("accommodationQuestion")}</legend>
                <div className="rsvp-choices">
                  <label className="rsvp-choice">
                    <input type="radio" name="accommodation" checked={draft.accommodation === true} onChange={() => setDraft({ ...draft, accommodation: true })} />
                    <span>{t("yes")}</span>
                  </label>
                  <label className="rsvp-choice">
                    <input type="radio" name="accommodation" checked={draft.accommodation === false} onChange={() => setDraft({ ...draft, accommodation: false })} />
                    <span>{t("no")}</span>
                  </label>
                </div>
              </fieldset>
            ) : null}
            {view.questions.transport ? (
              <fieldset>
                <legend>{t("transportQuestion")}</legend>
                <div className="rsvp-choices">
                  <label className="rsvp-choice">
                    <input type="radio" name="transport" checked={draft.transport === true} onChange={() => setDraft({ ...draft, transport: true })} />
                    <span>{t("yes")}</span>
                  </label>
                  <label className="rsvp-choice">
                    <input type="radio" name="transport" checked={draft.transport === false} onChange={() => setDraft({ ...draft, transport: false })} />
                    <span>{t("no")}</span>
                  </label>
                </div>
              </fieldset>
            ) : null}
          </section>
        ) : null}

        {problem ? <p role="alert">{problem}</p> : null}
        <button type="submit" className="primary" disabled={pending}>
          {pending ? t("sending") : t("submit")}
        </button>
        <p className="muted">{t("help")}</p>
      </form>

      <Notice view={view} id="rsvp-notice" />
      <section aria-labelledby="rsvp-oppose-title">
        <h2 id="rsvp-oppose-title">{t("opposeTitle")}</h2>
        {confirmOppose ? (
          <>
            <p role="alert">{t("opposeConfirmBody")}</p>
            <button
              type="button"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  const result = await opposeRsvpAction(token);
                  if (result.outcome === "done") onState({ step: "opposed" });
                  else if (result.outcome === "retry") setProblem(t("retryLater", { minutes: result.minutes }));
                  else onState({ step: "invalid" });
                })
              }
            >
              {t("opposeConfirm")}
            </button>{" "}
            <button type="button" onClick={() => setConfirmOppose(false)}>
              {t("opposeCancel")}
            </button>
          </>
        ) : (
          <button type="button" onClick={() => setConfirmOppose(true)}>
            {t("oppose")}
          </button>
        )}
      </section>
    </>
  );
}
