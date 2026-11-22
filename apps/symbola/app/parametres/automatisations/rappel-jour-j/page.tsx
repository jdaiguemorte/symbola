// Lot 66b (JRJ-01, HUB-28 ; D2 à D4 ; M18 ; ADR 0112) — Paramètres › Automatisations › Rappel du jour
// J : qui le reçoit (la planner cochée au départ), la veille ou le matin même, à quelle heure ; les quatre
// modèles s'adaptent dans Paramètres › Modèles d'e-mails. Envoyé par Symbola.
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
      <h1>{t("title")}</h1>
      <ScreenHelp title={tHelp("dayReminder.title")} body={tHelp("dayReminder.body")} />
      <p>{t("intro")}</p>
      {isOwner ? null : <p role="status">{t("ownerOnly")}</p>}
      <DayReminderForm settings={settings} disabled={!isOwner} action={saveDayReminderAction} submitLabel={t("save")} />
      <p>
        <Link href="/parametres/emails#email-templates-dayOf">{t("templatesLink")} ›</Link>
      </p>
      <p className="field-hint">{t("rules")}</p>
    </main>
  );
}
