"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { TotpSetup } from "../../totp-setup";
import { confirmClientMfaAction, startClientMfaAction, type ClientMfaFormState } from "./actions";

export function ClientMfaSetup() {
  const t = useTranslations("ClientSpace");
  const tMfa = useTranslations("Mfa");
  const initialState: ClientMfaFormState = {};
  const [started, startAction, starting] = useActionState(startClientMfaAction, initialState);
  const [confirmed, confirmAction, confirming] = useActionState(confirmClientMfaAction, initialState);
  const [code, setCode] = useState("");

  if (confirmed.enabled || started.enabled) return <p role="status">{t("mfaEnabledNow")}</p>;

  if (!started.setup) {
    return (
      <form action={startAction}>
        <button type="submit" disabled={starting}>
          {t("mfaStart")}
        </button>
        {started.error ? <p role="alert">{started.error}</p> : null}
      </form>
    );
  }

  return (
    <form action={confirmAction}>
      <p>{t("mfaScanInstructions")}</p>
      <TotpSetup display={started.setup} labels={{ qr: tMfa("qrLabel"), manualKey: tMfa("manualKey"), setupLink: tMfa("setupLink") }} />
      <label>
        {t("mfaCode")}
        <input
          type="text"
          name="code"
          inputMode="numeric"
          autoComplete="one-time-code"
          required
          value={code}
          onChange={(event) => setCode(event.target.value)}
        />
      </label>
      <button type="submit" disabled={confirming}>
        {t("mfaConfirm")}
      </button>
      {confirmed.error ? <p role="alert">{confirmed.error}</p> : null}
    </form>
  );
}
