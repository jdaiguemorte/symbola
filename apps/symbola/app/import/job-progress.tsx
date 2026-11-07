"use client";

// Lot 15 (IMP-10) — avancement d'un traitement de fond d'un import : barre
// réelle (« 12 sur 50 »), rafraîchie toutes les 2 secondes tant qu'il tourne,
// annoncée aux lecteurs d'écran à chaque quart et à la fin (pas à chaque pas).
// `nextHref` : page ouverte d'elle-même à la fin (étape suivante).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const REFRESH_MS = 2000;

export function JobProgress({
  label,
  done,
  total,
  status,
  nextHref,
}: {
  label: string;
  done: number;
  total: number;
  status: "pending" | "running" | "done" | "failed" | "cancelled";
  nextHref?: string;
}) {
  const t = useTranslations("Import");
  const router = useRouter();
  const active = status === "pending" || status === "running";
  const [announced, setAnnounced] = useState("");
  const lastQuarter = useRef(-1);
  const wasActive = useRef(active);

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, router]);

  useEffect(() => {
    const quarter = total > 0 ? Math.floor((done / total) * 4) : 0;
    if (active && quarter > lastQuarter.current && quarter < 4) {
      lastQuarter.current = quarter;
      if (quarter > 0) setAnnounced(t("jobProgressText", { done, total }));
    }
    if (!active && wasActive.current) {
      setAnnounced(status === "done" ? t("jobFinished", { label }) : t("jobStopped", { label }));
      if (status === "done" && nextHref) router.replace(nextHref);
    }
    wasActive.current = active;
  }, [active, done, total, status, label, nextHref, router, t]);

  return (
    <div className="job-progress">
      <p id={`job-${label}`}>
        {label} : {t("jobProgressText", { done, total })}
      </p>
      <progress aria-labelledby={`job-${label}`} aria-valuetext={t("jobProgressText", { done, total })} value={done} max={Math.max(total, 1)} />
      <p className="sr-only" role="status" aria-live="polite">
        {announced}
      </p>
    </div>
  );
}
