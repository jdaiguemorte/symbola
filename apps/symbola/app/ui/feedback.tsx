"use client";

// Lot 70b (UX-07, UX-15, NFR-16 ; M5, M6, C-09, C-17 ; page 4 des maquettes du lot 68) — le message de
// retour, un seul pour toute l'app, monté par le gabarit. Il remplace les trois bandeaux d'avant (offre
// d'annulation d'une suppression, coche d'une tâche dans un tableau, coche sur « Aujourd'hui »).
//
// - Une place : en bas à gauche de la zone de contenu (sur téléphone, de toute la largeur, au-dessus du
//   bas de l'écran) ; il se pose sous la liste et ne couvre ni « Fait » ni l'action principale.
// - Un à la fois : le message suivant remplace le précédent et relance son temps.
// - Dix secondes quand on peut défaire (« Annuler ») ou réessayer, cinq sinon ; une barre montre le
//   temps qui reste ; il s'arrête tant que la souris ou le focus est sur le message.
// - Fond encre, texte blanc, secondaire `night-ink-muted` (8,4:1), « Annuler » en `night-accent`
//   (9,7:1), bouton de 40 px ; annoncé aux lecteurs d'écran (zone `status`, toujours présente).
// - Quand une fenêtre modale est ouverte (fenêtre de la tâche), le reste de la page est inerte : la zone
//   passe dans la fenêtre, pour que « Réessayer » ou « Annuler » reste à portée, puis revient à sa place.
import Link from "next/link";
import { useTranslations } from "next-intl";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { initialFeedback, isExpired, pauseFeedback, remainingMs, resumeFeedback, showFeedback, type FeedbackActionKind, type FeedbackState } from "./feedback-model";

export type FeedbackInput = {
  tone?: "info" | "error";
  title: string;
  detail?: string | undefined;
  // « Annuler », « Réessayer » : un geste ; « Ouvrir sa fiche » : un lien.
  action?: { kind: Exclude<FeedbackActionKind, "link">; label: string; run: () => void | Promise<void> } | { kind: "link"; label: string; href: string };
};

type FeedbackValue = { show: (input: FeedbackInput) => void; dismiss: () => void };

const FeedbackContext = createContext<FeedbackValue | null>(null);

// Hors du gabarit (écran isolé, test), le geste fonctionne sans message.
export function useFeedback(): FeedbackValue | null {
  return useContext(FeedbackContext);
}

let sequence = 0;

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("Feedback");
  const [state, setState] = useState<FeedbackState>(initialFeedback);
  const [input, setInput] = useState<FeedbackInput | null>(null);
  const [pending, startTransition] = useTransition();
  const hovered = useRef(false);
  // La fenêtre modale ouverte au moment du message, s'il y en a une.
  const [host, setHost] = useState<HTMLDialogElement | null>(null);
  const focused = useRef(false);

  const show = useCallback((next: FeedbackInput) => {
    sequence += 1;
    const modal = [...document.querySelectorAll("dialog")].reverse().find((dialog) => dialog.open && dialog.matches(":modal")) ?? null;
    setHost(modal);
    setInput(next);
    setState((current) =>
      showFeedback(
        current,
        { id: String(sequence), tone: next.tone ?? "info", title: next.title, detail: next.detail, action: next.action ? { kind: next.action.kind, label: next.action.label } : undefined },
        Date.now(),
      ),
    );
  }, []);

  // La fenêtre se ferme : la zone revient à sa place, le message avec elle.
  useEffect(() => {
    if (!host) return;
    const back = () => setHost(null);
    host.addEventListener("close", back);
    const watch = window.setInterval(() => {
      if (!host.isConnected || !host.open) back();
    }, 250);
    return () => {
      host.removeEventListener("close", back);
      window.clearInterval(watch);
    };
  }, [host]);

  const dismiss = useCallback(() => {
    hovered.current = false;
    focused.current = false;
    setState(initialFeedback);
    setInput(null);
  }, []);

  // Le message part quand son temps est écoulé (jamais pendant une pause).
  useEffect(() => {
    if (!state.message || state.paused) return;
    const timer = window.setTimeout(() => {
      if (isExpired(state, Date.now())) dismiss();
    }, remainingMs(state, Date.now()));
    return () => window.clearTimeout(timer);
  }, [state, dismiss]);

  const syncPause = () => {
    const now = Date.now();
    setState((current) => (hovered.current || focused.current ? pauseFeedback(current, now) : resumeFeedback(current, now)));
  };

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);
  const message = state.message;
  const action = input?.action;
  const total = message ? (message.action?.kind === "undo" || message.action?.kind === "retry" ? 10_000 : 5_000) : 0;

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      {host ? createPortal(region("feedback-region feedback-region-floating"), host) : region("feedback-region")}
    </FeedbackContext.Provider>
  );

  function region(className: string) {
    return (
      <div className={className} role="status" aria-label={t("region")}>
        {message ? (
          <div
            key={message.id}
            className={message.tone === "error" ? "feedback feedback-error" : "feedback"}
            data-paused={state.paused ? "true" : undefined}
            onMouseEnter={() => {
              hovered.current = true;
              syncPause();
            }}
            onMouseLeave={() => {
              hovered.current = false;
              syncPause();
            }}
            onFocus={() => {
              focused.current = true;
              syncPause();
            }}
            onBlur={(event) => {
              if (event.currentTarget.contains(event.relatedTarget as Node | null)) return;
              focused.current = false;
              syncPause();
            }}
          >
            {message.tone === "error" ? (
              <span className="feedback-icon" aria-hidden="true">
                !
              </span>
            ) : (
              <svg className="feedback-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                <path d="M5 12l5 5L20 7" />
              </svg>
            )}
            <div className="feedback-text">
              <p className="feedback-title">
                {message.tone === "error" ? <strong>{t("errorPrefix")} </strong> : null}
                {message.title}
              </p>
              {message.detail ? <p className="feedback-detail">{message.detail}</p> : null}
            </div>
            {action ? (
              action.kind === "link" ? (
                <Link className="feedback-action" href={action.href} onClick={dismiss}>
                  {action.label}
                </Link>
              ) : (
                <button
                  type="button"
                  className="feedback-action"
                  disabled={pending}
                  onClick={() =>
                    startTransition(async () => {
                      await action.run();
                    })
                  }
                >
                  {action.label}
                </button>
              )
            ) : null}
            <button type="button" className="feedback-close" aria-label={t("close")} onClick={dismiss}>
              <span aria-hidden="true">×</span>
            </button>
            <span className="feedback-timer" aria-hidden="true" style={{ animationDuration: `${total}ms` }} />
          </div>
        ) : null}
      </div>
    );
  }
}

// Un message venu du serveur (offre d'annulation posée par une action, retour à l'accueil après
// « Fait ») : affiché une fois, à l'arrivée sur l'écran.
export function ShowFeedbackOnMount({ input }: { input: FeedbackInput }) {
  const feedback = useFeedback();
  const shown = useRef(false);
  useEffect(() => {
    if (shown.current || !feedback) return;
    shown.current = true;
    feedback.show(input);
  }, [feedback, input]);
  return null;
}
