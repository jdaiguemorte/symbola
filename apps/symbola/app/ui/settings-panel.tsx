"use client";

// Lot 63c (UX-09, UX-13 ; ADR 0107, maquette M8) — le panneau latéral des réglages d'un écran : il
// s'ouvre au-dessus de l'écran, qui reste tel quel ; « Fermer », Échap ou le retour du navigateur le
// referment. Sur téléphone, il prend tout l'écran et son bouton dit « Retour à <écran> ».
import { useRouter } from "next/navigation";
import { useEffect, useRef, type ReactNode } from "react";
import { useTranslations } from "next-intl";
import { useHelpContext } from "@/app/help-context";
import { SettingsPanelScope } from "./screen-main";

export function SettingsPanel({ label, backLabel, fallbackHref, children }: { label: string; backLabel: string; fallbackHref: string; children: ReactNode }) {
  const t = useTranslations("Common");
  const router = useRouter();
  const panelRef = useRef<HTMLElement>(null);
  const help = useHelpContext();

  useEffect(() => {
    // Un seul panneau à droite (lot 39c) : l'aide de l'écran se ferme.
    if (help?.open) help.toggle();
    panelRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function close() {
    // Ouvert depuis un écran de l'app : on y revient tel quel ; sinon, la page des réglages.
    if (window.history.length > 1) router.back();
    else router.push(fallbackHref);
  }

  return (
    <aside ref={panelRef} className="side-panel settings-panel" aria-label={label} tabIndex={-1} data-settings-panel="">
      <div className="settings-panel-bar">
        <button type="button" className="button-ghost" onClick={close}>
          <span className="settings-panel-back-mobile">‹ {backLabel}</span>
          <span className="settings-panel-back-desktop">{t("closePanel")}</span>
        </button>
      </div>
      <SettingsPanelScope>{children}</SettingsPanelScope>
    </aside>
  );
}
