import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { HelpButton } from "@symbola/ui";
import { listLossReasons, listProspectSources } from "@/modules/events/service";
import { getAuthContext } from "@/lib/auth-context";
import { isEventsModuleEnabled } from "../module-access";
import { ProspectSourceForm } from "./prospect-source-form";
import { LossReasonForm } from "./loss-reason-form";

export default async function EventsSettingsPage() {
  const auth = await getAuthContext();
  if (auth.status === "unauthenticated") redirect("/login");
  if (auth.status === "mfa_required") redirect("/mfa");
  if (!auth.user.organizationId) redirect("/");
  const organizationId = auth.user.organizationId;

  const t = await getTranslations("Events");
  const tHelp = await getTranslations("Help");
  if (!(await isEventsModuleEnabled(auth.user.organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const [sources, reasons] = await Promise.all([listProspectSources(organizationId), listLossReasons(organizationId)]);

  return (
    <main>
      <h1>{t("settingsTitle")}</h1>
      <HelpButton title={tHelp("eventsSettings.title")} body={tHelp("eventsSettings.body")} />

      <h2>{t("sourcesTitle")}</h2>
      <ul>
        {sources.map((source) => (
          <li key={source.id}>{source.label}</li>
        ))}
      </ul>
      <ProspectSourceForm />

      <h2>{t("lossReasonsTitle")}</h2>
      <ul>
        {reasons.map((reason) => (
          <li key={reason.id}>
            {reason.label}
            {reason.isFreeText ? ` (${t("freeTextTag")})` : ""}
          </li>
        ))}
      </ul>
      <LossReasonForm />
    </main>
  );
}
