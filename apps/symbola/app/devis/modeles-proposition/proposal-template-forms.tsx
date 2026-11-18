"use client";

// Lot 43 (FAC-02, HUB-21 ; D2) — le modèle de la page de proposition : mot d'accueil, place de chaque
// bloc (ou masqué ; le devis toujours présent), pour tous les évènements ou un type.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { PROPOSAL_BLOCKS, type ProposalTemplateView } from "@symbola/contracts";
import { FreeTextNotice } from "@/app/ui/free-text-notice";
import { saveProposalTemplateAction, type ProposalTemplateState } from "./actions";

export function ProposalTemplateForm({ template, eventTypes, formId }: { template: ProposalTemplateView | null; eventTypes: { id: string; label: string }[]; formId: string }) {
  const t = useTranslations("ProposalTemplates");
  const [state, action, pending] = useActionState(saveProposalTemplateAction, {} as ProposalTemplateState);
  const id = (name: string) => `${formId}-${name}`;
  const placeOf = (block: string) => (template ? template.blocks.indexOf(block as never) + 1 : PROPOSAL_BLOCKS.indexOf(block as never) + 1);
  return (
    <form action={action} aria-label={template ? t("editForm") : t("newForm")}>
      {template ? (
        <input type="hidden" name="eventTypeId" value={template.eventTypeId ?? ""} />
      ) : (
        <>
          <label htmlFor={id("type")}>{t("eventType")}</label>
          <select id={id("type")} name="eventTypeId" required>
            {eventTypes.map((type) => (
              <option key={type.id} value={type.id}>
                {type.label}
              </option>
            ))}
          </select>
        </>
      )}
      <label htmlFor={id("greeting")}>{t("greeting")}</label>
      <textarea id={id("greeting")} name="greeting" rows={6} maxLength={4000} required defaultValue={template?.greeting ?? ""} />
      <FreeTextNotice />
      <fieldset>
        <legend>{t("blocksLegend")}</legend>
        <p className="meta">{t("blocksHint")}</p>
        {PROPOSAL_BLOCKS.map((block) => (
          <p key={block}>
            <label htmlFor={id(`place-${block}`)}>{t(`blocks.${block}`)}</label>
            <select id={id(`place-${block}`)} name={`place-${block}`} defaultValue={String(Math.max(0, placeOf(block)))}>
              {block === "quote" ? null : <option value="0">{t("hidden")}</option>}
              {PROPOSAL_BLOCKS.map((_, index) => (
                <option key={index} value={String(index + 1)}>
                  {t("place", { place: index + 1 })}
                </option>
              ))}
            </select>
          </p>
        ))}
      </fieldset>
      <button type="submit" disabled={pending}>
        {t("save")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.success ? <p role="status">{t("saved")}</p> : null}
    </form>
  );
}
