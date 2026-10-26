import { getTranslations } from "next-intl/server";
import { AcceptInvitationForm } from "./form";

export default async function AcceptInvitationPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const t = await getTranslations("Invitation");

  return (
    <main>
      <h1>{t("welcome")}</h1>
      <AcceptInvitationForm token={token} />
    </main>
  );
}
