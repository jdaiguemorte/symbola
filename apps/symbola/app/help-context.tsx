"use client";

// Lot 10 (AIDE-05, AIDE-07), revu au lot 13 (AIDE-11), au lot 16 (L16-HUB-19, ADR 0039), au lot 63f
// (HUB-11, ADR 0104) puis au lot 74d (D2 de l'audit, B10 à B12 ; page 25 des maquettes du lot 68) —
// l'aide de l'écran affiché. L'écran DÉCLARE son aide (titre, texte, sa visite s'il en a une) par
// <ScreenHelp> ou <PageTour> ; il ne pose plus de bouton. Un seul « ? », dans la barre du haut
// (<HelpButton>), ouvre un tiroir qui pousse le contenu ; « Revoir la visite de cet écran » en est la
// première ligne. Seule la visite de l'accueil s'ouvre d'elle-même (une fois, comptée comme vue) ;
// ailleurs, la ligne « Découvrir » la propose. Les bulles sont lues au démarrage de la visite, pas avec
// la page (consigne NFR-02 du 28/11). À la fermeture du tiroir, le focus revient au « ? » ; à la fin de
// la visite, à son point de départ.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { GuidedTour, HelpDrawer, type TourStep } from "@symbola/ui";
import { useTranslations } from "next-intl";
import { loadTourStepsAction, recordHelpProgressAction } from "./actions";

export type ScreenTour = {
  key: string;
  stepCount: number;
  variant: "empty" | "filled";
  // Visite ouverte d'elle-même à l'arrivée (accueil, une fois) ou demandée (« ?visite=revoir »).
  autoOpen: boolean;
};

export type ScreenHelpDeclaration = {
  title: string;
  body: string;
  // Écran à visite guidée (HUB-11) : progression « visite vue ».
  tour?: ScreenTour | undefined;
  // Lot 20 (décision 2) : action propre à l'écran, affichée sous son texte.
  extra?: ReactNode;
};

export type ActiveTour = { key: string; open: boolean };

type HelpContextValue = {
  screen: ScreenHelpDeclaration | null;
  open: boolean;
  tour: ActiveTour | null;
  declare: (id: string, declaration: ScreenHelpDeclaration) => void;
  withdraw: (id: string) => void;
  toggle: () => void;
  startTour: () => void;
  buttonRef: RefObject<HTMLButtonElement | null>;
};

const HelpContext = createContext<HelpContextValue | null>(null);

// Lancée (d'elle-même, depuis la ligne ou le « ? ») : la visite compte comme vue, la ligne ne revient plus.
function recordSeen(tour: ScreenTour) {
  void recordHelpProgressAction(`tour:${tour.key}`, "completed", 0);
}

export function HelpProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("HelpUi");
  const [declarations, setDeclarations] = useState<{ id: string; declaration: ScreenHelpDeclaration }[]>([]);
  const [open, setOpen] = useState(false);
  const [steps, setSteps] = useState<TourStep[]>([]);
  const [touring, setTouring] = useState(false);
  const known = useRef(new Set<string>());
  const loaded = useRef(new Map<string, TourStep[]>());
  const buttonRef = useRef<HTMLButtonElement>(null);
  // La première déclaration est celle de l'écran (une section peut en déclarer une seconde).
  const screen = declarations[0]?.declaration ?? null;

  // Les bulles, lues une fois par visite et par état de l'écran, puis la visite part.
  const launch = useCallback(async (tour: ScreenTour) => {
    const cacheKey = `${tour.key}:${tour.variant}`;
    let found = loaded.current.get(cacheKey);
    if (!found) {
      found = (await loadTourStepsAction(tour.key, tour.variant)).map((step) => ({ target: step.target, title: step.title, body: step.body, ...(step.touch ? { touch: step.touch } : {}) }));
      loaded.current.set(cacheKey, found);
    }
    if (found.length === 0) return;
    recordSeen(tour);
    setSteps(found);
    setOpen(false);
    setTouring(true);
  }, []);

  const declare = useCallback(
    (id: string, declaration: ScreenHelpDeclaration) => {
      setDeclarations((list) =>
        list.some((entry) => entry.id === id) ? list.map((entry) => (entry.id === id ? { id, declaration } : entry)) : [...list, { id, declaration }],
      );
      if (!known.current.has(id)) {
        known.current.add(id);
        if (declaration.tour?.autoOpen) void launch(declaration.tour);
      }
    },
    [launch],
  );

  const withdraw = useCallback((id: string) => {
    known.current.delete(id);
    setDeclarations((list) => list.filter((entry) => entry.id !== id));
  }, []);

  const toggle = useCallback(() => {
    setTouring(false);
    setOpen(!open);
  }, [open]);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // « Lancer » (la ligne ou le « ? ») : le tiroir se ferme, la visite part ; à sa fin, le focus revient
  // au « ? », où la visite se relance.
  const startTour = useCallback(() => {
    if (!screen?.tour) return;
    buttonRef.current?.focus({ preventScroll: true });
    void launch(screen.tour);
  }, [screen, launch]);

  const endTour = useCallback(() => setTouring(false), []);

  // Écran quitté sans fermer l'aide : ni le tiroir ni la visite ne suivent sur l'écran suivant.
  // Seulement quand une aide déclarée disparaît : au premier affichage, l'écran déclare (et peut
  // lancer sa visite) avant cet effet.
  const hadScreen = useRef(false);
  useEffect(() => {
    if (screen === null && hadScreen.current) {
      setOpen(false);
      setTouring(false);
    }
    hadScreen.current = screen !== null;
  }, [screen]);

  // Le tiroir pousse le contenu (globals.css, body[data-help-open]).
  const visible = open && screen !== null;
  const touringVisible = touring && screen?.tour !== undefined && steps.length > 0;
  useEffect(() => {
    document.body.dataset.helpOpen = visible ? "true" : "false";
    return () => {
      delete document.body.dataset.helpOpen;
    };
  }, [visible]);

  const value = useMemo<HelpContextValue>(
    () => ({
      screen,
      open: visible,
      tour: screen?.tour ? { key: screen.tour.key, open: touringVisible } : null,
      declare,
      withdraw,
      toggle,
      startTour,
      buttonRef,
    }),
    [screen, visible, touringVisible, declare, withdraw, toggle, startTour],
  );

  return (
    <HelpContext.Provider value={value}>
      {children}
      {screen ? (
        <>
          <HelpDrawer
            open={visible}
            intro={screen.body}
            labels={{
              panel: t("panel", { screen: screen.title }),
              close: t("close"),
              replay: t("replay"),
              replayMeta: t("replayMeta", { count: screen.tour?.stepCount ?? 0 }),
              replayStart: t("replayStart"),
            }}
            onClose={close}
            onReplay={screen.tour ? startTour : undefined}
            extra={screen.extra}
          />
          <GuidedTour
            open={touringVisible}
            steps={steps}
            labels={{
              dialog: t("tour.dialog", { screen: screen.title }),
              progress: (number, total) => t("tour.progress", { number, total }),
              previous: t("tour.previous"),
              next: t("tour.next"),
              finish: t("tour.finish"),
              close: t("tour.close"),
            }}
            onClose={endTour}
          />
        </>
      ) : null}
    </HelpContext.Provider>
  );
}

export function useHelpContext() {
  return useContext(HelpContext);
}
