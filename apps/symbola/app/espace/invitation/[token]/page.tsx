import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { ClientInvitationForm } from "./form";

// EVT-06 — page publique du lien d'invitation : le jeton est vérifié à
// l'envoi du formulaire, jamais affiché ni journalisé.
export default async function ClientInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("ClientSpace");
  const tHelp = await getTranslations("Help");

  return (
    <main>
      <h1>{t("invitationTitle")}</h1>
      <HelpButton title={tHelp("clientInvitation.title")} body={tHelp("clientInvitation.body")} />
      <p>{t("invitationIntro")}</p>
      <ClientInvitationForm token={decodeURIComponent(token)} />
    </main>
  );
}
