// Lot 66b (JRJ-01, HUB-28 ; D2 à D4 ; M18 ; ADR 0112) — Paramètres › Automatisations › Rappel du jour
// J : qui le reçoit (la planner cochée au départ), la veille ou le matin même, à quelle heure ; les quatre
// modèles s'adaptent dans Paramètres › Modèles d'e-mails. Envoyé par Symbola.
// Lot 74h (D7 ; page 30) : sous-écran d'« Automatismes », sous l'en-tête commun ; son formulaire (cibles
// liées) garde son bouton, partagé avec la fiche d'un évènement.
import { SettingsHeader } from "@/app/ui/settings-header";
import { settingsScopeLine } from "@/lib/settings/settings-header-texts";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { listDayReminderTargets } from "@/modules/hub/service";
import { requirePlanner } from "@/lib/guards";
import { ScreenHelp } from "@/app/screen-help";
import { DayReminderForm } from "@/app/ui/day-reminder-form";
import { saveDayReminderAction } from "./actions";

export default async function DayReminderSettingsPage() {
  const auth = await requirePlanner();
  const t = await getTranslations("DayReminder");
  const tHelp = await getTranslations("Help");
  const isOwner = auth.user.role === "owner";
  const settings = await listDayReminderTargets(auth.user.organizationId);
  return (
    <main className="stack">
      <p>
        <Link href="/parametres/automatisations">‹ {t("back")}</Link>
      </p>
      <SettingsHeader title={t("title")} hint={t("intro")} scope={await settingsScopeLine({ scope: "agency", editors: "owner", saving: "none", isOwner })} />
      <ScreenHelp title={tHelp("dayReminder.title")} body={tHelp("dayReminder.body")} />
      <DayReminderForm settings={settings} disabled={!isOwner} action={saveDayReminderAction} submitLabel={t("save")} />
      <p>
        <Link href="/parametres/emails#email-templates-dayOf">{t("templatesLink")} ›</Link>
      </p>
      <p className="field-hint">{t("rules")}</p>
    </main>
  );
}
