"use client";

// Lot 10 (AIDE-05, AIDE-07), revu au lot 13 (AIDE-11) puis au lot 16 (L16-HUB-19,
// ADR 0039) — l'aide de l'écran affiché. L'écran DÉCLARE son aide (titre,
// texte, repères) par <ScreenHelp> ou <PageTour> ; il ne pose plus de bouton.
// Un seul « ? », dans la barre du haut (<HelpButton>), ouvre un seul panneau,
// un tiroir qui pousse le contenu au lieu de le recouvrir. À la fermeture, le
// focus revient au « ? ». La pastille « Reprendre » (HelpBar) se masque tant
// que les repères sont ouverts.
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import { Landmarks, type LandmarkStep } from "@symbola/ui";
import { useTranslations } from "next-intl";
import { recordHelpProgressAction } from "./actions";

export type ScreenHelpDeclaration = {
  title: string;
  body: string;
  steps: LandmarkStep[];
  // Écran à repères (AIDE-11) : progression « repères vus ».
  tourKey?: string | undefined;
  // Ouverts d'office à la première ouverture de l'écran (décision C du lot 13).
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
  buttonRef: RefObject<HTMLButtonElement | null>;
};

const HelpContext = createContext<HelpContextValue | null>(null);

function recordSeen(declaration: ScreenHelpDeclaration | null) {
  if (declaration?.tourKey) void recordHelpProgressAction(`tour:${declaration.tourKey}`, "completed", 0);
}

export function HelpProvider({ children }: { children: ReactNode }) {
  const t = useTranslations("Landmarks");
  const [declarations, setDeclarations] = useState<{ id: string; declaration: ScreenHelpDeclaration }[]>([]);
  const [open, setOpen] = useState(false);
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
      // Ouverts d'office une fois : comptés comme vus dès l'ouverture.
      if (declaration.initialOpen) {
        setOpen(true);
        recordSeen(declaration);
      }
    }
  }, []);

  const withdraw = useCallback((id: string) => {
    known.current.delete(id);
    setDeclarations((list) => list.filter((entry) => entry.id !== id));
  }, []);

  const toggle = useCallback(() => {
    if (!open) recordSeen(screen);
    setOpen(!open);
  }, [open, screen]);

  const close = useCallback(() => {
    setOpen(false);
    buttonRef.current?.focus();
  }, []);

  // Écran quitté sans fermer l'aide : le panneau ne suit pas sur l'écran
  // suivant. Seulement quand une aide déclarée disparaît : au premier
  // affichage, l'écran déclare (et peut ouvrir d'office) avant cet effet.
  const hadScreen = useRef(false);
  useEffect(() => {
    if (screen === null && hadScreen.current) setOpen(false);
    hadScreen.current = screen !== null;
  }, [screen]);

  // Le tiroir pousse le contenu (globals.css, body[data-help-open]).
  const visible = open && screen !== null;
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
      tour: screen?.tourKey ? { key: screen.tourKey, open: visible } : null,
      declare,
      withdraw,
      toggle,
      buttonRef,
    }),
    [screen, visible, declare, withdraw, toggle],
  );

  return (
    <HelpContext.Provider value={value}>
      {children}
      {screen ? (
        <Landmarks
          open={visible}
          intro={screen.body}
          steps={screen.steps}
          labels={{
            panel: t("panel", { screen: screen.title }),
            close: t("close"),
            previous: t("previous"),
            next: t("next"),
            marker: (number, markerTitle) => t("marker", { number, title: markerTitle }),
          }}
          onClose={close}
          extra={screen.extra}
        />
      ) : null}
    </HelpContext.Provider>
  );
}

export function useHelpContext() {
  return useContext(HelpContext);
}
