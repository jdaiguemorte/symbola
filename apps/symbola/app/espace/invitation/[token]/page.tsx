import { createTranslator } from "next-intl";
import { getLocale, getTranslations } from "next-intl/server";
import type { Locale } from "@symbola/i18n";
import { ScreenHelp } from "@/app/screen-help";
import { getClientInvitationAudience } from "@/modules/events/service";
import { messagesFor } from "@/lib/vocabulary";
import { ClientInvitationForm } from "./form";

// EVT-06 — page publique du lien d'invitation : le jeton est vérifié à
// l'envoi du formulaire, jamais affiché ni journalisé.
export default async function ClientInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("ClientSpace");
  const tHelp = await getTranslations("Help");
  // Lot 16 (ADR 0045) : avant toute connexion, le vocabulaire vient du type de
  // l'événement de l'invitation (les mariés par défaut, comme avant).
  const locale = (await getLocale()) as Locale;
  const audience = (await getClientInvitationAudience(decodeURIComponent(token))) ?? "couple";
  const intro = createTranslator({ locale, messages: messagesFor(locale, audience), namespace: "ClientSpace" })("invitationIntro");

  return (
    <main>
      <h1>{t("invitationTitle")}</h1>
      <ScreenHelp title={tHelp("clientInvitation.title")} body={tHelp("clientInvitation.body")} />
      <p>{intro}</p>
      <ClientInvitationForm token={decodeURIComponent(token)} />
    </main>
  );
}
