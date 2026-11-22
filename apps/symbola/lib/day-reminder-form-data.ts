// Lot 66b (JRJ-01 ; D2, D3) — les quatre cibles du rappel du jour J lues d'un formulaire
// (app/ui/day-reminder-form.tsx) ; la validation est celle du service.
import { DAY_REMINDER_TARGETS, type DayReminderTarget } from "@symbola/contracts";

export function readDayReminderForm(formData: FormData): { target: DayReminderTarget; enabled: boolean; moment: string; sendTime: string }[] {
  return DAY_REMINDER_TARGETS.map((target) => ({ target, enabled: formData.get(`${target}.enabled`) === "on", moment: String(formData.get(`${target}.moment`) ?? ""), sendTime: String(formData.get(`${target}.time`) ?? "") }));
}
