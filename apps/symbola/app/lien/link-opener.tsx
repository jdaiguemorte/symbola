"use client";

// Lot 26a (SEC-17, décision D2) — le jeton est lu après « # », retiré de
// l'adresse et de l'historique de l'onglet avant tout envoi, puis échangé
// contre une session. Lien non valable : rien n'est révélé, et la personne peut
// demander un nouveau lien (SEC-15, décision D5). Lot 26b (POR-01, D6) : un
// lien peut demander un code reçu par e-mail ; le jeton reste alors en mémoire
// de la page (jamais dans l'adresse) le temps de la saisie.
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { openLinkAction, requestLinkRenewalAction, verifyLinkCodeAction, type OpenLinkOutcome } from "./actions";

type CodeProblem = { kind: "wrong"; attemptsLeft: number } | { kind: "expired" } | null;
type State =
  | { step: "opening" }
  | { step: "code"; token: string; emailHint: string; codeSent: boolean; problem: CodeProblem }
  | { step: "invalid"; token: string | null }
  | { step: "retry"; minutes: number }
  | { step: "requested" };

// Suite d'une ouverture (ou d'une demande de nouveau code).
function nextState(token: string, result: OpenLinkOutcome): State | null {
  if (result.outcome === "opened") {
    window.location.replace(result.home);
    return null;
  }
  if (result.outcome === "code_required") return { step: "code", token, emailHint: result.emailHint, codeSent: result.codeSent, problem: null };
  if (result.outcome === "retry") return { step: "retry", minutes: result.minutes };
  return { step: "invalid", token };
}

function takeTokenFromAddress(): string | null {
  const hash = window.location.hash.slice(1);
  if (hash) window.history.replaceState(window.history.state, "", window.location.pathname);
  try {
    return decodeURIComponent(hash) || null;
  } catch {
    return null;
  }
}

export function LinkOpener({ home }: { home: string | null }) {
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
        const next = nextState(token, result);
        if (next) setState(next);
      });
      return true;
    };
    if (!started.current) {
      started.current = true;
      if (!consume()) {
        if (home) window.location.replace(home);
        else setState({ step: "invalid", token: null });
      }
    }
    const onHashChange = () => void consume();
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, [home]);

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
  if (state.step === "code") return <CodeStep state={state} onState={setState} />;
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

// Lot 26b (POR-01, D6) : saisie du code à usage unique.
function CodeStep({ state, onState }: { state: Extract<State, { step: "code" }>; onState: (state: State) => void }) {
  const t = useTranslations("LinkPortal");
  const [pending, startTransition] = useTransition();
  const codeId = useId();
  const problemId = useId();
  return (
    <>
      <h1>{t("codeTitle")}</h1>
      <p role="status">{state.codeSent ? t("codeSent", { email: state.emailHint }) : t("codeNotSent", { email: state.emailHint })}</p>
      <form
        className="link-code-form"
        onSubmit={(event) => {
          event.preventDefault();
          const code = String(new FormData(event.currentTarget).get("code") ?? "");
          startTransition(async () => {
            const result = await verifyLinkCodeAction(state.token, code);
            if (result.outcome === "opened") window.location.replace(result.home);
            else if (result.outcome === "wrong_code") onState({ ...state, problem: { kind: "wrong", attemptsLeft: result.attemptsLeft } });
            else if (result.outcome === "code_expired") onState({ ...state, problem: { kind: "expired" } });
            else if (result.outcome === "retry") onState({ step: "retry", minutes: result.minutes });
            else onState({ step: "invalid", token: state.token });
          });
        }}
      >
        <label htmlFor={codeId}>{t("codeLabel")}</label>
        <input
          id={codeId}
          name="code"
          required
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={9}
          aria-describedby={state.problem ? problemId : undefined}
          aria-invalid={state.problem ? true : undefined}
        />
        {state.problem ? (
          <p id={problemId} role="alert">
            {state.problem.kind === "wrong" ? t("codeWrong", { count: state.problem.attemptsLeft }) : t("codeExpired")}
          </p>
        ) : null}
        <button type="submit" className="primary" disabled={pending}>
          {t("codeSubmit")}
        </button>
      </form>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const next = nextState(state.token, await openLinkAction(state.token));
            if (next) onState(next);
          })
        }
      >
        {t("codeResend")}
      </button>
    </>
  );
}
