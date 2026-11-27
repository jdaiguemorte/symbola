"use client";

// Lot 71b (HUB-14, UX-10 ; maquette 06, « Saisir les noms et la date ») — le mariage qu'on reprend :
// « Nom de l'évènement * », « Date », « Client » (le champ de « Nouvel évènement », lot 70e), le type s'il
// y en a plusieurs. Les erreurs vont sous le champ (lot 70b) ; « Continuer la reprise » reste actif.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { ErrorSummary } from "@/app/ui/error-summary";
import { FieldError } from "@/app/ui/field-error";
import { useFieldValidation } from "@/app/ui/use-field-validation";
import { RequiredLegend, RequiredMark } from "@/app/ui/required-mark";
import { ContactPicker } from "@/app/contacts/contact-picker";
import type { Audience, ClientFieldLabels } from "@/lib/vocabulary";
import type { EventType } from "@/modules/events/service";
import { takeoverEventFieldsSchema } from "@/lib/forms/takeover-event-fields";
import { enterTakeoverEventAction, type TakeoverEventFormState } from "../actions";

export function TakeoverEventForm({
  takeoverId,
  eventTypes,
  clientLabels,
}: {
  takeoverId: string | null;
  eventTypes: Pick<EventType, "id" | "label" | "audience">[];
  clientLabels: Record<Audience, ClientFieldLabels>;
}) {
  const t = useTranslations("Takeover");
  const tEvents = useTranslations("Events");
  const tCommon = useTranslations("Common");
  const [state, formAction, pending] = useActionState(enterTakeoverEventAction, {} as TakeoverEventFormState);
  const validation = useFieldValidation(takeoverEventFieldsSchema, state.fieldErrors);
  const labels = clientLabels[eventTypes[0]?.audience ?? "couple"];

  return (
    <form action={formAction} noValidate onSubmit={validation.onSubmit} onInput={validation.onInput} className="takeover-event-form">
      {takeoverId ? <input type="hidden" name="takeoverId" value={takeoverId} /> : null}
      <ErrorSummary errors={validation.errors} labels={{ name: t("formName"), eventDate: t("formDate") }} fieldId={validation.fieldId} summaryKey="summaryEvent" />
      <RequiredLegend text={tCommon("requiredLegend")} />
      <label>
        {t("formName")}
        <RequiredMark />
        <input type="text" name="name" maxLength={200} autoComplete="off" placeholder={t("formNamePlaceholder")} {...validation.fieldProps("name")} />
        <FieldError id={validation.errorId("name")} message={validation.errorFor("name")} />
      </label>
      <label>
        {t("formDate")}
        <input type="date" name="eventDate" {...validation.fieldProps("eventDate")} />
        <FieldError id={validation.errorId("eventDate")} message={validation.errorFor("eventDate")} />
      </label>
      <ContactPicker name="contactId1" legend={tEvents("newClient")} searchLabel={tEvents("newClientHint")} initial={null}>
        <label>
          {labels.client1FirstName}
          <input type="text" name="firstName1" autoComplete="off" />
        </label>
        <label>
          {labels.client1LastName}
          <input type="text" name="lastName1" autoComplete="off" />
        </label>
      </ContactPicker>
      {eventTypes.length > 1 ? (
        <label>
          {t("formType")}
          <select name="eventTypeId" defaultValue={eventTypes[0]?.id}>
            {eventTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <div className="takeover-event-submit">
        <button type="submit" className="button-primary" disabled={pending}>
          {pending ? t("formSaving") : t("formSubmit")}
        </button>
      </div>
      {state.error ? <p role="alert">{state.error}</p> : null}
    </form>
  );
}
