"use client";

// Lot 26a (SEC-17, décision D2) — le jeton est lu après « # », retiré de
// l'adresse et de l'historique de l'onglet avant tout envoi, puis échangé
// contre une session. Lien non valable : rien n'est révélé, et la personne peut
// demander un nouveau lien (SEC-15, décision D5).
import { useEffect, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { openLinkAction, requestLinkRenewalAction } from "./actions";

type State =
  | { step: "opening" }
  | { step: "invalid"; token: string | null }
  | { step: "retry"; minutes: number }
  | { step: "requested" };

function takeTokenFromAddress(): string | null {
  const hash = window.location.hash.slice(1);
  if (hash) window.history.replaceState(window.history.state, "", window.location.pathname);
  try {
    return decodeURIComponent(hash) || null;
  } catch {
    return null;
  }
}

export function LinkOpener({ hasSession }: { hasSession: boolean }) {
  const t = useTranslations("LinkPortal");
  const [state, setState] = useState<State>({ step: "opening" });
  const [pending, startTransition] = useTransition();
  // Une seule ouverture, même quand React rejoue l'effet (mode strict en développement).
  const started = useRef(false);

  useEffect(() => {
    // Un jeton dans l'adresse : l'ouvrir. Aussi quand un second lien arrive dans
    // le même onglet : seul « # » change, la page ne se recharge pas.
    const consume = (): boolean => {
      const token = takeTokenFromAddress();
      if (!token) return false;
      setState({ step: "opening" });
      void openLinkAction(token).then((result) => {
        if (result.outcome === "opened") window.location.replace("/portail");
        else if (result.outcome === "retry") setState({ step: "retry", minutes: result.minutes });
        else setState({ step: "invalid", token });
      });
      return true;
    };
    if (!started.current) {
      started.current = true;
      if (!consume()) {
        if (hasSession) window.location.replace("/portail");
        else setState({ step: "invalid", token: null });
      }
    }
    const onHashChange = () => void consume();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [hasSession]);

  if (state.step === "opening") {
    return (
      <>
        <h1>{t("openingTitle")}</h1>
        <p role="status">{t("openingBody")}</p>
        <noscript>
          <p>{t("noScript")}</p>
        </noscript>
      </>
    );
  }
  if (state.step === "retry") {
    return (
      <>
        <h1>{t("invalidTitle")}</h1>
        <p role="alert">{t("retryLater", { minutes: state.minutes })}</p>
      </>
    );
  }
  if (state.step === "requested") {
    return (
      <>
        <h1>{t("invalidTitle")}</h1>
        <p role="status">{t("renewalRequested")}</p>
      </>
    );
  }
  const token = state.token;
  return (
    <>
      <h1>{t("invalidTitle")}</h1>
      <p>{token ? t("invalidBody") : t("invalidNoToken")}</p>
      {token ? (
        <button
          type="button"
          className="primary"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const result = await requestLinkRenewalAction(token);
              setState(result.outcome === "retry" ? { step: "retry", minutes: result.minutes } : { step: "requested" });
            })
          }
        >
          {t("requestRenewal")}
        </button>
      ) : null}
    </>
  );
}
