"use client";

// Lot 63c (EVT-01, HUB-07, CHR-01 ; ADR 0106, maquette M7) — un seul formulaire pour les trois choix du
// bouton « Nouveau » : prospect, évènement confirmé (client facultatif) ou client existant. Trois
// champs suffisent : le type, la date et le nom du client (facultatif pour un évènement confirmé).
// Le rétroplanning du type est proposé (case cochée pour un évènement confirmé) ; un type sans
// modèle reçoit une astuce et un panneau pour en créer un, sans quitter le formulaire.
import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { DraftKeeper } from "@/app/ui/draft-keeper";
import { createProspectAction, type NewProspectFormState } from "./actions";
import type { EventType, ProspectSource } from "@/modules/events/service";
import type { Audience, ClientFieldLabels } from "@/lib/vocabulary";
import type { ContactChoice } from "@/app/contacts/actions";
import { ContactPicker } from "@/app/contacts/contact-picker";
import { SameDayNotice } from "../same-day-notice";
import { newEventRules, type NewEventMode } from "./new-event-mode";
import { QuickTemplatePanel, type ProposedTemplate } from "./quick-template-panel";

export function NewProspectForm({
  sources,
  eventTypes,
  clientLabels,
  templates,
  initialContact = null,
  initialDate = "",
  mode = "prospect",
}: {
  sources: ProspectSource[];
  eventTypes: EventType[];
  // Lot 16 (ADR 0045) : les libellés des clients suivent le type choisi.
  clientLabels: Record<Audience, ClientFieldLabels>;
  // Lot 63c (ADR 0106) : les modèles de rétroplanning rattachés à un type.
  templates: ProposedTemplate[];
  // Lot 36a (UX-02) : premier client déjà choisi (depuis la fiche d'un contact).
  initialContact?: ContactChoice | null;
  initialDate?: string;
  mode?: NewEventMode;
}) {
  const t = useTranslations("Events");
  const initialState: NewProspectFormState = {};
  const [state, formAction, pending] = useActionState(createProspectAction, initialState);
  const [eventTypeId, setEventTypeId] = useState(eventTypes[0]?.id ?? "");
  const [status, setStatus] = useState<"option" | "confirmed">("option");
  const confirmed = mode === "confirmed" || (mode === "client" && status === "confirmed");
  const rules = newEventRules(mode, confirmed);
  // Lot 32b (CRM-04) : la date suivie, pour signaler les évènements du même jour avant l'enregistrement.
  const [eventDate, setEventDate] = useState(initialDate);
  const eventType = eventTypes.find((type) => type.id === eventTypeId);
  const labels = clientLabels[eventType?.audience ?? "couple"];
  const tContacts = useTranslations("Contacts");
  // Les modèles créés dans le panneau s'ajoutent à ceux de la page.
  const [created, setCreated] = useState<ProposedTemplate[]>([]);
  const template = [...created, ...templates].find((candidate) => candidate.eventTypeId === eventTypeId) ?? null;
  // La case suit le choix (cochée pour un évènement confirmé) tant qu'elle n'a pas été touchée.
  const [templateChoice, setTemplateChoice] = useState<Record<string, boolean>>({});
  const templateChecked = template ? (templateChoice[`${template.id}:${confirmed}`] ?? rules.templateCheckedByDefault) : false;
  const [panelOpen, setPanelOpen] = useState(false);

  return (
    <>
      <form action={formAction}>
        {/* Lot 39b (UX-09) : la saisie est gardée et se reprend sur tout appareil. */}
        <DraftKeeper formKey={`event-new-${mode}`} submission={state} />
        <input type="hidden" name="mode" value={mode} />
        <p className="meta">{t("requiredLegend")}</p>
        {mode === "client" ? (
          <fieldset className="choice-row">
            <legend>{t("newStatusLegend")}</legend>
            <label>
              <input type="radio" name="status" value="option" checked={status === "option"} onChange={() => setStatus("option")} />
              {t("newStatusProspect")}
            </label>
            <label>
              <input type="radio" name="status" value="confirmed" checked={status === "confirmed"} onChange={() => setStatus("confirmed")} />
              {t("newStatusConfirmed")}
            </label>
          </fieldset>
        ) : null}
        <label>
          {t("eventType")} *
          <select name="eventTypeId" required value={eventTypeId} onChange={(event) => setEventTypeId(event.target.value)}>
            {eventTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("eventDate")}
          <input type="date" name="eventDate" value={eventDate} onChange={(event) => setEventDate(event.target.value)} />
        </label>
        <SameDayNotice date={eventDate} />
        {mode === "client" ? (
          <ContactPicker name="contactId1" legend={`${tContacts("pickerClient1")} *`} initial={initialContact} searchLabel={t("existingClientSearch")} />
        ) : (
          <ContactPicker name="contactId1" legend={rules.clientRequired ? `${tContacts("pickerClient1")} *` : t("clientOptionalLegend")} initial={initialContact}>
            <label>
              {labels.client1FirstName}
              {rules.clientRequired ? " *" : ""}
              <input type="text" name="firstName1" required={rules.clientRequired} />
            </label>
            <label>
              {labels.client1LastName}
              <input type="text" name="lastName1" />
            </label>
          </ContactPicker>
        )}
        <ContactPicker name="contactId2" legend={tContacts("pickerClient2")}>
          <label>
            {labels.client2FirstName}
            <input type="text" name="firstName2" />
          </label>
          <label>
            {labels.client2LastName}
            <input type="text" name="lastName2" />
          </label>
        </ContactPicker>
        <label>
          {t("source")}
          {rules.sourceRequired ? " *" : ""}
          <select name="prospectSourceId" required={rules.sourceRequired} defaultValue="">
            <option value="" disabled={rules.sourceRequired}>
              {rules.sourceRequired ? t("sourceChoose") : t("sourceNone")}
            </option>
            {sources.map((source) => (
              <option key={source.id} value={source.id}>
                {source.label}
              </option>
            ))}
          </select>
        </label>
        <label>
          {t("venueName")}
          <input type="text" name="venueName" />
        </label>
        <label>
          {t("venueCity")}
          <input type="text" name="venueCity" />
        </label>

        {/* Lot 63c (EVT-01, CHR-01 ; ADR 0106) : le rétroplanning proposé, jamais posé d'office. */}
        {template ? (
          <div className="template-proposal">
            <input type="hidden" name="taskTemplateId" value={template.id} />
            <label className="template-proposal-check">
              <input
                type="checkbox"
                name="applyTaskTemplate"
                value="1"
                checked={templateChecked && eventDate !== ""}
                disabled={eventDate === ""}
                onChange={(event) => setTemplateChoice({ ...templateChoice, [`${template.id}:${confirmed}`]: event.target.checked })}
              />
              <span>
                {t("templateProposal", { name: template.name, count: template.items.length })}
                <span className="meta">{eventDate === "" ? t("templateProposalNeedsDate") : t("templateProposalHint")}</span>
              </span>
            </label>
            <details>
              <summary>{t("templateProposalShow")}</summary>
              <ol className="template-proposal-tasks">
                {[...template.items]
                  .sort((a, b) => a.offsetDays - b.offsetDays)
                  .map((item, index) => (
                    <li key={`${item.label}-${index}`}>
                      {item.label} <span className="meta">{item.offsetDays === 0 ? t("offsetEventDay") : item.offsetDays < 0 ? t("offsetBefore", { days: -item.offsetDays }) : t("offsetAfter", { days: item.offsetDays })}</span>
                    </li>
                  ))}
              </ol>
            </details>
          </div>
        ) : eventType ? (
          <div className="notice template-tip">
            <p>{t("templateTip", { type: eventType.label })}</p>
            <button type="button" className="button-secondary" onClick={() => setPanelOpen(true)} aria-haspopup="dialog">
              {t("templateTipCreate", { type: eventType.label })}
            </button>
          </div>
        ) : null}

        <button type="submit" className="button-primary" disabled={pending}>
          {t(confirmed ? "createConfirmedEvent" : "createProspect")}
        </button>
        {state.error ? <p role="alert">{state.error}</p> : null}
      </form>
      {panelOpen && eventType ? (
        <QuickTemplatePanel
          eventTypeId={eventType.id}
          typeLabel={eventType.label}
          onClose={() => setPanelOpen(false)}
          onCreated={(createdTemplate) => {
            setCreated([createdTemplate, ...created]);
            setPanelOpen(false);
          }}
        />
      ) : null}
    </>
  );
}
