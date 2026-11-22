"use client";

// Lot 65d (MSG-01, HUB-20 ; ADR 0110) — « Qui envoie les messages à vos clients et à vos prestataires ».
// Changer de réglage ne perd rien : les messages déjà préparés restent « À envoyer ».
import { useActionState, useId } from "react";
import { useTranslations } from "next-intl";
import type { RelationMailSender } from "@symbola/contracts";
import { saveRelationMailSenderAction, type SenderFormState } from "./sender-actions";

export function RelationMailSenderForm({ sender, disabled }: { sender: RelationMailSender; disabled: boolean }) {
  const t = useTranslations("EmailTemplates.sender");
  const [state, action, pending] = useActionState(saveRelationMailSenderAction, {} as SenderFormState);
  const id = useId();
  return (
    <form action={action} className="stack" aria-labelledby={`${id}-legend`}>
      <fieldset disabled={disabled}>
        <legend id={`${id}-legend`} className="sr-only">{t("legend")}</legend>
        <label>
          <input type="radio" name="sender" value="planner" defaultChecked={sender === "planner"} aria-describedby={`${id}-planner`} /> {t("planner")}
        </label>
        <p id={`${id}-planner`} className="field-hint">
          {t("plannerHint")}
        </p>
        <label>
          <input type="radio" name="sender" value="symbola" defaultChecked={sender === "symbola"} aria-describedby={`${id}-symbola`} /> {t("symbola")}
        </label>
        <p id={`${id}-symbola`} className="field-hint">
          {t("symbolaHint")}
        </p>
      </fieldset>
      <p className="meta">{t("technical")}</p>
      {disabled ? null : (
        <button type="submit" disabled={pending}>
          {t("save")}
        </button>
      )}
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.saved ? <p role="status">{t("saved")}</p> : null}
    </form>
  );
}
