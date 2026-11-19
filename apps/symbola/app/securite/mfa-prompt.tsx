// Lot 52 (SEC-02 ; D5 ; ADR 0094) — bandeau discret « Sécurisez votre compte », proposé aux Planners dont
// la session s'est ouverte sans second facteur : un lien vers le centre de compte (clé d'accès ou
// application d'authentification) et « Plus tard », qui le ferme pour un mois.
import { getTranslations } from "next-intl/server";
import { dismissMfaPromptAction } from "./actions";

export async function MfaPromptBanner({ accountCenter }: { accountCenter: string }) {
  const t = await getTranslations("Security");
  return (
    <aside className="mfa-prompt" aria-label={t("promptLabel")}>
      <p>{t("promptBody")}</p>
      <div className="mfa-prompt-actions">
        <a className="button-ghost" href={accountCenter}>
          {t("promptAction")}
        </a>
        <form action={dismissMfaPromptAction}>
          <button type="submit" className="button-link">
            {t("promptLater")}
          </button>
        </form>
      </div>
    </aside>
  );
}
