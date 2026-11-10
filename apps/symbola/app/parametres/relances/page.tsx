// Lot 13 (HUB-15, HUB-16) — rubrique « Délais de relance » des Paramètres.
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { getFollowUpDelays } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { FollowUpForm } from "./follow-up-form";
import { ScreenHelp } from "@/app/screen-help";

export default async function FollowUpSettingsPage() {
  const auth = await requirePlanner();

  const t = await getTranslations("Settings");

  const tHelp = await getTranslations("Help");
  const db = appDatabase();
  const delays = await getFollowUpDelays(db, auth.user.organizationId);
  return (
    <main>
      <h1>{t("followUpTitle")}</h1>
      <ScreenHelp title={tHelp("followUps.title")} body={tHelp("followUps.body")} />
      <p>{t("followUpIntro")}</p>
      <FollowUpForm quoteDays={delays.quoteFollowUpDays} prospectDays={delays.prospectFollowUpDays} />
    </main>
  );
}
