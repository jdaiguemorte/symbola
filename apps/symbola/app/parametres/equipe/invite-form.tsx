"use client";

// Lot 33b (HUB-03, D12) — la Propriétaire invite une Planner par son adresse e-mail.
// Lot 52 (HUB-04) : ou un Comptable, en lecture seule, avec double authentification exigée.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { inviteMemberAction, type InviteMemberState } from "./actions";

export function InviteMemberForm() {
  const t = useTranslations("Team");
  const [state, action, pending] = useActionState<InviteMemberState, FormData>(inviteMemberAction, {});
  return (
    <form action={action} className="stack" key={state.sent ? "sent" : "form"}>
      <label>
        {t("inviteEmailAny")}
        <input type="email" name="email" required autoComplete="off" maxLength={254} />
      </label>
      <fieldset>
        <legend>{t("inviteRole")}</legend>
        <label className="checkbox">
          <input type="radio" name="role" value="member" defaultChecked />
          {t("roles.member")}
        </label>
        <label className="checkbox">
          <input type="radio" name="role" value="accountant" />
          {t("roles.accountant")}
        </label>
      </fieldset>
      <p className="muted">{t("inviteHint")}</p>
      <p className="muted">{t("inviteHintAccountant")}</p>
      <button type="submit" disabled={pending}>
        {t("inviteSubmit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.sent ? <p role="status">{t("inviteSent")}</p> : null}
    </form>
  );
}
