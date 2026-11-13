"use client";

// Lot 32b (CRM-04 ; décision D10) — sous un champ de date d'évènement : dès que la date est choisie,
// les évènements confirmés et les options du même jour. Simple avis : l'enregistrement reste libre.
import { useEffect, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { formatCalendarDate, type Locale } from "@symbola/i18n";
import { sameDayEventsAction, type SameDayEvent } from "./date-alert-actions";

const DATE = /^\d{4}-\d{2}-\d{2}$/;

export function SameDayNotice({ date, excludeEventId = null }: { date: string; excludeEventId?: string | null }) {
  const t = useTranslations("Events");
  const locale = useLocale() as Locale;
  const [found, setFound] = useState<{ date: string; events: SameDayEvent[] } | null>(null);

  useEffect(() => {
    if (!DATE.test(date)) return;
    let current = true;
    void sameDayEventsAction(date, excludeEventId).then((events) => {
      if (current) setFound({ date, events });
    });
    return () => {
      current = false;
    };
  }, [date, excludeEventId]);

  const events = found && found.date === date ? found.events : [];
  return (
    <p className={events.length > 0 ? "same-day-notice" : "sr-only"} role="status">
      {events.length > 0
        ? t("sameDayAlert", {
            date: formatCalendarDate(date, locale),
            events: events.map((event) => t(event.confirmed ? "sameDayConfirmed" : "sameDayOption", { names: event.names })).join(", "),
          })
        : ""}
    </p>
  );
}
