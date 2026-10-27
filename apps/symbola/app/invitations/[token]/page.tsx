import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { AcceptInvitationForm } from "./form";

export default async function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("Invitation");
  const tHelp = await getTranslations("Help");

  return (
    <main>
      <h1>{t("welcome")}</h1>
      <HelpButton title={tHelp("invitation.title")} body={tHelp("invitation.body")} />
      <AcceptInvitationForm token={token} />
    </main>
  );
}
