"use client";

// Lot 63c (EVT-01, HUB-07, CHR-01 ; ADR 0106), refait au lot 70e (D8, C-03, C-25, C-51, M12, M13, A10,
// A13, A14 ; page 3 des maquettes du lot 68) — une seule forme pour « Nouvel évènement », depuis tous ses
// points d'entrée : « Où en est-il ? » (deux réponses, aucune choisie d'avance), le nom, la date, le
// client, le type s'il y en a plusieurs. « Créer l'évènement » reste actif : sans réponse, il le dit sous
// la question. La reprise de fichiers est une ligne à part, pas une réponse. Le reste (lieu, source,
// second client…) se complète depuis la fiche.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { ErrorSummary } from "@/app/ui/error-summary";
import { FieldError } from "@/app/ui/field-error";
import { useFeedback } from "@/app/ui/feedback";
import { useFieldValidation } from "@/app/ui/use-field-validation";
import { useRetryableAction } from "@/app/ui/use-retryable-action";
import { newEventFieldsSchema } from "@/lib/forms/new-event-fields";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
import { DraftKeeper } from "@/app/ui/draft-keeper";
import { createEventAction, type NewEventFormState } from "./actions";
import type { EventType } from "@/modules/events/service";
import type { Audience, ClientFieldLabels } from "@/lib/vocabulary";
import type { ContactChoice } from "@/app/contacts/actions";
import { ContactPicker } from "@/app/contacts/contact-picker";
import { SameDayNotice } from "../same-day-notice";
import { EVENT_STANDINGS, type EventStanding } from "./new-event-standing";
import { DEFAULT_PAST_DUE_SPREAD, pastDueOutcomes, type PastDueSpread, type PastDueTaskAnswer } from "@symbola/contracts";
import { formatShortCalendarDate, type Locale } from "@symbola/i18n";
import { useLocale } from "next-intl";
import { PastDueStep, type PastDueItem } from "./past-due-step";
import { usePastDueTranslator, type PastDueMessages } from "./past-due-messages";

// Lot 74b (B7) : un modèle de rétroplanning proposé à la création, ses tâches dans l'ordre du modèle.
export type NewEventTemplate = { id: string; name: string; eventTypeId: string | null; items: PastDueItem[] };

const STANDING_KEYS: Record<EventStanding, { title: "standingEnquiry" | "standingSigned"; hint: "standingEnquiryHint" | "standingSignedHint" }> = {
  enquiry: { title: "standingEnquiry", hint: "standingEnquiryHint" },
  signed: { title: "standingSigned", hint: "standingSignedHint" },
};

