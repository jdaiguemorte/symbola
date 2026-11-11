"use client";

// L16-SEC-03 (lot 16, ADR 0038) — appareils de confiance du compte : leur nombre, et
// « oublier mes appareils » (profil de l'équipe, sécurité de l'espace des mariés).
import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { forgetTrustedDevicesAction, type TrustedDevicesFormState } from "./trusted-devices-actions";

export function TrustedDevicesForm({ count }: { count: number }) {
  const t = useTranslations("TrustedDevices");
  const initialState: TrustedDevicesFormState = {};
  const [state, formAction, pending] = useActionState(forgetTrustedDevicesAction, initialState);
  const remaining = state.forgotten ? 0 : count;

  return (
    <section aria-labelledby="trusted-devices-title">
      <h2 id="trusted-devices-title">{t("title")}</h2>
      <p>{t("count", { count: remaining })}</p>
      {remaining > 0 ? (
        <form action={formAction}>
          <button type="submit" disabled={pending}>
            {t("forget")}
          </button>
        </form>
      ) : null}
      {state.forgotten ? <p role="status">{t("forgotten")}</p> : null}
    </section>
  );
}
