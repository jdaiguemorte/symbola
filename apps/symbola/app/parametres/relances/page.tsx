// Lot 13 (HUB-15, HUB-16) — rubrique « Délais de relance » des Paramètres.
import { getTranslations } from "next-intl/server";
import { appDatabase } from "@symbola/db/client";
import { getFollowUpDelays } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { FollowUpForm } from "./follow-up-form";

export default async function FollowUpSettingsPage() {
  const auth = await requirePlanner();

  const t = await getTranslations("Settings");
  const db = appDatabase();
  const delays = await getFollowUpDelays(db, auth.user.organizationId);
  return (
    <main>
      <h1>{t("followUpTitle")}</h1>
      <p>{t("followUpIntro")}</p>
      <FollowUpForm quoteDays={delays.quoteFollowUpDays} prospectDays={delays.prospectFollowUpDays} />
    </main>
  );
}
