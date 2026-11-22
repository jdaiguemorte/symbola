"use client";

// Lot 10 (AIDE-05, AIDE-07), revu au lot 13 (AIDE-11), au lot 16 (L16-HUB-19, ADR 0039) puis au
// lot 63f (HUB-11, ADR 0104) — l'aide de l'écran affiché. L'écran DÉCLARE son aide (titre, texte,
// étapes de sa visite) par <ScreenHelp> ou <PageTour> ; il ne pose plus de bouton. Un seul « ? »,
// dans la barre du haut (<HelpButton>), ouvre un tiroir qui pousse le contenu ; « Revoir la visite »
// y lance la visite guidée. À la première ouverture d'un écran à visite, elle se lance d'elle-même
// une fois (et compte alors comme vue). À la fermeture du tiroir, le focus revient au « ? » ; à la
// fin de la visite, à son point de départ. La pastille « Reprendre » (HelpBar) se masque pendant la
// visite.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { GuidedTour, HelpDrawer, type TourStep } from "@symbola/ui";
import { useTranslations } from "next-intl";
import { recordHelpProgressAction } from "./actions";

export type ScreenHelpDeclaration = {
  title: string;
  body: string;
  steps: TourStep[];
  // Écran à visite guidée (HUB-11) : progression « visite vue ».
  tourKey?: string | undefined;
  // Visite lancée d'office à la première ouverture de l'écran.
  initialOpen?: boolean | undefined;
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

function recordSeen(declaration: ScreenHelpDeclaration | null) {
  if (declaration?.tourKey) void recordHelpProgressAction(`tour:${declaration.tourKey}`, "completed", 0);
}

export function HelpProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("HelpUi");
  const [declarations, setDeclarations] = useState<{ id: string; declaration: ScreenHelpDeclaration }[]>([]);
  const [open, setOpen] = useState(false);
  const [touring, setTouring] = useState(false);
  const known = useRef(new Set<string>());
  const buttonRef = useRef<HTMLButtonElement>(null);
  // La première déclaration est celle de l'écran (une section peut en déclarer une seconde).
  const screen = declarations[0]?.declaration ?? null;

  const declare = useCallback((id: string, declaration: ScreenHelpDeclaration) => {
    setDeclarations((list) =>
      list.some((entry) => entry.id === id) ? list.map((entry) => (entry.id === id ? { id, declaration } : entry)) : [...list, { id, declaration }],
    );
    if (!known.current.has(id)) {
      known.current.add(id);
      // Lancée d'office une fois : comptée comme vue dès l'ouverture.
      if (declaration.initialOpen && declaration.steps.length > 0) {
        setOpen(false);
        setTouring(true);
        recordSeen(declaration);
      }
    }
  }, []);

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

  // « Revoir la visite » : le tiroir se ferme, la visite part ; à sa fin, le focus revient au « ? ».
  const startTour = useCallback(() => {
    if (!screen || screen.steps.length === 0) return;
    buttonRef.current?.focus();
    setOpen(false);
    setTouring(true);
    recordSeen(screen);
  }, [screen]);

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
  const touringVisible = touring && screen !== null && screen.steps.length > 0;
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
      tour: screen?.tourKey ? { key: screen.tourKey, open: touringVisible } : null,
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
            labels={{ panel: t("panel", { screen: screen.title }), close: t("close"), replay: t("replay") }}
            onClose={close}
            onReplay={screen.steps.length > 0 ? startTour : undefined}
            extra={screen.extra}
          />
          <GuidedTour
            open={touringVisible}
            steps={screen.steps}
            labels={{
              dialog: t("tour.dialog", { screen: screen.title }),
              progress: (number, total) => t("tour.progress", { number, total }),
              previous: t("tour.previous"),
              next: t("tour.next"),
              finish: t("tour.finish"),
              skip: t("tour.skip"),
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
