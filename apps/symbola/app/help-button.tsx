"use client";

// Lot 16 (L16-HUB-19, ADR 0039) — le seul « ? » de l'app, dans la barre du haut, au
// même endroit sur tous les écrans. Il ouvre l'aide déclarée par l'écran ; un
// écran qui n'en déclare pas mène au centre d'aide.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { useHelpContext } from "./help-context";

// Lot 39c (UX-13 ; D13) : « ? » ouvre l'aide de l'écran, sauf pendant une saisie.
function typing(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && (target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
}

export function HelpButton() {
  const t = useTranslations("HelpUi");
  const help = useHelpContext();
  const router = useRouter();
  useEffect(() => {
    if (!help) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "?" || event.metaKey || event.ctrlKey || event.altKey || typing(event.target)) return;
      event.preventDefault();
      if (help.screen) help.toggle();
      else router.push("/aide");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [help, router]);
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
