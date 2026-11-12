"use client";

// Lot 29a (ARC-09, JRJ-02, NFR-09 ; ADR 0064, décisions D3 et D4) — « Sur cet appareil » :
// garder le jour J (geste explicite, par appareil), le mettre à jour à chaque ouverture en
// ligne, le retirer. Sans réseau, ou session expirée, l'écran dit de quand date la copie.
import { useCallback, useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import type { DayCopy } from "@/lib/offline/day-copy";
import {
  ensureDayWorker,
  offlineSupported,
  purgeDayCopies,
  readDayCopy,
  removeDayCopy,
  syncDayCopy,
  type DayDocument,
  type SyncOutcome,
} from "@/lib/offline/device-copies";

type Phase = "checking" | "unsupported" | "absent" | "working" | "ready" | "offline" | "session" | "space" | "unavailable" | "removed";

export function DayCopyPanel(props: {
  eventId: string;
  userId: string;
  title: string;
  eventDate: string;
  expiresAt: string;
  canKeep: boolean;
  documents: DayDocument[];
  // Lot 29b : taille des documents embarqués, ajoutée à la place libre demandée.
  requiredBytes: number;
}) {
  const t = useTranslations("DayOf");
  const format = useFormatter();
  const [phase, setPhase] = useState<Phase>("checking");
  const [copy, setCopy] = useState<DayCopy | null>(null);
  const [missing, setMissing] = useState<{ documents: string[]; assets: number }>({ documents: [], assets: 0 });
  const { eventId, userId, title, eventDate, expiresAt, documents, requiredBytes } = props;

  const apply = useCallback((outcome: SyncOutcome) => {
    if (outcome.status === "ready") {
      setCopy(outcome.copy);
      setMissing({ documents: outcome.missingDocuments, assets: outcome.missingAssets });
    }
    setPhase(outcome.status);
  }, []);

  const sync = useCallback(
    async (firstTime: boolean) => {
      setPhase("working");
      try {
        apply(await syncDayCopy({ eventId, userId, title, eventDate, expiresAt, documents, requiredBytes, firstTime }));
      } catch {
        setPhase("unavailable");
      }
    },
    [apply, eventId, userId, title, eventDate, expiresAt, documents, requiredBytes],
  );

  useEffect(() => {
    let active = true;
    void (async () => {
      if (!offlineSupported()) {
        setPhase("unsupported");
        return;
      }
      await purgeDayCopies({ userId });
      const existing = await readDayCopy(eventId);
      if (!active) return;
      if (!existing) {
        setPhase("absent");
        return;
      }
      setCopy(existing);
      if (!navigator.onLine) {
        setPhase("offline");
        return;
      }
      await ensureDayWorker();
      if (active) await sync(false);
    })();
    return () => {
      active = false;
    };
    // Une seule fois à l'ouverture de l'écran.
  }, []);

  async function remove() {
    setPhase("working");
    await removeDayCopy(eventId);
    setCopy(null);
    setPhase("removed");
  }

  const syncedAt = copy
    ? format.dateTime(new Date(copy.syncedAt), { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Paris" })
    : "";

  let message: string;
  switch (phase) {
    case "checking":
      message = "";
      break;
    case "unsupported":
      message = t("copyUnsupported");
      break;
    case "absent":
      message = props.canKeep ? t("copyAbsent") : t("copyExpired");
      break;
    case "removed":
      message = t("copyRemoved");
      break;
    case "working":
      message = t("copyWorking");
      break;
    case "ready":
      message = t("copyReady", { date: syncedAt });
      break;
    case "offline":
      message = copy ? t("copyOffline", { date: syncedAt }) : t("copyOfflineNone");
      break;
    case "session":
      message = copy ? t("copySession", { date: syncedAt }) : t("copySessionNone");
      break;
    case "space":
      message = t("copySpace");
      break;
    case "unavailable":
      message = t("copyUnavailable");
      break;
  }

  const kept = copy !== null && phase !== "removed";
  return (
    <section className="card day-copy" aria-labelledby="day-copy-title">
      <h2 id="day-copy-title">{t("copyTitle")}</h2>
      <p role="status" data-phase={phase}>
        {message}
      </p>
      {phase === "ready" && missing.documents.length > 0 ? <p>{t("copyMissingDocuments", { list: missing.documents.join(", ") })}</p> : null}
      {phase === "ready" && missing.assets > 0 ? <p>{t("copyMissingAssets")}</p> : null}
      {(phase === "absent" || phase === "removed") && props.canKeep ? <p className="meta">{t("copyKeepHint")}</p> : null}
      <div className="day-copy-actions">
        {(phase === "absent" || phase === "removed" || phase === "space") && props.canKeep ? (
          <button type="button" className="primary" onClick={() => void sync(true)}>
            {t("copyKeep")}
          </button>
        ) : null}
        {kept && (phase === "ready" || phase === "unavailable") ? (
          <button type="button" onClick={() => void sync(false)}>
            {t("copyUpdate")}
          </button>
        ) : null}
        {phase === "session" ? (
          <a className="button-link" href="/login">
            {t("copyLogin")}
          </a>
        ) : null}
        {kept && phase !== "working" ? (
          <button type="button" className="button-ghost" onClick={() => void remove()}>
            {t("copyRemove")}
          </button>
        ) : null}
      </div>
      <details className="day-install">
        <summary>{t("installTitle")}</summary>
        <p>{t("installIphone")}</p>
        <p>{t("installAndroid")}</p>
      </details>
    </section>
  );
}
