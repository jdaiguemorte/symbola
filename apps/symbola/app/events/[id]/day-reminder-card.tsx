// Lot 66b (JRJ-01, HUB-28 ; D2, D3 ; M18) — sur l'onglet Programme d'un évènement : le rappel du jour J
// qui partira (qui, quand), et « Changer pour cet évènement » (couper, ou un autre moment ou une autre
// heure). Le module Évènements est ouvert (la page le vérifie).
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import type { DayReminderSetting } from "@symbola/contracts";
import { effectiveDayReminder, listDayReminderTargets } from "@/modules/hub/service";
import { listDayReminderOverrides } from "@/modules/events/service";
import { DayReminderForm } from "@/app/ui/day-reminder-form";
import { resetEventDayReminderAction, saveEventDayReminderAction } from "./day-reminder-actions";

export async function DayReminderCard({ organizationId, eventId }: { organizationId: string; eventId: string }) {
  const t = await getTranslations("DayReminder");
  const [organization, overrides] = await Promise.all([listDayReminderTargets(organizationId), listDayReminderOverrides(organizationId, eventId)]);
  const settings: DayReminderSetting[] = effectiveDayReminder(organization, overrides);
  const active = settings.filter((setting) => setting.enabled);
  return (
    <section aria-labelledby="day-reminder-title" className="places">
      <h3 id="day-reminder-title">{t("event.title")}</h3>
      {active.length === 0 ? (
        <p>{t("event.none")}</p>
      ) : (
        <ul>
          {active.map((setting) => (
            <li key={setting.target}>{t("event.item", { target: t(`targets.${setting.target}.label`), moment: t(`moments.${setting.moment}`), time: setting.sendTime })}</li>
          ))}
        </ul>
      )}
      {overrides.length > 0 ? <p className="field-hint">{t("event.custom")}</p> : null}
      <details>
        <summary>{t("event.change")}</summary>
        <DayReminderForm settings={settings} disabled={false} action={saveEventDayReminderAction} resetAction={resetEventDayReminderAction} eventId={eventId} submitLabel={t("event.saveEvent")} />
      </details>
      <p className="field-hint">
        <Link href="/parametres/automatisations/rappel-jour-j">{t("event.settings")} ›</Link>
      </p>
    </section>
  );
}
