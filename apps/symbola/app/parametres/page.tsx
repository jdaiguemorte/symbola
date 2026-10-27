import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { createAppConnection } from "@symbola/db/client";
import { getOrganizationProfile } from "@/modules/hub/service";
import { getAuthContext } from "@/lib/auth-context";
import { ProfileForm } from "./profile-form";
import { VatRegimeForm } from "./vat-regime-form";

export default async function SettingsPage() {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (!auth.user.organizationId) redirect("/");

  const t = await getTranslations("Settings");
  const tHelp = await getTranslations("Help");
  const { sql, db } = createAppConnection();
  let profile;
  try {
    profile = await getOrganizationProfile(db, auth.user.organizationId);
  } finally {
    await sql.end();
  }

  return (
    <main>
      <h1>{t("title")}</h1>
      <HelpButton title={tHelp("settings.title")} body={tHelp("settings.body")} />
      <h2>{t("companyProfileTitle")}</h2>
      <ProfileForm profile={profile} />

      <h2>{t("vatRegimeTitle")}</h2>
      <VatRegimeForm currentRegime={profile.vatRegime} />
    </main>
  );
}
