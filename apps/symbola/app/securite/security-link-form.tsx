"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { sendSecurityLinkAction, type SecurityLinkState } from "./actions";

export function SecurityLinkForm() {
  const t = useTranslations("Security");
  const initial: SecurityLinkState = {};
  const [state, formAction, pending] = useActionState(sendSecurityLinkAction, initial);
  if (state.sent) return <p role="status">{t("linkSent")}</p>;
  return (
    <form action={formAction}>
      <button type="submit" disabled={pending}>
        {t("signInAgain")}
      </button>
    </form>
  );
}
