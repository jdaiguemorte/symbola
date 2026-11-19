// Lot 43 (FAC-09, FAC-15 ; D1, D7) — relances : avant l'expiration d'une proposition (une fois), et
// après une échéance impayée (J+3, J+10, J+20 au départ). Une relance s'arrête dès que le client
// déclare son virement ou que l'encaissement est confirmé ; la planner la suspend sur la fiche du devis.
import { getTranslations } from "next-intl/server";
import { ScreenHelp } from "@/app/screen-help";
import { requirePlanner } from "@/lib/guards";
import { getReminderSettings } from "@/modules/quotes/service";
import { isQuotesModuleEnabled } from "../module-access";
import { ReminderSettingsForm } from "./reminder-settings-form";

export default async function ReminderSettingsPage() {
  const auth = await requirePlanner();
  const t = await getTranslations("ReminderSettings");
  const tHelp = await getTranslations("Help");
  if (!(await isQuotesModuleEnabled(auth.user.organizationId))) {
    return (
      <main>
        <h1>{t("title")}</h1>
        <p>{t("moduleUnavailable")}</p>
      </main>
    );
  }
  const settings = await getReminderSettings(auth.user.organizationId);
  return (
    <main>
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("reminderSettings.title")} body={tHelp("reminderSettings.body")} />
      <p>{t("intro")}</p>
      <ReminderSettingsForm settings={settings} />
      <p role="note" className="meta">
        {t("lawyerNote")}
      </p>
    </main>
  );
}