export function NewEventForm({
  eventTypes,
  clientLabels,
  initialContact = null,
  initialDate = "",
  initialStanding = null,
  templates = [],
  today = "",
  holidays = [],
  pastDueMessages,
}: {
  eventTypes: Pick<EventType, "id" | "label" | "audience">[];
  // Lot 16 (ADR 0045) : les libellés des clients suivent le type choisi.
  clientLabels: Record<Audience, ClientFieldLabels>;
  // Lot 36a (UX-02) : premier client déjà choisi (depuis la fiche d'un contact).
  initialContact?: ContactChoice | null;
  initialDate?: string;
  // Lot 74a (R3) : réglé par la fin de l'assistant ; jamais choisi d'avance ailleurs (M13).
  initialStanding?: EventStanding | null;
  // Lot 74b (B7) : les modèles de rétroplanning de l'organisation, le jour (Paris) et les jours fériés de la
  // période de répartition.
  templates?: NewEventTemplate[];
  today?: string;
  holidays?: readonly string[];
  // Lot 74b (NFR-02) : les textes de l'étape 2, passés par la seule page /events/new.
  pastDueMessages: PastDueMessages;
}) {
  const tPast = usePastDueTranslator(pastDueMessages);
  const t = useTranslations("Events");
  const tFeedback = useTranslations("Feedback");
  const tCommon = useTranslations("Common");
  const router = useRouter();
  const feedback = useFeedback();
  const formRef = useRef<HTMLFormElement>(null);
  // Lot 70b (NFR-16) : la connexion coupée à l'envoi ne perd rien ; le message propose « Réessayer ».
  const createAction = useRetryableAction(createEventAction, formRef, tFeedback("eventNotCreated"));
  const [state, formAction, pending] = useActionState(createAction, {} as NewEventFormState);
  const [eventTypeId, setEventTypeId] = useState(eventTypes[0]?.id ?? "");
  // Lot 32b (CRM-04) : la date suivie, pour signaler les évènements du même jour avant l'enregistrement.
  const [eventDate, setEventDate] = useState(initialDate);
  const eventType = eventTypes.find((type) => type.id === eventTypeId);
  const labels = clientLabels[eventType?.audience ?? "couple"];
  const validation = useFieldValidation(newEventFieldsSchema, state.fieldErrors);
  const locale = useLocale() as Locale;
  // Lot 74b (B7) : le rétroplanning annoncé pour « Signé, en préparation » avec une date : celui du type,
  // un autre, ou aucun (« Changer ») ; les échéances déjà passées sont comptées avant la création.
  const [standing, setStanding] = useState<EventStanding | null>(initialStanding);
  const [templateChoice, setTemplateChoice] = useState<string>("default");
  const [step, setStep] = useState<1 | 2>(1);
  const [answers, setAnswers] = useState<Record<string, PastDueTaskAnswer>>({});
  const [spread, setSpread] = useState<PastDueSpread>(DEFAULT_PAST_DUE_SPREAD);
  const [headingName, setHeadingName] = useState("");
  const typeTemplate = templates.find((template) => template.eventTypeId === eventTypeId);
  const template = templateChoice === "none" ? undefined : templateChoice === "default" ? typeTemplate : templates.find((candidate) => candidate.id === templateChoice);
  const announced = standing === "signed" && eventDate !== "" && today !== "" ? template : undefined;
  const pastCount = announced ? pastDueOutcomes(announced.items, { eventDate, today, answers: {}, spread, holidays: new Set() }).filter((outcome) => outcome.past).length : 0;
  const twoSteps = pastCount > 0;
  const showsStep2 = twoSteps && step === 2;

  // L'évènement est créé : on ouvre sa fiche, et le message de retour (« Évènement créé · Avec 42 tâches
  // et son budget · Voir ses tâches ») reste, car il est monté par le gabarit, au-dessus des écrans.
  const handled = useRef<unknown>(null);
  useEffect(() => {
    const created = state.created;
    if (!created || handled.current === created) return;
    handled.current = created;
    feedback?.show({
      title: tFeedback("eventCreated"),
      // Lot 74b (B7) : le compte de l'étape des échéances passées (« 3 faites · 5 à faire · 0 à dater »).
      detail:
        created.tasks > 0
          ? [tFeedback(created.budget ? "eventCreatedTasksBudget" : "eventCreatedTasks", { count: created.tasks }), created.pastDue ? tFeedback("eventCreatedPastDue", created.pastDue) : null].filter(Boolean).join(" · ")
          : undefined,
      ...(created.tasks > 0 ? { action: { kind: "link" as const, label: tFeedback("seeTasks"), href: `/events/${created.id}?onglet=taches` } } : {}),
    });
    router.push(created.href);
  }, [state.created, feedback, router, tFeedback]);

  return (
    <form
      ref={formRef}
      action={formAction}
      noValidate
      onSubmit={(event) => {
        if (!validation.onSubmit(event)) return;
        // « Continuer » : l'étape 2 s'ouvre, rien n'est encore créé.
        if (twoSteps && step === 1) {
          event.preventDefault();
          setHeadingName(String(new FormData(event.currentTarget).get("name") ?? "").trim());
          setStep(2);
        }
      }}
      onInput={validation.onInput}
    >
      {/* Lot 39b (UX-09) : la saisie est gardée et se reprend sur tout appareil. */}
      <DraftKeeper formKey="event-new" submission={state} saved={Boolean(state.created)} />
      <ErrorSummary errors={validation.errors} labels={{ standing: t("standingLegend"), name: t("newName") }} fieldId={validation.fieldId} summaryKey="summaryEvent" />
      {twoSteps ? <p className="meta new-event-step">{tPast("step", { step: showsStep2 ? 2 : 1 })}</p> : null}
      {/* Lot 74b : l'étape 1 reste dans le formulaire (ses champs partent avec « Créer l'évènement »). */}
      <div hidden={showsStep2}>
      <RequiredLegend text={tCommon("requiredLegend")} />
      <fieldset className="standing-choice" aria-describedby={validation.errorFor("standing") ? validation.errorId("standing") : undefined}>
        <legend>
          {t("standingLegend")}
          <RequiredMark />
        </legend>
        {EVENT_STANDINGS.map((option, index) => (
          <label key={option} className="standing-option">
            <input type="radio" name="standing" value={option} defaultChecked={initialStanding === option} onChange={() => setStanding(option)} {...(index === 0 ? validation.fieldProps("standing") : {})} />
            <span>
              <strong>{t(STANDING_KEYS[option].title)}</strong>
              <span className="meta">{t(STANDING_KEYS[option].hint)}</span>
            </span>
          </label>
        ))}
        <FieldError id={validation.errorId("standing")} message={validation.errorFor("standing")} />
      </fieldset>
      {/* M12 : la reprise n'est pas une réponse, c'est une porte à part, sans créer d'évènement. Lot 71b :
          elle mène à la page « Reprendre un mariage en cours ». */}
      <p className="new-event-import">
        {t("importPrompt")}{" "}
        <Link href="/reprise">{t("importLink")}</Link>
      </p>
      <label>
        {t("newName")}
        <RequiredMark />
        <input type="text" name="name" maxLength={200} autoComplete="off" placeholder={t("newNamePlaceholder")} {...validation.fieldProps("name")} />
        <FieldError id={validation.errorId("name")} message={validation.errorFor("name")} />
      </label>
      <label>
        {t("newDate")} <span className="meta">{t("newDateHint")}</span>
        <input type="date" name="eventDate" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
      </label>
      <SameDayNotice date={eventDate} />
      <ContactPicker name="contactId1" legend={t("newClient")} searchLabel={t("newClientHint")} initial={initialContact}>
        <label>
          {labels.client1FirstName}
          <input type="text" name="firstName1" autoComplete="off" />
        </label>
        <label>
          {labels.client1LastName}
          <input type="text" name="lastName1" autoComplete="off" />
        </label>
      </ContactPicker>
      {/* A13 : le type n'est demandé que si l'organisation en a plusieurs ; sinon le seul est pris. */}
      {eventTypes.length > 1 ? (
        <label>
          {t("newType")}
          <select name="eventTypeId" value={eventTypeId} onChange={(event) => setEventTypeId(event.target.value)}>
            {eventTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <input type="hidden" name="eventTypeId" value={eventTypeId} />
      )}
      {/* Lot 74b (B7, C-67) : le rétroplanning annoncé avec son compte, jamais une case cochée d'avance. */}
      {standing === "signed" && eventDate !== "" ? (
        <div className="new-event-template">
          <p>
            {announced
              ? tPast("announce", { name: announced.name, count: announced.items.length, past: pastCount })
              : tPast("announceNone")}
          </p>
          {twoSteps ? <p className="meta">{tPast("announceNext")}</p> : null}
          <input type="hidden" name="template" value={announced ? announced.id : "none"} />
          {templates.length > 0 ? (
            <details className="new-event-template-change">
              <summary>{tPast("change")}</summary>
              <fieldset>
                <legend className="sr-only">{tPast("changeLegend")}</legend>
                {templates.map((candidate) => (
                  <label key={candidate.id} className="checkbox">
                    <input type="radio" name="templateChoice" value={candidate.id} checked={template?.id === candidate.id} onChange={() => setTemplateChoice(candidate.id)} />
                    {tPast("templateOption", { name: candidate.name, count: candidate.items.length })}
                  </label>
                ))}
                <label className="checkbox">
                  <input type="radio" name="templateChoice" value="none" checked={!template} onChange={() => setTemplateChoice("none")} />
                  {tPast("noTemplate")}
                </label>
              </fieldset>
              {template ? (
                <details>
                  <summary>{tPast("seeTasks")}</summary>
                  <ol className="new-event-template-tasks">
                    {template.items.map((item) => (
                      <li key={item.id}>
                        {item.label} <span className="meta">{tPast("offset", { days: item.offsetDays })}</span>
                      </li>
                    ))}
                  </ol>
                </details>
              ) : null}
            </details>
          ) : null}
        </div>
      ) : null}
      </div>
      {showsStep2 && announced ? (
        <PastDueStep
          items={announced.items}
          eventDate={eventDate}
          today={today}
          holidays={holidays}
          heading={[headingName, formatShortCalendarDate(eventDate, locale)].filter(Boolean).join(", ")}
          answers={answers}
          onAnswer={setAnswers}
          spread={spread}
          onSpread={setSpread}
          messages={pastDueMessages}
        />
      ) : null}
      {showsStep2 ? (
        <button type="button" className="button-link" onClick={() => setStep(1)}>
          {tPast("back")}
        </button>
      ) : null}
      <button type="submit" className="button-primary" disabled={pending}>
        {twoSteps && step === 1 ? tPast("continue") : t("createEvent")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
