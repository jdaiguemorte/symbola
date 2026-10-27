import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { MfaForm } from "./mfa-form";
import { getMfaSetupState } from "./actions";

export default async function MfaPage() {
  const state = await getMfaSetupState();
  if (!state) redirect("/login");
  const t = await getTranslations("Mfa");
  const tHelp = await getTranslations("Help");

  return (
    <main>
      <h1>{t("title")}</h1>
      <HelpButton title={tHelp("mfa.title")} body={tHelp("mfa.body")} />
      {state.provisioningUri ? (
        <>
          <p>{t("scanInstructions")}</p>
          <code>{state.provisioningUri}</code>
        </>
      ) : (
        <p>{t("enterCodeInstructions")}</p>
      )}
      <MfaForm />
    </main>
  );
}
