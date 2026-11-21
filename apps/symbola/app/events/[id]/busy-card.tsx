// Lot 64 (HUB-29, RDV-02 ; D2, D3, D5 ; maquette M3) — sur la synthèse de l'évènement : sa plage
// occupée en clair, d'où elle vient (règle du type, réglage propre), qui elle bloque, et les gestes :
// modifier pour cet évènement, revenir à la règle du type, ajouter à mon agenda.
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { listTeam } from "@symbola/auth";
import { appDatabase } from "@symbola/db/client";
import { getEventBusy } from "@/modules/events/service";
import { FormDialog } from "@/app/ui/form-dialog";
import { busyDate, busyHour, type BusyLocale } from "@/lib/events/busy-format";
import { BusyRuleFields } from "../busy-rule-fields";
import { resetEventBusyRuleAction, saveEventBusyRuleAction } from "../busy-actions";
import { AddToCalendarDialog } from "./add-to-calendar-dialog";

export async function EventBusyCard({ organizationId, eventId, eventDate, eventLabel, readOnly }: { organizationId: string; eventId: string; eventDate: string | null; eventLabel: string; readOnly: boolean }) {
  const t = await getTranslations("Busy");
  const locale: BusyLocale = (await getLocale()) === "en" ? "en" : "fr";
  const [busy, members] = await Promise.all([getEventBusy(organizationId, eventId), listTeam(appDatabase(), organizationId)]);
  if (!busy) return null;
  const emailOf = new Map(members.map((member) => [member.id, member.email]));
  const source = busy.source === "event" ? t("sourceEvent") : busy.source === "type" ? t("sourceType", { label: busy.typeLabel ?? "" }) : t("sourceFallback");
  const range =
    busy.startDate === null || busy.endDate === null
      ? null
      : busy.startDate === busy.endDate
        ? t("rangeSameDay", { day: busyDate(busy.startDate, locale), start: busyHour(busy.rule.startTime, locale), end: busyHour(busy.rule.endTime, locale) })
        : t("rangeSpan", { startDay: busyDate(busy.startDate, locale), start: busyHour(busy.rule.startTime, locale), endDay: busyDate(busy.endDate, locale), end: busyHour(busy.rule.endTime, locale) });
  const who = busy.teamUserIds.length === 0 ? t("blocksEveryone") : t("blocksTeam", { names: busy.teamUserIds.map((id) => emailOf.get(id) ?? "—").join(", ") });
  return (
    <section className="card" aria-labelledby="busy-title">
      <div className="section-head">
        <h2 id="busy-title">{t("cardTitle")}</h2>
        <span className={busy.source === "event" ? "badge badge-ambre" : "badge"}>{source}</span>
      </div>
      {range ? <p className="busy-card-range">{range}</p> : <p>{t("noDate")}</p>}
      {range ? <p className="text-label text-ink-muted">{busy.blocking ? who : t("notBlocking")}</p> : null}
      {!busy.blocking && range ? (
        <p className="text-label">
          <Link href="/events/parametres/plages-occupees">{t("settingsLink")}</Link>
        </p>
      ) : null}
      {readOnly ? null : (
        <div className="busy-card-actions">
          <FormDialog
            triggerLabel={busy.source === "event" ? t("edit") : t("editForEvent")}
            title={t("dialogTitle", { label: eventLabel })}
            intro={eventDate ? t("dialogIntroEvent", { date: busyDate(eventDate, locale) }) : t("dialogIntro")}
            submitLabel={t("saveForEvent")}
            cancelLabel={t("cancel")}
            action={saveEventBusyRuleAction}
            wide
          >
            <input type="hidden" name="eventId" value={eventId} />
            <BusyRuleFields defaultRule={busy.rule} eventDate={eventDate} />
            {eventDate ? <p className="text-label text-ink-muted">{t("followsPostponement")}</p> : null}
          </FormDialog>
          {busy.source === "event" ? (
            <form action={resetEventBusyRuleAction}>
              <input type="hidden" name="eventId" value={eventId} />
              <button type="submit" className="button-secondary">
                {t("resetToType")}
              </button>
            </form>
          ) : null}
          {range ? <AddToCalendarDialog eventId={eventId} /> : null}
        </div>
      )}
    </section>
  );
}
