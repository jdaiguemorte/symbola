"use client";

// Lot 33b (PAR-01, étape 5) — le premier évènement en trois réponses : type, prénoms des clients,
// date. Les libellés des clients suivent le type choisi (« les mariés » ou « le client »).
// Lot 63c (EVT-01 ; ADR 0106) : l'évènement est confirmé ; le rétroplanning de son type est proposé,
// case cochée, jamais posé d'office.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import type { EventType } from "@/modules/events/service";
import type { Audience, ClientFieldLabels } from "@/lib/vocabulary";
import { SameDayNotice } from "@/app/events/same-day-notice";
import { DraftKeeper } from "@/app/ui/draft-keeper";
import { createFirstEventAction, type FirstEventFormState } from "./actions";

type ProposedTemplate = { id: string; name: string; eventTypeId: string; count: number };

// Lot 71b (PAR-01 ; I5, R3) : en bouton plein quand la planner part de zéro ; en second quand elle reprend
// d'abord un mariage en cours.
export function FirstEventForm({ eventTypes, clientLabels, templates = [], primary = false }: { eventTypes: Pick<EventType, "id" | "label" | "audience">[]; clientLabels: Record<Audience, ClientFieldLabels>; templates?: ProposedTemplate[]; primary?: boolean }) {
  const t = useTranslations("Onboarding");
  const tEvents = useTranslations("Events");
  const [state, action, pending] = useActionState<FirstEventFormState, FormData>(createFirstEventAction, {});
  const [eventTypeId, setEventTypeId] = useState(eventTypes[0]?.id ?? "");
  const [eventDate, setEventDate] = useState("");
  const labels = clientLabels[eventTypes.find((type) => type.id === eventTypeId)?.audience ?? "couple"];
  const template = templates.find((candidate) => candidate.eventTypeId === eventTypeId) ?? null;
  const [declined, setDeclined] = useState<Record<string, boolean>>({});

  return (
    <form action={action} className="stack">
      {/* Lot 39b (UX-09) : SC-01 étape 7, la saisie se reprend sur un autre appareil. */}
      <DraftKeeper formKey="event-first" submission={state} />
      <label>
        {tEvents("eventType")}
        <select name="eventTypeId" required value={eventTypeId} onChange={(event) => setEventTypeId(event.target.value)}>
          {eventTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      <label>
        {labels.client1FirstName}
        <input type="text" name="firstName1" required maxLength={120} autoComplete="off" />
      </label>
      <label>
        {labels.client2FirstName}
        <input type="text" name="firstName2" maxLength={120} autoComplete="off" />
      </label>
      <label>
        {tEvents("eventDate")}
        <input type="date" name="eventDate" required value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
      </label>
      <SameDayNotice date={eventDate} />
      {template ? (
        <label className="template-proposal-check">
          <input type="hidden" name="taskTemplateId" value={template.id} />
          <input type="checkbox" name="applyTaskTemplate" value="1" checked={!declined[template.id]} onChange={(event) => setDeclined({ ...declined, [template.id]: !event.target.checked })} />
          <span>
            {tEvents("templateProposal", { name: template.name, count: template.count })}
            <span className="meta">{tEvents("templateProposalHint")}</span>
          </span>
        </label>
      ) : null}
      {state.error ? <p role="alert">{state.error}</p> : null}
      <button type="submit" className={primary ? "button-primary" : undefined} disabled={pending}>
        {t("ready.firstEventSubmit")}
      </button>
    </form>
  );
}
