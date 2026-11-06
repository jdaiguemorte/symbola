// Lot 13 (HUB-15, HUB-16) — rubrique « Délais de relance » des Paramètres.
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { createAppConnection } from "@symbola/db/client";
import { getFollowUpDelays } from "@/modules/hub/service";
import { getPlannerAuthContext } from "@/lib/auth-context";
import { FollowUpForm } from "./follow-up-form";

export default async function FollowUpSettingsPage() {
  const auth = await getPlannerAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (auth.status === "forbidden") redirect(auth.role === "client" ? "/espace" : "/");
  if (!auth.user.organizationId) redirect("/");

  const t = await getTranslations("Settings");
  const { sql, db } = createAppConnection();
  let delays;
  try {
    delays = await getFollowUpDelays(db, auth.user.organizationId);
  } finally {
    await sql.end();
  }
  return (
    <main>
      <h1>{t("followUpTitle")}</h1>
      <p>{t("followUpIntro")}</p>
      <FollowUpForm quoteDays={delays.quoteFollowUpDays} prospectDays={delays.prospectFollowUpDays} />
    </main>
  );
}
