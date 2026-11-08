"use client";

// Lot 16 (HUB-19, ADR 0039) — le seul « ? » de l'app, dans la barre du haut, au
// même endroit sur tous les écrans. Il ouvre l'aide déclarée par l'écran ; un
// écran qui n'en déclare pas mène au centre d'aide.
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useHelpContext } from "./help-context";

export function HelpButton() {
  const t = useTranslations("Landmarks");
  const help = useHelpContext();
  if (!help) return null;
  if (!help.screen) {
    return (
      <Link href="/aide" className="help-button" aria-label={t("center")}>
        ?
      </Link>
    );
  }
  return (
    <button
      ref={help.buttonRef}
      type="button"
      className="help-button"
      data-tour="help-button"
      aria-expanded={help.open}
      aria-label={t("toggle")}
      onClick={help.toggle}
    >
      ?
    </button>
  );
}
