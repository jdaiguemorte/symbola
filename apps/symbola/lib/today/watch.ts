// Lot 72a (HUB-08, GC-02 ; critère 6) — une alerte du radar des risques devient une ligne « À regarder »
// de l'accueil : sa règle en une phrase (les textes RiskRadar.*, tirés par l'appelant), l'écran où agir,
// son évènement. Sans date : elle se range au jour même et compte dans les points. Règle pure.
import type { RiskAlert } from "@symbola/contracts";
import type { TodayItem } from "./rank";

export type WatchWords = (alert: RiskAlert) => { title: string; detail?: string | undefined };

export function watchItems(alerts: readonly RiskAlert[], words: WatchWords): TodayItem[] {
  return alerts.map((alert) => {
    const text = words(alert);
    return {
      key: `watch:${alert.key}`,
      kind: "watch",
      eventId: alert.eventId,
      eventNames: alert.eventNames,
      title: text.title,
      detail: text.detail,
      dueOn: null,
      since: null,
      actor: { kind: "you" },
      href: alert.href,
      action: { kind: "open" },
    };
  });
}
