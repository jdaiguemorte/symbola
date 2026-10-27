import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { getClientAuthContext } from "@/lib/auth-context";
import { ClientMfaSetup } from "./mfa-forms";

// EVT-06 — sécurité du compte marié : double authentification facultative.
export default async function ClientSecurityPage() {
  const auth = await getClientAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect("/");

  const t = await getTranslations("ClientSpace");
  const tHelp = await getTranslations("Help");

  return (
    <main>
      <p>
        <Link href="/espace">{t("backToSpace")}</Link>
      </p>
      <h1>{t("securityTitle")}</h1>
      <HelpButton title={tHelp("clientSecurity.title")} body={tHelp("clientSecurity.body")} />
      <p>{t("mfaIntro")}</p>
      {auth.user.mfaEnabled ? <p role="status">{t("mfaAlreadyEnabled")}</p> : <ClientMfaSetup />}
    </main>
  );
}
