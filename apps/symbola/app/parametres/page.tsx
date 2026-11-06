import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { createAppConnection } from "@symbola/db/client";
import { getFollowUpDelays, getOrganizationProfile } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { ProfileForm } from "./profile-form";
import { VatRegimeForm } from "./vat-regime-form";
import { FollowUpForm } from "./follow-up-form";

export default async function SettingsPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");

  const t = await getTranslations("Settings");
  const tHelp = await getTranslations("Help");
  const { sql, db } = createAppConnection();
  let profile;
  let delays;
  try {
    profile = await getOrganizationProfile(db, auth.user.organizationId);
    delays = await getFollowUpDelays(db, auth.user.organizationId);
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

      <h2 id="relances">{t("followUpTitle")}</h2>
      <p>{t("followUpIntro")}</p>
      <FollowUpForm quoteDays={delays.quoteFollowUpDays} prospectDays={delays.prospectFollowUpDays} />
    </main>
  );
}
