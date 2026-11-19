"use client";

// Lot 55 (POR-11 ; ADR 0102) — « Ajouter à l'écran d'accueil » : à partir de la deuxième visite, jamais
// avant ; refusée, elle se tait 30 jours ; rien une fois installé. Sur Android et sur ordinateur, le
// bouton ouvre la proposition du navigateur (beforeinstallprompt) ; sur iPhone, qui n'en a pas, les
// étapes à suivre. L'état reste dans le navigateur.
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { dismissInstallPrompt, parseInstallPromptState, recordVisit, shouldOfferInstall } from "@/lib/portal/install-prompt";

const STORAGE_KEY = "symbola_portail_installation";
const SESSION_KEY = "symbola_portail_visite";

type InstallEvent = Event & { prompt(): Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

function standalone(): boolean {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

function isIos(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function PortalInstallPrompt() {
  const t = useTranslations("PortalInstall");
  const [visible, setVisible] = useState(false);
  const [installEvent, setInstallEvent] = useState<InstallEvent | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    let state = parseInstallPromptState(window.localStorage.getItem(STORAGE_KEY));
    const newSession = window.sessionStorage.getItem(SESSION_KEY) === null;
    window.sessionStorage.setItem(SESSION_KEY, "1");
    state = recordVisit(state, newSession);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    const offer = shouldOfferInstall(state, { now: Date.now(), standalone: standalone() });
    setIos(isIos());
    if (offer && isIos()) setVisible(true);
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as InstallEvent);
      if (offer) setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    const state = parseInstallPromptState(window.localStorage.getItem(STORAGE_KEY));
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(dismissInstallPrompt(state, Date.now())));
    setVisible(false);
  };

  return (
    <aside className="install-prompt" aria-labelledby="install-prompt-title">
      <h2 id="install-prompt-title">{t("title")}</h2>
      <p>{t("body")}</p>
      {ios ? <p>{t("iosSteps")}</p> : null}
      <div className="button-row">
        {installEvent ? (
          <button
            type="button"
            className="primary"
            onClick={async () => {
              await installEvent.prompt();
              const choice = await installEvent.userChoice;
              if (choice.outcome === "dismissed") dismiss();
              else setVisible(false);
            }}
          >
            {t("install")}
          </button>
        ) : null}
        <button type="button" className="button-ghost" onClick={dismiss}>
          {t("later")}
        </button>
      </div>
    </aside>
  );
}
