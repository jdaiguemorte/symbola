"use client";

// Lot 39b (NFR-16 ; D10 ; ADR 0074) — la coupure réseau est dite, pas subie : un bandeau annonce que la
// saisie est gardée sur l'appareil (DraftKeeper), puis le retour de la connexion.
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";

export function NetworkStatus() {
  const t = useTranslations("Network");
  const [state, setState] = useState<"online" | "offline" | "back">("online");
  useEffect(() => {
    let timer: number | undefined;
    const offline = () => {
      window.clearTimeout(timer);
      setState("offline");
    };
    const online = () => {
      setState("back");
      timer = window.setTimeout(() => setState("online"), 5000);
    };
    if (!navigator.onLine) setState("offline");
    window.addEventListener("offline", offline);
    window.addEventListener("online", online);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("offline", offline);
      window.removeEventListener("online", online);
    };
  }, []);
  if (state === "online") return null;
  return (
    <div role="status" className="network-status">
      {state === "offline" ? t("offline") : t("back")}
    </div>
  );
}
