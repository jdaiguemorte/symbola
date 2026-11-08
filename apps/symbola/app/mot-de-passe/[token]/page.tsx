// Lot 9 (ADR 0029) — nouveau mot de passe par le lien reçu (30 minutes,
// usage unique). Un lien périmé propose d'en demander un autre.
import { getTranslations } from "next-intl/server";
import { isPasswordResetTokenValid } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { ResetPasswordForm } from "./form";

export default async function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("PasswordReset");
  const db = appDatabase();
  let valid = false;
  valid = await isPasswordResetTokenValid(db, token);

  return (
    <main>
      <h1>{t("resetTitle")}</h1>
      {valid ? (
        <ResetPasswordForm token={token} />
      ) : (
        <>
          <p role="alert">{t("invalidOrExpired")}</p>
          <p>
            <a href="/mot-de-passe-oublie">{t("askAgain")}</a>
          </p>
        </>
      )}
    </main>
  );
}
