"use client";

// Lot 29a (ARC-09 ; décisions D4 et D6) — jours J gardés sur cet appareil, lus dans son
// cache. Les copies périmées s'effacent ici aussi (sans savoir qui est connecté).
import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { dayPagePath, type DayCopy } from "@/lib/offline/day-copy";
import { purgeDayCopies, readDayCopies } from "@/lib/offline/device-copies";

export function OfflineDays() {
  const t = useTranslations("Offline");
  const format = useFormatter();
  const [copies, setCopies] = useState<DayCopy[] | null>(null);

  useEffect(() => {
    void (async () => {
      await purgeDayCopies({ userId: null });
      const kept = await readDayCopies().catch(() => []);
      setCopies(kept.sort((a, b) => a.eventDate.localeCompare(b.eventDate)));
    })();
  }, []);

  if (copies === null) return null;
  return (
    <section className="card" aria-labelledby="offline-days-title">
      <h2 id="offline-days-title">{t("listTitle")}</h2>
      {copies.length === 0 ? (
        <p>{t("empty")}</p>
      ) : (
        <ul className="day-list">
          {copies.map((copy) => (
            <li key={copy.eventId}>
              <a href={dayPagePath(copy.eventId)}>
                {t("open", {
                  title: copy.title,
                  date: format.dateTime(new Date(`${copy.eventDate}T12:00:00Z`), { day: "numeric", month: "long", year: "numeric", timeZone: "Europe/Paris" }),
                })}
              </a>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
