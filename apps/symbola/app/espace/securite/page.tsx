import Link from "next/link";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { countTrustedDevices } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { getClientAuthContext } from "@/lib/auth-context";
import { TrustedDevicesForm } from "../../trusted-devices-form";
import { ClientMfaSetup } from "./mfa-forms";

// EVT-06 — sécurité du compte marié : double authentification facultative.
export default async function ClientSecurityPage() {
  const auth = await getClientAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect("/");

  const t = await getTranslations("ClientSpace");
  const tHelp = await getTranslations("Help");
  // SEC-03 : appareils de confiance, une fois la double authentification activée.
  let trustedDevices: number | null = null;
  if (auth.user.mfaEnabled) {
    const { sql, db } = createAppConnection();
    try {
      trustedDevices = await countTrustedDevices(db, auth.user.id);
    } finally {
      await sql.end();
    }
  }

  return (
    <main>
      <p>
        <Link href="/espace">{t("backToSpace")}</Link>
      </p>
      <h1>{t("securityTitle")}</h1>
      <ScreenHelp title={tHelp("clientSecurity.title")} body={tHelp("clientSecurity.body")} />
      <p>{t("mfaIntro")}</p>
      {auth.user.mfaEnabled ? <p role="status">{t("mfaAlreadyEnabled")}</p> : <ClientMfaSetup />}
      {trustedDevices !== null ? <TrustedDevicesForm count={trustedDevices} /> : null}
    </main>
  );
}
