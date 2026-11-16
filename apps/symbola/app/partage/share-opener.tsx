"use client";

// Lot 37a (DOC-04, SEC-17 ; D7 ; ADR 0070) — le jeton est lu après « # », retiré de l'adresse et de
// l'historique de l'onglet avant tout envoi. La page montre l'intitulé du document si le lien vaut
// encore, puis l'ouvre (ou le télécharge) par un formulaire POST : le jeton reste hors de toute
// adresse. Lien non valable : la même réponse, quel qu'en soit le motif.
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { describeShareLinkAction, type ShareLinkOutcome } from "./actions";

type State = { step: "opening" } | { step: "invalid" } | { step: "retry"; minutes: number } | { step: "valid"; token: string; label: string; previewable: boolean };

function takeTokenFromAddress(): string | null {
  const hash = window.location.hash.slice(1);
  if (hash) window.history.replaceState(window.history.state, "", window.location.pathname);
  try {
    return decodeURIComponent(hash) || null;
  } catch {
    return null;
  }
}

function nextState(token: string, result: ShareLinkOutcome): State {
  if (result.outcome === "valid") return { step: "valid", token, label: result.label, previewable: result.previewable };
  if (result.outcome === "retry") return { step: "retry", minutes: result.minutes };
  return { step: "invalid" };
}

export function ShareOpener({ invalid }: { invalid: boolean }) {
  const t = useTranslations("SharedDocuments");
  const [state, setState] = useState<State>(invalid ? { step: "invalid" } : { step: "opening" });
  const started = useRef(false);

  useEffect(() => {
    const consume = (): boolean => {
      const token = takeTokenFromAddress();
      if (!token) return false;
      setState({ step: "opening" });
      void describeShareLinkAction(token).then((result) => setState(nextState(token, result)));
      return true;
    };
    if (!started.current) {
      started.current = true;
      if (!consume() && !invalid) setState({ step: "invalid" });
    }
    const onHashChange = () => void consume();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [invalid]);

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
  if (state.step === "invalid") {
    return (
      <>
        <h1>{t("invalidTitle")}</h1>
        <p>{t("invalidBody")}</p>
      </>
    );
  }
  return (
    <>
      <h1>{t("sharedTitle")}</h1>
      <p>
        <strong>{state.label}</strong>
      </p>
      <div className="share-open-actions">
        {state.previewable ? (
          <form method="post" action="/partage/fichier">
            <input type="hidden" name="token" value={state.token} />
            <input type="hidden" name="mode" value="apercu" />
            <button type="submit" className="primary">
              {t("open")}
            </button>
          </form>
        ) : null}
        <form method="post" action="/partage/fichier">
          <input type="hidden" name="token" value={state.token} />
          <input type="hidden" name="mode" value="telecharger" />
          <button type="submit" className={state.previewable ? undefined : "primary"}>
            {t("downloadFile")}
          </button>
        </form>
      </div>
      <p className="muted">{t("openNotice")}</p>
    </>
  );
}
