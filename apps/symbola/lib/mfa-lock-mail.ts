// SEC-01 (lot 16, ADR 0037) — la double authentification vient d'être
// verrouillée après 5 codes faux : le mot de passe du compte est connu d'un
// tiers. Le titulaire est prévenu par un e-mail traduit (dans sa langue, sinon
// celle de l'écran) ; un échec d'envoi ne change pas la réponse à l'écran.
import { getLocale, getTranslations } from "next-intl/server";
import { sendMail } from "@symbola/mail";

export async function sendMfaLockMail(notify: { email: string; language: "fr" | "en" | null }): Promise<void> {
  const locale = notify.language ?? ((await getLocale()) === "en" ? "en" : "fr");
  const t = await getTranslations({ locale, namespace: "Mfa" });
  try {
    await sendMail({ to: notify.email, subject: t("lockedMailSubject"), text: t("lockedMailBody") });
  } catch (error) {
    // Journal sans donnée personnelle.
    console.error("double authentification verrouillée : envoi de l'e-mail impossible", error instanceof Error ? error.name : "erreur");
  }
}
