"use client";

// Lot 33b (HUB-03, D12) — la Propriétaire invite une Planner par son adresse e-mail.
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { inviteMemberAction, type InviteMemberState } from "./actions";

export function InviteMemberForm() {
  const t = useTranslations("Team");
  const [state, action, pending] = useActionState<InviteMemberState, FormData>(inviteMemberAction, {});
  return (
    <form action={action} className="stack" key={state.sent ? "sent" : "form"}>
      <label>
        {t("inviteEmail")}
        <input type="email" name="email" required autoComplete="off" maxLength={254} />
      </label>
      <p className="muted">{t("inviteHint")}</p>
      <button type="submit" disabled={pending}>
        {t("inviteSubmit")}
      </button>
      {state.error ? <p role="alert">{state.error}</p> : null}
      {state.sent ? <p role="status">{t("inviteSent")}</p> : null}
    </form>
  );
}
