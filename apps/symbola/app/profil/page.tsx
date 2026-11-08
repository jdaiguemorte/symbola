import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { countTrustedDevices } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { requireSignedIn } from "@/lib/guards";
import { TrustedDevicesForm } from "../trusted-devices-form";
import { LanguageForm } from "./language-form";

export default async function ProfilePage() {
  const auth = await requireSignedIn();

  const t = await getTranslations("Profile");
  const tHelp = await getTranslations("Help");
  // SEC-03 : appareils de confiance (jamais pour l'Admin, ADR 0038).
  let trustedDevices: number | null = null;
  if (auth.user.role !== "admin") {
    const db = appDatabase();
    trustedDevices = await countTrustedDevices(db, auth.user.id);
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
