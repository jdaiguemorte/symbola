"use client";

// Lot 35a (HUB-13, D4) — avancement d'un export en préparation : barre réelle (« 12 fichiers sur
// 50 »), indéterminée tant que les données sont rassemblées ; l'écran se rafraîchit toutes les
// 2 secondes tant que l'export se prépare, et la fin est annoncée aux lecteurs d'écran (même
// patron que les traitements de fond des imports, lot 15).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";

const REFRESH_MS = 2000;

export function ExportProgress({
  id,
  status,
  filesDone,
  filesTotal,
}: {
  id: string;
  status: "pending" | "running" | "ready" | "failed";
  filesDone: number;
  filesTotal: number;
}) {
  const t = useTranslations("OrganizationExport");
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
    if (!active && wasActive.current) setAnnounced(status === "ready" ? t("finished") : t("stopped"));
    wasActive.current = active;
  }, [active, status, t]);

  const label = `export-progress-${id}`;
  return (
    <>
      {active ? (
        <div className="job-progress">
          <p id={label}>{filesTotal > 0 ? t("progressText", { done: filesDone, total: filesTotal }) : t("progressData")}</p>
          {filesTotal > 0 ? (
            <progress aria-labelledby={label} value={filesDone} max={filesTotal} />
          ) : (
            <progress aria-labelledby={label} />
          )}
        </div>
      ) : null}
      <p className="sr-only" role="status" aria-live="polite">
        {announced}
      </p>
    </>
  );
}
