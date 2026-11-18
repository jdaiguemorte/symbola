// Lot 52 (SEC-08 ; ADR 0094) — « Ce n'est pas moi », depuis l'alerte de nouvel appareil. Le jeton suit
// « # » : il n'atteint jamais le serveur ni ses journaux par l'adresse ; la page le lit et l'envoie en
// POST quand la personne confirme (un robot de messagerie qui ouvre le lien ne ferme rien). Page
// publique, sans session.
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { accountCenterUrl } from "@/lib/identity";
import { DisownForm } from "./disown-form";

export default async function DisownPage() {
  const t = await getTranslations("Security");
  const tHelp = await getTranslations("Help");
  return (
    <main className="link-page">
      <h1>{t("notMeTitle")}</h1>
      <ScreenHelp title={tHelp("notMe.title")} body={tHelp("notMe.body")} />
      <p>{t("notMeBody")}</p>
      <DisownForm accountCenter={accountCenterUrl()} />
    </main>
  );
}
