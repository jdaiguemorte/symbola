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

const STANDING_KEYS: Record<EventStanding, { title: "standingEnquiry" | "standingSigned"; hint: "standingEnquiryHint" | "standingSignedHint" }> = {
  enquiry: { title: "standingEnquiry", hint: "standingEnquiryHint" },
  signed: { title: "standingSigned", hint: "standingSignedHint" },
};

export function NewEventForm({
  eventTypes,
  clientLabels,
  initialContact = null,
  initialDate = "",
}: {
  eventTypes: Pick<EventType, "id" | "label" | "audience">[];
  // Lot 16 (ADR 0045) : les libellés des clients suivent le type choisi.
  clientLabels: Record<Audience, ClientFieldLabels>;
  // Lot 36a (UX-02) : premier client déjà choisi (depuis la fiche d'un contact).
  initialContact?: ContactChoice | null;
  initialDate?: string;
}) {
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

  // L'évènement est créé : on ouvre sa fiche, et le message de retour (« Évènement créé · Avec 42 tâches
  // et son budget · Voir ses tâches ») reste, car il est monté par le gabarit, au-dessus des écrans.
  const handled = useRef<unknown>(null);
  useEffect(() => {
    const created = state.created;
    if (!created || handled.current === created) return;
    handled.current = created;
    feedback?.show({
      title: tFeedback("eventCreated"),
      detail: created.tasks > 0 ? tFeedback(created.budget ? "eventCreatedTasksBudget" : "eventCreatedTasks", { count: created.tasks }) : undefined,
      ...(created.tasks > 0 ? { action: { kind: "link" as const, label: tFeedback("seeTasks"), href: `/events/${created.id}?onglet=taches` } } : {}),
    });
    router.push(created.href);
  }, [state.created, feedback, router, tFeedback]);

  return (
    <form ref={formRef} action={formAction} noValidate onSubmit={validation.onSubmit} onInput={validation.onInput}>
      {/* Lot 39b (UX-09) : la saisie est gardée et se reprend sur tout appareil. */}
      <DraftKeeper formKey="event-new" submission={state} saved={Boolean(state.created)} />
      <ErrorSummary errors={validation.errors} labels={{ standing: t("standingLegend"), name: t("newName") }} fieldId={validation.fieldId} summaryKey="summaryEvent" />
      <RequiredLegend text={tCommon("requiredLegend")} />
      <fieldset className="standing-choice" aria-describedby={validation.errorFor("standing") ? validation.errorId("standing") : undefined}>
        <legend>
          {t("standingLegend")}
          <RequiredMark />
        </legend>
        {EVENT_STANDINGS.map((standing, index) => (
          <label key={standing} className="standing-option">
            <input type="radio" name="standing" value={standing} {...(index === 0 ? validation.fieldProps("standing") : {})} />
            <span>
              <strong>{t(STANDING_KEYS[standing].title)}</strong>
              <span className="meta">{t(STANDING_KEYS[standing].hint)}</span>
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
      <button type="submit" className="button-primary" disabled={pending}>
        {t("createEvent")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
