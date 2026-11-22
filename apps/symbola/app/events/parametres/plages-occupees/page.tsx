// Lot 64 (HUB-29, RDV-02 ; D1, D2 ; maquette M1) — rubrique « Plages occupées » des Paramètres : la
// règle de chaque type d'évènement (et des évènements sans type), modifiable en fenêtre, et le réglage
// « les options bloquent aussi mon agenda ». Liste de réglages (lot 61) : une carte, une ligne par type.
import { getLocale, getTranslations } from "next-intl/server";
import type { BusyRule } from "@symbola/contracts";
import type { Locale } from "@symbola/i18n";
import { getBusySettings, listEventTypeBusyRules } from "@/modules/events/service";
import { ScreenHelp } from "@/app/screen-help";
import { FormDialog } from "@/app/ui/form-dialog";
import { requirePlanner } from "@/lib/guards";
import { ensureEventTypes } from "@/lib/events/event-types";
import { busyDayLabel, busyDuration, busyHour, capitalize, type BusyLocale } from "@/lib/events/busy-format";
import { isEventsModuleEnabled } from "../../module-access";
import { BusyRuleFields } from "../../busy-rule-fields";
import { resetTypeBusyRuleAction, saveFallbackBusyRuleAction, saveTypeBusyRuleAction, setOptionsBlockAction } from "../../busy-actions";

export default async function BusyRangesSettingsPage() {
  const auth = await requirePlanner();
  const organizationId = auth.user.organizationId;
  const t = await getTranslations("Busy");
  if (!(await isEventsModuleEnabled(organizationId))) {
    const tEvents = await getTranslations("Events");
    return (
      <main>
        <h1>{t("settingsTitle")}</h1>
        <p>{tEvents("moduleUnavailable")}</p>
      </main>
    );
  }
  const tHelp = await getTranslations("Help");
  const locale = (await getLocale()) as Locale;
  const busyLocale: BusyLocale = locale === "en" ? "en" : "fr";
  await ensureEventTypes(organizationId, locale);
  const [types, settings] = await Promise.all([listEventTypeBusyRules(organizationId), getBusySettings(organizationId)]);
  const words = { sameDay: t("sameDay"), dayBefore: (count: number) => t("dayBefore", { count }), dayAfter: (count: number) => t("dayAfter", { count }) };
  const ruleText = (rule: BusyRule) =>
    t("ruleText", {
      startDay: capitalize(busyDayLabel(rule.startDayOffset, words)),
      start: busyHour(rule.startTime, busyLocale),
      endDay: busyDayLabel(rule.endDayOffset, words),
      end: busyHour(rule.endTime, busyLocale),
    });

  const row = (input: { key: string; label: string; hint?: string; rule: BusyRule; isStarter: boolean; eventTypeId: string | null }) => (
    <tr key={input.key}>
      <th scope="row">
        {input.label}
        {input.hint ? <span className="busy-row-hint">{input.hint}</span> : null}
      </th>
      <td>{ruleText(input.rule)}</td>
      <td className="num">{busyDuration(input.rule, busyLocale)}</td>
      <td className="busy-row-actions">
        <FormDialog
          triggerLabel={t("edit")}
          triggerAccessibleLabel={t("editFor", { label: input.label })}
          title={t("dialogTitle", { label: input.label })}
          intro={t("dialogIntro")}
          submitLabel={t("saveRule")}
          cancelLabel={t("cancel")}
          action={input.eventTypeId ? saveTypeBusyRuleAction : saveFallbackBusyRuleAction}
          wide
        >
          {input.eventTypeId ? <input type="hidden" name="eventTypeId" value={input.eventTypeId} /> : null}
          <BusyRuleFields defaultRule={input.rule} />
        </FormDialog>
        {input.eventTypeId && !input.isStarter ? (
          <form action={resetTypeBusyRuleAction}>
            <input type="hidden" name="eventTypeId" value={input.eventTypeId} />
            <button type="submit" className="button-ghost" aria-label={t("resetFor", { label: input.label })}>
              {t("reset")}
            </button>
          </form>
        ) : null}
      </td>
    </tr>
  );

  return (
    <main>
      <h1>{t("settingsTitle")}</h1>
      <ScreenHelp title={tHelp("busyRanges.title")} body={tHelp("busyRanges.body")} />
      <p>{t("settingsIntro")}</p>
      <div className="list-table-wrap">
        <table className="list-table busy-table">
          <thead>
            <tr>
              <th scope="col">{t("columnType")}</th>
              <th scope="col">{t("columnBusy")}</th>
              <th scope="col" className="num">
                {t("columnDuration")}
              </th>
              <th scope="col">
                <span className="sr-only">{t("columnActions")}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {types.map((type) => row({ key: type.eventTypeId, label: type.label, rule: type.rule, isStarter: type.isStarter, eventTypeId: type.eventTypeId }))}
            {row({ key: "fallback", label: t("noType"), hint: t("noTypeHint"), rule: settings.fallback, isStarter: settings.isStarter, eventTypeId: null })}
          </tbody>
        </table>
      </div>
      <ul className="setting-list">
        <li className="setting-row">
          <div className="setting-row-text">
            <h2>{t("optionsBlockTitle")}</h2>
            <p>{settings.optionsBlock ? t("optionsBlockOn") : t("optionsBlockOff")}</p>
          </div>
          <div className="setting-row-controls">
            <form action={setOptionsBlockAction} className="busy-switch-form">
              <input type="hidden" name="optionsBlock" value={settings.optionsBlock ? "false" : "true"} />
              <button type="submit" role="switch" aria-checked={settings.optionsBlock} className="toggle-switch" aria-label={t("optionsBlockTitle")} />
              <span aria-hidden="true">{settings.optionsBlock ? t("enabled") : t("disabled")}</span>
            </form>
          </div>
        </li>
      </ul>
      <p className="text-label text-ink-muted">{t("newTypeNote")}</p>
    </main>
  );
}
