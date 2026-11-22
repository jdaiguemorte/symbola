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
  const summary = active.length === 0 ? t("event.none") : active.map((setting) => t("event.item", { target: t(`targets.${setting.target}.label`), moment: t(`moments.${setting.moment}`), time: setting.sendTime })).join(" ; ");
  // Une seule ligne repliée (UX-13 : l'onglet Programme reste court) ; le réglage s'ouvre en dessous.
  return (
    <section aria-label={t("event.title")} className="places">
      <details>
        <summary>
          <strong>{t("event.title")}</strong> — {summary}
          {overrides.length > 0 ? <> · {t("event.custom")}</> : null}
        </summary>
        <p className="field-hint">{t("event.change")}</p>
        <DayReminderForm settings={settings} disabled={false} action={saveEventDayReminderAction} resetAction={resetEventDayReminderAction} eventId={eventId} submitLabel={t("event.saveEvent")} />
        <p className="field-hint">
          <Link href="/parametres/automatisations/rappel-jour-j">{t("event.settings")} ›</Link>
        </p>
      </details>
    </section>
  );
}
