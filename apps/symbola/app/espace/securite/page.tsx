import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { countTrustedDevices } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { requireClient } from "@/lib/guards";
import { SignOutEverywhereForm } from "../../sign-out-everywhere-form";
import { TrustedDevicesForm } from "../../trusted-devices-form";
import { ClientMfaSetup } from "./mfa-forms";

// PRD-EVT-06 — sécurité du compte marié : double authentification facultative.
export default async function ClientSecurityPage() {
  const auth = await requireClient();

  const t = await getTranslations("ClientSpace");
  const tHelp = await getTranslations("Help");
  // L16-SEC-03 : appareils de confiance, une fois la double authentification activée.
  let trustedDevices: number | null = null;
  if (auth.user.mfaEnabled) {
    const db = appDatabase();
    trustedDevices = await countTrustedDevices(db, auth.user.id);
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
      {/* Lot 24b (SEC-06) : déconnexion à distance. */}
      <SignOutEverywhereForm />
    </main>
  );
}
