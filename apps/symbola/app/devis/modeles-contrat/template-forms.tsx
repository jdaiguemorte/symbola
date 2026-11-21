"use client";

// Lot 31b (FAC-04, HUB-21, JUR-20 ; D7, partie N) — formulaires des modèles de contrat : en-tête
// (nom, titre, type d'événement, date de la dernière revue juridique), clauses (titre, texte à
// variables, facultative, rôle légal), duplication.
import { useActionState, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { ContractTemplateClause, ContractTemplateView } from "@/modules/quotes/service";
import {
  addContractClauseAction,
  createContractTemplateAction,
  duplicateContractTemplateAction,
  updateContractClauseAction,
  updateContractTemplateAction,
  type ContractTemplateFormState,
} from "./actions";

export const CLAUSE_ROLES = ["precontractual_information", "withdrawal_period", "withdrawal_form", "early_execution", "termination", "no_withdrawal", "advance_deposit", "advance_earnest"] as const;

function Feedback({ state, success }: { state: ContractTemplateFormState; success: string }) {
  return (
    <>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{success}</p> : null}
    </>
  );
}

function HeaderFields({ template, eventTypes }: { template?: ContractTemplateView; eventTypes: { id: string; label: string }[] }) {
  const t = useTranslations("Contracts");
  return (
    // Lot 62d (UX-12) : formulaire en grille — nom et titre côte à côte, puis le type d'événement, la
    // nature du modèle et la date de revue (champ court) sur une ligne.
    <div className="form-grid form-grid-3">
      <label>
        {t("templateName")}
        <input type="text" name="name" maxLength={120} required defaultValue={template?.name ?? ""} />
      </label>
      <label>
        {t("templateTitle")}
        <input type="text" name="title" maxLength={200} required defaultValue={template?.title ?? t("templateTitleDefault")} />
      </label>
      <label>
        {t("templateEventType")}
        <select name="eventTypeId" defaultValue={template?.eventTypeId ?? ""}>
          <option value="">{t("templateAllEventTypes")}</option>
          {eventTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.label}
            </option>
          ))}
        </select>
      </label>
      {/* Lot 48b (JUR-10, DOC-02 ; D7) : seul un modèle « forfait touristique » sert un devis qui en réunit un. */}
      <label>
        {t("templateKind")}
        <select name="kind" defaultValue={template?.kind ?? "contract"}>
          <option value="contract">{t("templateKindContract")}</option>
          <option value="mandate">{t("templateKindMandate")}</option>
          <option value="general_terms">{t("templateKindGeneralTerms")}</option>
          <option value="package_travel">{t("templateKindPackageTravel")}</option>
        </select>
      </label>
      <label>
        {t("templateReviewedOn")}
        <input type="date" name="legalReviewedOn" defaultValue={template?.legalReviewedOn ?? ""} aria-describedby="reviewed-on-hint" className="field-date" />
      </label>
      <p id="reviewed-on-hint" className="field-hint span-all">
        {t("templateReviewedOnHint")}
      </p>
    </div>
  );
}

export function CreateContractTemplateForm({ eventTypes }: { eventTypes: { id: string; label: string }[] }) {
  const t = useTranslations("Contracts");
  const [state, action, pending] = useActionState(createContractTemplateAction, {} as ContractTemplateFormState);
  return (
    <form action={action} aria-label={t("createTemplate")}>
      <HeaderFields eventTypes={eventTypes} />
      <button type="submit" disabled={pending}>
        {t("createTemplate")}
      </button>
      <Feedback state={state} success="" />
    </form>
  );
}

export function UpdateContractTemplateForm({ template, eventTypes }: { template: ContractTemplateView; eventTypes: { id: string; label: string }[] }) {
  const t = useTranslations("Contracts");
  const [state, action, pending] = useActionState(updateContractTemplateAction, {} as ContractTemplateFormState);
  return (
    <form action={action} aria-label={t("updateTemplate")}>
      <input type="hidden" name="templateId" value={template.id} />
      <HeaderFields template={template} eventTypes={eventTypes} />
      <button type="submit" disabled={pending}>
        {t("updateTemplate")}
      </button>
      <Feedback state={state} success={t("templateSaved")} />
    </form>
  );
}

function ClauseFields({ clause }: { clause?: ContractTemplateClause }) {
  const t = useTranslations("Contracts");
  const id = (field: string) => `clause-${clause?.id ?? "new"}-${field}`;
  return (
    // Lot 62d (UX-12) : le titre et le rôle légal côte à côte, le texte sur toute la largeur.
    <div className="form-grid">
      <label htmlFor={id("title")}>
        {t("clauseTitle")}
        <input id={id("title")} type="text" name="title" maxLength={200} required defaultValue={clause?.title ?? ""} />
      </label>
      <label>
        {t("clauseRole")}
        <select name="role" defaultValue={clause?.role ?? ""}>
          <option value="">{t("role_none")}</option>
          {CLAUSE_ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`role_${role}`)}
            </option>
          ))}
        </select>
      </label>
      <label htmlFor={id("body")} className="span-all">
        {t("clauseBody")}
        <textarea id={id("body")} name="body" rows={6} maxLength={20000} defaultValue={clause?.body ?? ""} aria-describedby="variables-title" />
      </label>
      <label className="span-all">
        <input type="checkbox" name="optional" defaultChecked={clause?.optional ?? false} /> {t("clauseOptional")}
      </label>
    </div>
  );
}

export function UpdateClauseForm({ clause }: { clause: ContractTemplateClause }) {
  const t = useTranslations("Contracts");
  const [state, action, pending] = useActionState(updateContractClauseAction, {} as ContractTemplateFormState);
  return (
    <form action={action} aria-label={t("updateClauseNamed", { title: clause.title })}>
      <input type="hidden" name="clauseId" value={clause.id} />
      <ClauseFields clause={clause} />
      <button type="submit" disabled={pending} className="button-secondary">
        {t("updateClause")}
      </button>
      <Feedback state={state} success={t("clauseSaved")} />
    </form>
  );
}

export function AddClauseForm({ templateId }: { templateId: string }) {
  const t = useTranslations("Contracts");
  const [state, action, pending] = useActionState(addContractClauseAction, {} as ContractTemplateFormState);
  return (
    <form action={action} aria-label={t("addClause")}>
      <input type="hidden" name="templateId" value={templateId} />
      <ClauseFields />
      <button type="submit" disabled={pending} className="button-secondary">
        {t("addClause")}
      </button>
      <Feedback state={state} success={t("clauseAdded")} />
    </form>
  );
}

export function DuplicateContractTemplateForm({ template, children }: { template: ContractTemplateView; children?: ReactNode }) {
  const t = useTranslations("Contracts");
  const [state, action, pending] = useActionState(duplicateContractTemplateAction, {} as ContractTemplateFormState);
  return (
    <form action={action} aria-label={t("duplicateTemplateNamed", { name: template.name })}>
      <input type="hidden" name="templateId" value={template.id} />
      <input type="hidden" name="sourceName" value={template.name} />
      {children}
      <button type="submit" disabled={pending}>
        {t("duplicateTemplateNamed", { name: template.name })}
      </button>
      <Feedback state={state} success={t("templateDuplicated")} />
    </form>
  );
}
