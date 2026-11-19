"use client";

// Lot 35b (HUB-13) — reprise en cours : l'écran se rafraîchit toutes les 2 secondes, et la fin est
// annoncée aux lecteurs d'écran (même patron que l'export complet, lot 35a).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const REFRESH_MS = 2000;

export function ImportProgress({ status }: { status: "pending" | "running" | "done" | "failed" }) {
  const t = useTranslations("OrganizationImport");
  const router = useRouter();
  const active = status === "pending" || status === "running";
  const wasActive = useRef(active);
  const [announced, setAnnounced] = useState("");

  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => router.refresh(), REFRESH_MS);
    return () => clearInterval(timer);
  }, [active, router]);

  useEffect(() => {
    if (!active && wasActive.current) setAnnounced(status === "done" ? t("finished") : t("stopped"));
    wasActive.current = active;
  }, [active, status, t]);

  return (
    <>
      {active ? (
        <div className="job-progress">
          <p id="import-progress">{t("progress")}</p>
          <progress aria-labelledby="import-progress" />
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {announced}
      </p>
    </>
  );
}
