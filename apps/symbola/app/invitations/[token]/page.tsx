// Lot 33 (HUB-02) — accueil d'une invitation : le nom de l'organisation, puis un bouton qui
// accepte et envoie un lien de connexion à l'adresse invitée. Une invitation échue ou déjà
// acceptée le dit, sans rien révéler d'autre.
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { ScreenHelp } from "@/app/screen-help";
import { describeInvitation } from "@/modules/hub/service";
import { AcceptInvitationForm } from "./form";

export default async function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("Invitation");
  const tHelp = await getTranslations("Help");
  const invitation = await describeInvitation(appDatabase(), token);
  return (
    <main>
      {invitation ? <h1>{t("welcome", { organization: invitation.organizationName })}</h1> : <h1>{t("invalidOrExpired")}</h1>}
      <ScreenHelp title={tHelp("invitation.title")} body={tHelp("invitation.body")} />
      {invitation ? <AcceptInvitationForm token={token} /> : null}
    </main>
  );
}
