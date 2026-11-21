"use client";

// Lot 63f (HUB-11, HUB-10 ; ADR 0104 ; maquette M10) — le tutoriel en cours dans un panneau latéral
// qui reste pendant la navigation dans l'exemple. Ses étapes se cochent seules : l'étape « faire »
// est revérifiée côté serveur à chaque changement d'écran, au retour sur l'onglet et toutes les
// quelques secondes. « Étape suivante » mène au bon écran ; « Quitter le tutoriel » supprime
// l'exemple ; « Réduire » le replie (sans le fermer). Sur la page du tutoriel, il s'efface : la page
// le montre déjà. Après la fin, l'écran de départ dit « Tutoriel terminé » et conseille le suivant.
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { useTranslations } from "next-intl";
import type { TutorialPanelState } from "@/lib/help/tutorial-panel";
import { TUTORIAL_DONE_PARAM, TUTORIAL_KEPT_PARAM } from "@/lib/help/tutorial-origin";
import { autoCheckTutorialAction, continueTutorialAction, finishTutorialAction, quitTutorialAction } from "./aide/tutoriels/[key]/actions";
import { CheckForm } from "./aide/tutoriels/[key]/check-form";

const CHECK_EVERY_MS = 4000;
const COLLAPSED_KEY = "symbola-tutoriel-replie";

export type TutorialSuggestion = { title: string; minutes: number; href: string } | null;

function here(pathname: string, search: string): string {
  return search ? `${pathname}?${search}` : pathname;
}

export function TutorialPanel({ panel, done, suggestion }: { panel: TutorialPanelState | null; done: Record<string, string>; suggestion: TutorialSuggestion }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const finishedKey = searchParams.get(TUTORIAL_DONE_PARAM);
  if (finishedKey && done[finishedKey]) return <TutorialDone title={done[finishedKey]!} suggestion={suggestion} />;
  if (!panel || pathname.startsWith("/aide/tutoriels/")) return null;
  return <Panel key={`${panel.key}-${panel.index}`} panel={panel} location={here(pathname, searchParams.toString())} pathname={pathname} />;
}

