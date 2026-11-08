import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { countTrustedDevices } from "@symbola/auth";
import { createAppConnection } from "@symbola/db/client";
import { getAuthContext } from "@/lib/auth-context";
import { TrustedDevicesForm } from "../trusted-devices-form";
import { LanguageForm } from "./language-form";

export default async function ProfilePage() {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");

  const t = await getTranslations("Profile");
  const tHelp = await getTranslations("Help");
  // SEC-03 : appareils de confiance (jamais pour l'Admin, ADR 0038).
  let trustedDevices: number | null = null;
  if (auth.user.role !== "admin") {
    const { sql, db } = createAppConnection();
    try {
      trustedDevices = await countTrustedDevices(db, auth.user.id);
    } finally {
      await sql.end();
    }
  }

  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("profile.title")} body={tHelp("profile.body")} />
      <LanguageForm currentLanguage={auth.user.language ?? "fr"} />
      {trustedDevices !== null ? <TrustedDevicesForm count={trustedDevices} /> : null}
    </main>
  );
}
