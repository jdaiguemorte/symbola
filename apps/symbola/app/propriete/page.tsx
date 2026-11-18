// Lot 52 (HUB-04 ; D1 ; ADR 0094) — confirmation du transfert de propriété par la Planner désignée. Le
// jeton suit « # » (jamais dans les journaux) et part en POST quand elle confirme, connectée avec sa
// double authentification. Sans session, la page l'invite à se connecter puis à rouvrir le lien.
import { getTranslations } from "next-intl/server";
import { getAuthContext } from "@/lib/auth-context";
import { ConfirmOwnershipForm } from "./confirm-form";

export default async function OwnershipPage() {
  const auth = await getAuthContext();
  const t = await getTranslations("Ownership");
  const signedIn = auth.status === "authenticated";
  return (
    <main>
      <h1>{t("title")}</h1>
      <p>{t("body")}</p>
      {signedIn ? (
        auth.user.mfaEnabled ? (
          <ConfirmOwnershipForm />
        ) : (
          <p role="alert">{t("mfaRequired")}</p>
        )
      ) : (
        <p>
          {t("signInFirst")} <a href="/login">{t("signIn")}</a>
        </p>
      )}
    </main>
  );
}
