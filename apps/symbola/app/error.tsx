"use client";

// Lot 39b (NFR-16, UX-10 ; D9, D10 ; ADR 0074) — ni page blanche, ni message technique : une page qui
// dit ce qui s'est passé et comment en sortir (« Réessayer », revenir à l'accueil), rappelle que la
// saisie en cours est gardée (brouillons), et donne une référence courte, la même que celle notée au
// journal du serveur (instrumentation.ts). Sans réseau, elle le dit plutôt que de parler d'incident.
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { errorReference } from "@/lib/error-reference";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const t = useTranslations("Errors");
  const [offline, setOffline] = useState(false);
  useEffect(() => {
    setOffline(!navigator.onLine);
  }, []);
  const reference = errorReference(error.digest ?? error.name);
  return (
    <main>
      <h1>{offline ? t("offlineTitle") : t("title")}</h1>
      <p>{offline ? t("offlineBody") : t("body")}</p>
      <p>{t("draftsKept")}</p>
      {offline ? null : <p>{t("reference", { reference })}</p>}
      <div className="row-wrap">
        <button type="button" onClick={reset}>
          {t("retry")}
        </button>
        <Link href="/">{t("home")}</Link>
      </div>
    </main>
  );
}