function Panel({ panel, location, pathname }: { panel: TutorialPanelState; location: string; pathname: string }) {
  const t = useTranslations("TutorialPanel");
  const tTutorials = useTranslations("Tutorials");
  const router = useRouter();
  const [collapsed, setCollapsed] = useState(false);
  const [checking, startChecking] = useTransition();
  const titleId = useId();
  const busy = useRef(false);
  const { current } = panel;
  const onScreen = current.href === null || current.href === location || current.href.split("?")[0] === pathname;

  // Replié d'un écran à l'autre (le choix reste pour la session de navigation).
  useEffect(() => {
    setCollapsed(window.sessionStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);
  useEffect(() => {
    document.body.dataset.tutorialOpen = collapsed ? "collapsed" : "open";
    return () => {
      delete document.body.dataset.tutorialOpen;
    };
  }, [collapsed]);

  // L'étape « faire » se coche seule, une fois l'action faite.
  useEffect(() => {
    if (current.kind !== "do") return;
    const check = () => {
      if (busy.current || document.visibilityState === "hidden") return;
      busy.current = true;
      startChecking(async () => {
        try {
          const result = await autoCheckTutorialAction(panel.key);
          if (result.advanced) router.refresh();
        } finally {
          busy.current = false;
        }
      });
    };
    check();
    const timer = window.setInterval(check, CHECK_EVERY_MS);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [current.kind, panel.key, location, router]);

  const toggle = () => {
    const next = !collapsed;
    setCollapsed(next);
    window.sessionStorage.setItem(COLLAPSED_KEY, next ? "1" : "0");
  };

  return (
    <aside className="tutorial-panel" data-collapsed={collapsed ? "true" : "false"} aria-labelledby={titleId}>
      <div className="tutorial-panel-head">
        <p className="tutorial-panel-kicker">{t("kicker", { step: panel.index + 1, total: panel.total })}</p>
        <button type="button" className="button-ghost" aria-expanded={!collapsed} onClick={toggle}>
          {collapsed ? t("expand") : t("collapse")}
        </button>
      </div>
      <h2 id={titleId}>{panel.title}</h2>
      {collapsed ? null : (
        <>
          <ol className="tutorial-panel-steps">
            {panel.steps.map((step, position) => (
              <li key={`${step.title}-${position}`} data-state={step.state} aria-current={step.state === "current" ? "step" : undefined}>
                <span className="tutorial-step-mark" aria-hidden="true">
                  {step.state === "done" ? <Check size={14} /> : position + 1}
                </span>
                <span>
                  {step.title}
                  {step.state === "done" ? <span className="sr-only"> {t("stepDone")}</span> : null}
                </span>
              </li>
            ))}
          </ol>
          <section className="tutorial-panel-current" aria-live="polite" aria-labelledby={`${titleId}-step`}>
            <h3 id={`${titleId}-step`}>{current.title}</h3>
            <p>{current.body}</p>
            <div className="tutorial-actions">
              {current.href && !onScreen ? (
                <Link href={current.href} className="button-link button-link-primary">
                  {t("goToStep")}
                </Link>
              ) : null}
              {current.kind === "do" ? <CheckForm tutorialKey={panel.key} label={tTutorials("check")} hint={tTutorials("checkHint")} /> : null}
              {current.kind === "look" ? (
                <form action={continueTutorialAction.bind(null, panel.key)}>
                  <button type="submit">{t("nextStep")}</button>
                </form>
              ) : null}
              {current.kind === "finish" ? (
                <>
                  {panel.keepLabel ? (
                    <form action={finishTutorialAction.bind(null, panel.key, true)}>
                      <button type="submit" className="button-secondary">
                        {panel.keepLabel}
                      </button>
                    </form>
                  ) : null}
                  <form action={finishTutorialAction.bind(null, panel.key, false)}>
                    <button type="submit">{panel.dropLabel}</button>
                  </form>
                </>
              ) : null}
            </div>
            {current.kind === "do" ? (
              <p className="tutorial-note" role="status">
                {checking ? t("checking") : t("autoCheck")}
              </p>
            ) : null}
          </section>
          <form action={quitTutorialAction.bind(null, panel.key)}>
            <button type="submit" className="button-ghost tutorial-quit">
              {t("quit")}
            </button>
          </form>
        </>
      )}
    </aside>
  );
}

// Sur l'écran de départ, après la fin : « Tutoriel terminé », et le tutoriel conseillé ensuite.
function TutorialDone({ title, suggestion }: { title: string; suggestion: TutorialSuggestion }) {
  const t = useTranslations("TutorialPanel");
  const tTutorials = useTranslations("Tutorials");
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const headingRef = useRef<HTMLHeadingElement>(null);
  useEffect(() => headingRef.current?.focus(), []);
  const dismiss = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete(TUTORIAL_DONE_PARAM);
    params.delete(TUTORIAL_KEPT_PARAM);
    router.replace(params.size > 0 ? `${pathname}?${params.toString()}` : pathname);
  };
  return (
    <section className="card tutorial-done" role="status" aria-labelledby="tutorial-done-title">
      <h2 id="tutorial-done-title" ref={headingRef} tabIndex={-1}>
        {tTutorials("doneTitle")}
      </h2>
      {/* Lot 63a : le même texte de fin que la page du tutoriel. */}
      <p>
        <strong>{title}</strong> · {tTutorials(searchParams.get(TUTORIAL_KEPT_PARAM) === "1" ? "doneBodyKept" : "doneBody")}
      </p>
      {suggestion ? <p>{t("suggestion", { title: suggestion.title, minutes: suggestion.minutes })}</p> : null}
      <div className="tutorial-actions">
        {suggestion ? (
          <Link href={suggestion.href} className="button-link button-link-primary">
            {t("startNext")}
          </Link>
        ) : null}
        <button type="button" className="button-secondary" onClick={dismiss}>
          {t("dismiss")}
        </button>
      </div>
    </section>
  );
}
